import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import { createModelwerkServer } from '../server.mjs';

const servers = [];
async function listen(server) {
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks));
}
function json(res, payload, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const installed = 'openai/gpt-oss-20b';
const lmToken = 'ls-local-api-token';
const messages = [{ role: 'user', content: 'Hallo' }];
let origin, compatible, compatibleRequest;
let loadRequests = [], chatModel, downloadRequest, polls = 0;
let modelList = [
  { type: 'llm', key: installed, display_name: 'GPT-OSS 20B', loaded_instances: [], size_bytes: 12000000000, params_string: '20B', quantization: { name: 'MXFP4' } },
  { type: 'embedding', key: 'embed-only', loaded_instances: [] },
];

before(async () => {
  const lmstudio = await listen(createServer(async (req, res) => {
    if (req.headers.authorization !== `Bearer ${lmToken}`) return json(res, {}, 401);
    if (req.url === '/api/v1/models') return json(res, { models: modelList });
    if (req.url === '/api/v1/models/load') {
      loadRequests.push(await body(req));
      modelList[0].loaded_instances = [{ id: 'loaded-studio-instance' }];
      return json(res, { type: 'llm', instance_id: 'loaded-studio-instance', status: 'loaded' });
    }
    if (req.url === '/v1/chat/completions') {
      chatModel = (await body(req)).model;
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      return res.end('data: {"choices":[{"delta":{"content":"Hallo Studio"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
    }
    if (req.url === '/api/v1/models/download') {
      downloadRequest = await body(req);
      if (downloadRequest.model === installed) return json(res, { status: 'already_downloaded' });
      if (downloadRequest.model.startsWith('https://')) return json(res, { status: 'failed' });
      return json(res, { status: 'downloading', job_id: 'job_4c1', total_size_bytes: 400 });
    }
    if (req.url === '/api/v1/models/download/status/job_4c1') {
      polls++;
      if (polls === 1) return json(res, { status: 'downloading', job_id: 'job_4c1', total_size_bytes: 400, downloaded_bytes: 200 });
      modelList.push({ type: 'llm', key: downloadRequest.model, display_name: 'Gemma 4', loaded_instances: [] });
      return json(res, { status: 'completed', job_id: 'job_4c1' });
    }
    json(res, {}, 404);
  }));
  compatible = await listen(createServer(async (req, res) => {
    const isJan = req.url.startsWith('/jan/');
    if (isJan && req.headers.authorization !== 'Bearer jan-local-test') return json(res, {}, 401);
    if (req.url.endsWith('/v1/models')) return json(res, { data: [{ id: isJan ? 'jan-test' : 'gguf-test' }] });
    if (req.url.endsWith('/v1/chat/completions')) {
      compatibleRequest = { pathname: req.url, body: await body(req), authorization: req.headers.authorization };
      return json(res, { choices: [{ message: { content: 'Lokal' } }] });
    }
    json(res, {}, 404);
  }));
  origin = await listen(createModelwerkServer({ env: {
    MODELWERK_LMSTUDIO_URL: `${lmstudio}/api/v1`, MODELWERK_LMSTUDIO_KEY: lmToken,
    MODELWERK_OLLAMA_URL: 'http://127.0.0.1:1',
  } }));
});
after(async () => {
  await Promise.all(servers.map(server => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  })));
});
function post(path, payload, requestOrigin = origin) {
  return fetch(`${origin}/api/${path}`, { method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
const state = async () => (await fetch(`${origin}/api/models`)).json();
const events = async res => (await res.text()).trim().split('\n').map(line => JSON.parse(line));

test('native LM-Studio-Erkennung listet heruntergeladene Chatmodelle mitsamt Ladestatus', async () => {
  const { models, providers } = await state();
  assert.deepEqual(models, [{ id: installed, provider: 'lmstudio', name: 'GPT-OSS 20B', loaded: false, size: 12000000000, parameters: '20B', quantization: 'MXFP4' }]);
  const studio = providers.find(provider => provider.id === 'lmstudio');
  assert.equal(studio.download, true);
  assert.equal(studio.hasKey, true);
  assert.ok(studio.base.endsWith('/v1') && !studio.base.includes('/api/'));
  assert.ok(!JSON.stringify(providers).includes(lmToken));
});

test('LM Studio lädt ein Modell beim ersten Chat und verwendet danach seine Instanz-ID', async () => {
  for (let i = 0; i < 2; i++) {
    const response = await post('chat', { provider: 'lmstudio', model: installed, messages });
    assert.deepEqual(await events(response), [{ text: 'Hallo Studio' }, { done: true }]);
    assert.equal(chatModel, 'loaded-studio-instance');
  }
  assert.deepEqual(loadRequests, [{ model: installed }]);
  assert.equal((await state()).models[0].loaded, true);
});

test('LM Studio lädt ein Modell per Katalog-ID herunter und meldet echten Fortschritt', async () => {
  const model = 'google/gemma-4-e2b';
  const response = await post('pull', { model, provider: 'lmstudio' });
  assert.deepEqual(await events(response), [
    { status: 'downloading', total: 400, completed: null },
    { status: 'downloading', total: 400, completed: 200 },
    { status: 'success' }, { done: true },
  ]);
  assert.deepEqual(downloadRequest, { model });
  assert.ok((await state()).models.some(entry => entry.id === model));
  assert.deepEqual(await events(await post('pull', { model: installed, provider: 'lmstudio' })), [{ status: 'success' }, { done: true }]);
});

test('LM Studio akzeptiert Hugging-Face-Modell-URLs mit Quantisierung und meldet Fehler', async () => {
  const model = 'https://huggingface.co/lmstudio-community/gpt-oss-20b-GGUF';
  const response = await post('pull', { model, provider: 'lmstudio', quantization: 'Q4_K_M' });
  assert.match((await events(response))[0].error, /fehlgeschlagen/);
  assert.deepEqual(downloadRequest, { model, quantization: 'Q4_K_M' });
  for (const invalid of ['https://example.invalid/owner/model', 'http://127.0.0.1:1/owner/model', 'https://huggingface.co/owner/model/resolve/main/a.gguf']) {
    assert.equal((await post('pull', { model: invalid, provider: 'lmstudio' })).status, 400);
  }
  assert.equal((await post('pull', { model: installed, provider: 'lmstudio', quantization: 'Q4_K_M' })).status, 400);
});

test('zusätzliche Laufzeiten werden parallel verbunden, getrennt und nur lokal aufgerufen', async () => {
  assert.equal((await post('connection', { id: 'llamacpp', base: compatible })).status, 200);
  assert.equal((await post('connection', { id: 'jan', base: `${compatible}/jan/v1`, apiKey: 'jan-local-test' })).status, 200);
  const data = await state();
  assert.ok(data.models.some(model => model.provider === 'llamacpp' && model.id === 'gguf-test'));
  assert.ok(data.models.some(model => model.provider === 'jan' && model.id === 'jan-test'));
  assert.ok(!JSON.stringify(data).includes('jan-local-test'));
  const response = await post('chat', { provider: 'jan', model: 'jan-test', messages });
  assert.deepEqual(await events(response), [{ text: 'Lokal' }, { done: true }]);
  assert.deepEqual(compatibleRequest, { pathname: '/jan/v1/chat/completions', body: { model: 'jan-test', messages, stream: true }, authorization: 'Bearer jan-local-test' });
  assert.equal((await post('connection', { id: 'jan', base: compatible })).status, 200);
  assert.equal((await state()).providers.find(provider => provider.id === 'jan').hasKey, false, 'Kein alter Schlüssel an der neuen Adresse');
  assert.equal((await post('connection', { id: 'jan', reset: true })).status, 200);
  assert.ok(!(await state()).providers.some(provider => provider.id === 'jan'));
});

test('Verbindungsänderungen erlauben keine fremden Origins, Ziele oder Modelwerk selbst', async () => {
  assert.equal((await post('connection', { id: 'jan', base: compatible }, 'https://example.invalid')).status, 403);
  for (const base of ['https://example.invalid/v1', 'http://localhost@other.invalid/v1', `${origin}/v1`]) {
    assert.equal((await post('connection', { id: 'jan', base })).status, 400);
  }
  assert.equal((await post('connection', { id: 'unknown', base: compatible })).status, 400);
  assert.equal((await post('connection', { id: 'jan', base: compatible, apiKey: 'invalid\nkey' })).status, 400);
});
