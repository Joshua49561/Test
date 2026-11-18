import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createModelwerkServer } from '../server.mjs';

const servers = [];
async function listen(server) {
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
function sendJson(res, payload, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}
async function requestData(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks));
}
const events = async res => (await res.text()).trim().split('\n').map(line => JSON.parse(line));
const messages = [{ role: 'user', content: 'Hallo!' }];
const installable = 'gemma3:4b';
const knownLocal = 'llama3.2:latest';
const models = [
  { name: knownLocal, size: 2019393189, details: { family: 'llama', parameter_size: '3.2B' } },
  { model: 'test-locally-imported' },
  { name: 'gpt-oss:120b-cloud' },
  { name: 'alias-for-remote:latest', remote_host: 'https://example.invalid', remote_model: 'remote' },
];
let origin, preview, ollamaChat, compatibleChat, pullRequest, pullClosed;
let authChecked = false;

before(async () => {
  const ollama = await listen(createServer(async (req, res) => {
    if (req.url === '/api/tags') return sendJson(res, { models });
    if (req.url === '/api/chat') {
      ollamaChat = await requestData(req);
      const blob = Buffer.from('{"message":{"thinking":"Überlegung"},"done":false}\n{"message":{"content":"Grüße"},"done":false}\n{"message":{"content":"!"},"done":true}');
      const cut = blob.indexOf(Buffer.from('ü')) + 1;
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.write(blob.subarray(0, cut));
      await delay(18);
      return res.end(blob.subarray(cut));
    }
    if (req.url === '/api/pull') {
      pullRequest = await requestData(req);
      if (pullRequest.model === 'missing:1b') return sendJson(res, { error: 'Modell nicht gefunden' }, 404);
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      res.write('{"status":"pulling manifest"}\n{"status":"pulling abc","total":400,"completed":200}\n');
      if (pullRequest.model === 'slow:1b') {
        pullClosed = once(res, 'close');
        return;
      }
      if (pullRequest.model === 'truncated:1b') return res.end();
      if (!models.some(model => model.name === pullRequest.model)) models.push({ name: pullRequest.model, size: 400 });
      return res.end('{"status":"success"}\n');
    }
    sendJson(res, {}, 404);
  }));
  const lmstudio = await listen(createServer(async (req, res) => {
    if (req.headers.authorization !== 'Bearer test-local-key') return sendJson(res, {}, 401);
    authChecked = true;
    if (req.url === '/v1/models') return sendJson(res, { data: [{ id: 'lmstudio/test-model' }, { id: 'lmstudio/test-model' }] });
    if (req.url === '/v1/chat/completions') {
      compatibleChat = await requestData(req);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
      res.write(': connected\r\n\r\ndata: {"choices":[{"delta":{"content":"Hallo "}}]}\r\n\r\n');
      await delay(15);
      return res.end('data: {"choices":[{"delta":{"content":"Studio"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    }
    sendJson(res, {}, 404);
  }));
  const compatible = await listen(createServer(async (req, res) => {
    if (req.url === '/v1/models') return sendJson(res, { data: [{ id: 'gguf-local' }] });
    if (req.url === '/v1/chat/completions') return sendJson(res, { choices: [{ message: { content: 'Kompatible Antwort' } }] });
    sendJson(res, {}, 404);
  }));
  origin = await listen(createModelwerkServer({ env: {
    MODELWERK_OLLAMA_URL: ollama,
    MODELWERK_LMSTUDIO_URL: `${lmstudio}/v1`,
    MODELWERK_LMSTUDIO_KEY: 'test-local-key',
    MODELWERK_OPENAI_URL: `${compatible}/v1`,
  } }));
  preview = await listen(createModelwerkServer({ mode: 'preview', env: { MODELWERK_SOURCE_REF: 'arena/vorschau', MODELWERK_OLLAMA_URL: ollama } }));
});
after(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  })));
});
function post(path, body, { base = origin, headers = {}, signal } = {}) {
  return fetch(`${base}/api/${path}`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
}

test('liefert die lokale Oberfläche und nur öffentliche Dateien', async () => {
  const res = await fetch(origin);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
  assert.match(await res.text(), /name="modelwerk-mode" content="local"/);
  const js = await fetch(`${origin}/app.js`, { method: 'HEAD' });
  assert.match(js.headers.get('Content-Type'), /javascript/);
  for (const path of ['/server.mjs', '/%2e%2e%2fREADME.md']) assert.equal((await fetch(`${origin}${path}`)).status, 404);
});

test('findet Modelle aller drei Laufzeiten und blendet Ollama-Cloudvarianten aus', async () => {
  const response = await fetch(`${origin}/api/models`);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), {
    mode: 'local', providers: [
      { id: 'ollama', status: 'connected', count: 2 },
      { id: 'lmstudio', status: 'connected', count: 1 },
      { id: 'compatible', status: 'connected', count: 1 },
    ], models: [
      { id: knownLocal, provider: 'ollama', size: 2019393189, family: 'llama', parameters: '3.2B' },
      { id: 'test-locally-imported', provider: 'ollama', size: null, family: '', parameters: '' },
      { id: 'lmstudio/test-model', provider: 'lmstudio' },
      { id: 'gguf-local', provider: 'compatible' },
    ],
  });
  assert.ok(authChecked);
});

test('streamt Ollama-Text, UTF-8, Überlegungen und Abschluss', async () => {
  const res = await post('chat', { provider: 'ollama', model: knownLocal, messages });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /ndjson/);
  assert.deepEqual(await events(res), [{ reasoning: 'Überlegung' }, { text: 'Grüße' }, { text: '!' }, { done: true }]);
  assert.deepEqual(ollamaChat, { model: knownLocal, messages, stream: true });
});

test('unterstützt OpenAI-kompatible Streams und nicht streamende Chat-Antworten', async () => {
  const res = await post('chat', { provider: 'lmstudio', model: 'lmstudio/test-model', messages });
  assert.deepEqual(await events(res), [{ text: 'Hallo ' }, { text: 'Studio' }, { done: true }]);
  assert.deepEqual(compatibleChat, { model: 'lmstudio/test-model', messages, stream: true });
  const fallback = await post('chat', { provider: 'compatible', model: 'gguf-local', messages });
  assert.deepEqual(await events(fallback), [{ text: 'Kompatible Antwort' }, { done: true }]);
});

test('installiert ein Modell, meldet Schichtfortschritt und findet es anschließend', async () => {
  const res = await post('pull', { model: installable });
  assert.equal(res.status, 200);
  assert.deepEqual(await events(res), [
    { status: 'pulling manifest', total: null, completed: null },
    { status: 'pulling abc', total: 400, completed: 200 },
    { status: 'success', total: null, completed: null },
    { done: true },
  ]);
  assert.deepEqual(pullRequest, { model: installable, stream: true });
  const { models } = await (await fetch(`${origin}/api/models`)).json();
  assert.ok(models.some(model => model.id === installable));
});

test('meldet Ollama-Fehler und stellt unvollständige Downloads nicht als Erfolg dar', async () => {
  const missing = await post('pull', { model: 'missing:1b' });
  assert.equal(missing.status, 502);
  assert.deepEqual(await missing.json(), { error: 'Modell nicht gefunden' });
  const incomplete = await post('pull', { model: 'truncated:1b' });
  assert.match((await events(incomplete)).at(-1).error, /nicht abgeschlossen/);
});

test('erlaubt kein gleichzeitiges zweites Pull und bricht die lokale Anfrage bei Abbruch ab', async () => {
  const controller = new AbortController();
  const res = await post('pull', { model: 'slow:1b' }, { signal: controller.signal });
  const reader = res.body.getReader();
  assert.ok((await reader.read()).value.length);
  assert.equal((await post('pull', { model: installable })).status, 409);
  controller.abort();
  await pullClosed;
  await reader.cancel().catch(() => {});
  const next = await post('pull', { model: installable });
  assert.equal(next.status, 200);
  await next.text();
});

test('lehnt Fremd-Origins, unbekannte Hosts, ungültige Namen und Cloud-Modelle ab', async () => {
  assert.equal((await post('pull', { model: installable }, { headers: { Origin: 'https://example.invalid' } })).status, 403);
  assert.equal((await post('pull', { model: installable }, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post('pull', { model: '../foo' })).status, 400);
  assert.equal((await post('pull', { model: 'gpt-oss:120b-cloud' })).status, 400);
  assert.equal((await post('chat', { provider: 'ollama', model: 'alias-for-remote:latest', messages })).status, 400);
  const code = await new Promise((resolve, reject) => {
    const req = request(`${origin}/`, { headers: { Host: 'example.invalid' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end();
  });
  assert.equal(code, 403);
  assert.throws(() => createModelwerkServer({ env: { MODELWERK_OPENAI_URL: 'https://example.invalid/v1' } }), /lokale HTTP/);
});

test('Web-Vorschau zeigt keine Modelle und leitet keine API-Aktionen weiter', async () => {
  const res = await fetch(preview);
  const html = await res.text();
  assert.match(html, /name="modelwerk-mode" content="preview"/);
  assert.match(html, /name="modelwerk-source-ref" content="arena\/vorschau"/);
  assert.equal(res.headers.get('X-Frame-Options'), null);
  const state = await (await fetch(`${preview}/api/models`)).json();
  assert.deepEqual(state, { mode: 'preview', providers: [], models: [] });
  assert.equal((await post('pull', { model: installable }, { base: preview })).status, 403);
  assert.equal((await post('chat', { provider: 'ollama', model: knownLocal, messages }, { base: preview })).status, 403);
});
