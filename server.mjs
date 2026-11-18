import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { isCloudOllamaName, validOllamaName } from './public/model-name.js';

const publicDir = fileURLToPath(new URL('./public', import.meta.url));
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]']);
const mimes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
};
const maxBody = 384 * 1024;
const maxSegment = 2 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function localBase(raw, key) {
  let url;
  try { url = new URL(raw); } catch { /* reported below */ }
  if (!url || !['http:', 'https:'].includes(url.protocol) || !loopback.has(url.hostname) || url.username || url.password || url.hash || url.search) {
    throw new Error(`${key} muss eine lokale HTTP(S)-Adresse sein (localhost, 127.0.0.1 oder [::1]).`);
  }
  return url.href.replace(/\/+$/, '');
}

function providersFrom(env) {
  return [
    { id: 'ollama', base: localBase(env.MODELWERK_OLLAMA_URL || 'http://127.0.0.1:11434', 'MODELWERK_OLLAMA_URL'), type: 'ollama' },
    { id: 'lmstudio', base: localBase(env.MODELWERK_LMSTUDIO_URL || 'http://127.0.0.1:1234/v1', 'MODELWERK_LMSTUDIO_URL'), type: 'openai', key: env.MODELWERK_LMSTUDIO_KEY },
    { id: 'compatible', base: env.MODELWERK_OPENAI_URL ? localBase(env.MODELWERK_OPENAI_URL, 'MODELWERK_OPENAI_URL') : null, type: 'openai', key: env.MODELWERK_OPENAI_KEY },
  ];
}

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function validLocalHost(host, port) {
  return [...loopback].some(base => host === `${base}:${port}` || (port === 80 && host === base));
}

function requireSameOrigin(req) {
  const expected = `http://${req.headers.host}`;
  const origin = req.headers.origin;
  const site = req.headers['sec-fetch-site'];
  if ((site && !['same-origin', 'none'].includes(site)) || (origin && origin !== expected) || (req.method === 'POST' && origin !== expected)) {
    throw new HttpError(403, 'Diese Anfrage muss von der lokal geöffneten Modelwerk-Seite kommen.');
  }
}

async function bodyJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
    throw new HttpError(415, 'Bitte sende JSON.');
  }
  if (Number(req.headers['content-length']) > maxBody) throw new HttpError(413, 'Die Anfrage ist zu groß.');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > maxBody) {
      req.resume();
      throw new HttpError(413, 'Die Anfrage ist zu groß.');
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Ungültige JSON-Anfrage.'); }
}

function upstream(provider, path, signal, data) {
  return fetch(`${provider.base}${path}`, {
    signal, redirect: 'error', method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(provider.key ? { Authorization: `Bearer ${provider.key}` } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}

const safeString = (value, limit = 250) => typeof value === 'string' ? value.slice(0, limit) : '';

async function upstreamJson(response, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > limit) throw new Error('Antwort der Laufzeit zu groß.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function discover(provider) {
  if (!provider.base) return { id: provider.id, status: 'not-configured', models: [] };
  try {
    const isOllama = provider.type === 'ollama';
    const response = await upstream(provider, isOllama ? '/api/tags' : '/models', AbortSignal.timeout(2600));
    if (!response.ok) {
      await response.body?.cancel();
      return { id: provider.id, status: response.status === 401 || response.status === 403 ? 'auth-required' : 'unreachable', models: [] };
    }
    const payload = await upstreamJson(response, 4 * 1024 * 1024);
    const entries = isOllama ? payload?.models : payload?.data;
    if (!Array.isArray(entries)) return { id: provider.id, status: 'unreachable', models: [] };
    const models = new Map();
    for (const item of entries) {
      const id = isOllama ? item?.name || item?.model : item?.id;
      if (typeof id !== 'string' || !id.trim() || id.length > 512) continue;
      if (isOllama && (item.remote_model || item.remote_host || isCloudOllamaName(id))) continue;
      models.set(id, {
        id, provider: provider.id,
        ...(isOllama ? {
          size: Number.isFinite(item.size) && item.size > 0 ? item.size : null,
          family: safeString(item.details?.family),
          parameters: safeString(item.details?.parameter_size),
        } : {}),
      });
    }
    return { id: provider.id, status: 'connected', models: [...models.values()] };
  } catch {
    return { id: provider.id, status: 'unreachable', models: [] };
  }
}

async function* lines(body) {
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      if (newline > maxSegment) throw new Error('Antwortsegment der Laufzeit zu groß.');
      yield buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
    }
    if (buffer.length > maxSegment) throw new Error('Antwortsegment der Laufzeit zu groß.');
  }
  buffer += decoder.decode();
  if (buffer) yield buffer.replace(/\r$/, '');
}

async function* sseEvents(body) {
  let event = [];
  let size = 0;
  for await (const line of lines(body)) {
    if (line === '') {
      if (event.length) yield event.join('\n');
      event = [];
      size = 0;
    } else if (line.startsWith('data:')) {
      const data = line.slice(5).replace(/^ /, '');
      size += data.length;
      if (size > maxSegment) throw new Error('Antwortsegment der Laufzeit zu groß.');
      event.push(data);
    }
  }
  if (event.length) yield event.join('\n');
}

async function writeEvent(response, item, signal) {
  if (response.destroyed || signal.aborted) return;
  if (!response.write(`${JSON.stringify(item)}\n`)) await once(response, 'drain', { signal });
}

async function streamResponse(response, provider, path, data, timeout, run) {
  if (response.destroyed) return;
  const client = new AbortController();
  const deadline = AbortSignal.timeout(timeout);
  const signal = AbortSignal.any([client.signal, deadline]);
  response.once('close', () => client.abort());
  const emit = item => writeEvent(response, item, signal);
  try {
    const result = await upstream(provider, path, signal, data);
    if (!result.ok) {
      let problem = '';
      try {
        if (result.headers.get('content-type')?.includes('json')) {
          const payload = await upstreamJson(result, 64_000);
          problem = safeString(payload?.error?.message ?? payload?.error, 400);
        } else {
          await result.body?.cancel();
        }
      } catch { /* use the generic upstream error */ }
      throw new HttpError(502, problem || `Die Laufzeit hat die Anfrage abgelehnt (HTTP ${result.status}).`);
    }
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    await run(result, emit);
    await emit({ done: true });
  } catch (error) {
    if (client.signal.aborted) return;
    const message = deadline.aborted ? 'Die lokale Laufzeit hat nicht rechtzeitig geantwortet.'
      : error instanceof HttpError ? error.message : 'Die Verbindung zur lokalen Laufzeit wurde unterbrochen.';
    if (!response.headersSent) return json(response, deadline.aborted ? 504 : (error.status ?? 502), { error: message });
    if (!response.destroyed) response.write(`${JSON.stringify({ error: message })}\n`);
  } finally {
    response.end();
    // Stop upstream work on parse errors as well as normal client disconnects.
    client.abort();
  }
}

async function emitChatText(emit, text, reasoning) {
  const item = {};
  if (typeof text === 'string' && text) item.text = text;
  if (typeof reasoning === 'string' && reasoning) item.reasoning = reasoning;
  if (item.text || item.reasoning) await emit(item);
}

async function chat(response, provider, model, messages) {
  const isOllama = provider.type === 'ollama';
  const params = { model, messages, stream: true };
  await streamResponse(response, provider, isOllama ? '/api/chat' : '/chat/completions', params, 15 * 60_000, async (result, emit) => {
    if (!result.body) throw new Error('Keine Antwort der Laufzeit.');
    let complete = false;
    if (isOllama) {
      for await (const line of lines(result.body)) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.error) throw new HttpError(502, safeString(event.error, 400) || 'Die Laufzeit hat einen Fehler gemeldet.');
        await emitChatText(emit, event.message?.content, event.message?.thinking);
        if (event.done === true) { complete = true; break; }
      }
    } else if (result.headers.get('content-type')?.includes('text/event-stream')) {
      for await (const data of sseEvents(result.body)) {
        if (data === '[DONE]') { complete = true; break; }
        const event = JSON.parse(data);
        if (event.error) throw new HttpError(502, safeString(event.error.message ?? event.error, 400) || 'Die Laufzeit hat einen Fehler gemeldet.');
        const delta = event.choices?.[0]?.delta;
        await emitChatText(emit, delta?.content, delta?.reasoning_content ?? delta?.reasoning);
        if (event.choices?.[0]?.finish_reason) complete = true;
      }
    } else {
      const message = (await upstreamJson(result, maxSegment)).choices?.[0]?.message;
      if (typeof message?.content !== 'string') throw new HttpError(502, 'Die Laufzeit hat keinen Chat-Text zurückgegeben.');
      await emitChatText(emit, message.content, message.reasoning_content ?? message.reasoning);
      complete = true;
    }
    if (!complete) throw new HttpError(502, 'Die Antwort der Laufzeit ist unvollständig.');
  });
}

async function pull(response, provider, model) {
  await streamResponse(response, provider, '/api/pull', { model, stream: true }, 2 * 60 * 60_000, async (result, emit) => {
    if (!result.body) throw new Error('Keine Antwort der Laufzeit.');
    let complete = false;
    for await (const line of lines(result.body)) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.error) throw new HttpError(502, safeString(event.error, 400) || 'Der Download ist fehlgeschlagen.');
      const status = safeString(event.status, 120);
      const total = Number.isFinite(event.total) && event.total > 0 ? event.total : null;
      const completed = total && Number.isFinite(event.completed) ? Math.max(0, Math.min(total, event.completed)) : null;
      await emit({ status, total, completed });
      if (status === 'success') { complete = true; break; }
    }
    if (!complete) throw new HttpError(502, 'Ollama hat den Download nicht abgeschlossen.');
  });
}

async function staticFile(req, response, path, mode, sourceRef) {
  const filename = resolve(publicDir, `.${path === '/' ? '/index.html' : path}`);
  if (!filename.startsWith(`${publicDir}${sep}`) || !Object.hasOwn(mimes, extname(filename))) {
    return json(response, 404, { error: 'Seite nicht gefunden.' });
  }
  if (extname(filename) === '.html') {
    const html = (await readFile(filename, 'utf8').catch(() => null))
      ?.replace('name="modelwerk-mode" content="static"', `name="modelwerk-mode" content="${mode}"`)
      .replace('name="modelwerk-source-ref" content="main"', `name="modelwerk-source-ref" content="${sourceRef}"`);
    if (!html) return json(response, 404, { error: 'Seite nicht gefunden.' });
    response.writeHead(200, { 'Content-Type': mimes['.html'], 'Cache-Control': 'no-cache' });
    return response.end(req.method === 'HEAD' ? undefined : html);
  }
  const info = await stat(filename).catch(() => null);
  if (!info?.isFile()) return json(response, 404, { error: 'Datei nicht gefunden.' });
  response.writeHead(200, { 'Content-Type': mimes[extname(filename)], 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
  if (req.method === 'HEAD') return response.end();
  const stream = createReadStream(filename);
  stream.on('error', () => response.destroy());
  response.once('close', () => stream.destroy());
  stream.pipe(response);
}

export function createModelwerkServer({ mode = 'local', env = process.env } = {}) {
  if (mode !== 'local' && mode !== 'preview') throw new Error('Ungültiger Startmodus.');
  const providers = mode === 'local' ? providersFrom(env) : [];
  const sourceRef = mode === 'preview' && /^[a-z0-9][a-z0-9._/-]{0,139}$/i.test(env.MODELWERK_SOURCE_REF ?? '') ? env.MODELWERK_SOURCE_REF : 'main';
  let activePull = false;
  const server = createServer(async (req, response) => {
    for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
    try {
      if (mode === 'local') {
        response.setHeader('Content-Security-Policy', `${headers['Content-Security-Policy']}; frame-ancestors 'none'`);
        response.setHeader('X-Frame-Options', 'DENY');
        if (!validLocalHost(req.headers.host, server.address()?.port)) throw new HttpError(403, 'Diese Seite ist nur unter ihrer lokalen Adresse verfügbar.');
      }
      const path = decodeURIComponent(new URL(req.url, 'http://modelwerk.invalid').pathname);
      if (path.startsWith('/api/')) {
        if (mode === 'preview') {
          if (req.method === 'GET' && path === '/api/models') return json(response, 200, { mode, providers: [], models: [] });
          throw new HttpError(403, 'Starte Modelwerk lokal, um deine Modelle zu verwenden.');
        }
        requireSameOrigin(req);
        if (path === '/api/models' && req.method === 'GET') {
          const found = await Promise.all(providers.map(discover));
          return json(response, 200, {
            mode, providers: found.map(({ id, status, models }) => ({ id, status, count: models.length })),
            models: found.flatMap(entry => entry.models),
          });
        }
        if (path === '/api/chat' && req.method === 'POST') {
          const body = await bodyJson(req);
          const provider = providers.find(item => item.id === body?.provider && item.base);
          const { model, messages } = body ?? {};
          if (!provider || typeof model !== 'string' || !model.trim() || model.length > 512 ||
              !Array.isArray(messages) || !messages.length || messages.length > 32 || messages.at(-1)?.role !== 'user' ||
              messages.some(item => !['user', 'assistant'].includes(item?.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > 48_000)) {
            throw new HttpError(400, 'Bitte wähle eine lokale Laufzeit und sende eine gültige Nachricht.');
          }
          if (provider.type === 'ollama') {
            const runtime = await discover(provider);
            if (runtime.status !== 'connected') throw new HttpError(502, 'Ollama ist gerade nicht erreichbar.');
            if (!runtime.models.some(item => item.id === model)) throw new HttpError(400, 'Dieses Modell ist nicht lokal in Ollama verfügbar. Aktualisiere die Modellliste.');
          }
          return await chat(response, provider, model, messages.map(({ role, content }) => ({ role, content })));
        }
        if (path === '/api/pull' && req.method === 'POST') {
          const { model } = await bodyJson(req) ?? {};
          if (!validOllamaName(model)) throw new HttpError(400, 'Ungültiger Ollama-Modellname.');
          if (isCloudOllamaName(model)) throw new HttpError(400, 'Modelwerk installiert nur lokale Modelle, keine Cloud-Varianten.');
          if (activePull) throw new HttpError(409, 'Ein Download läuft bereits.');
          activePull = true;
          try { return await pull(response, providers[0], model); }
          finally { activePull = false; }
        }
        throw new HttpError(404, 'Dieser API-Endpunkt ist nicht verfügbar.');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Methode nicht erlaubt.');
      await staticFile(req, response, path, mode, sourceRef);
    } catch (error) {
      const status = error instanceof URIError ? 400 : (error instanceof HttpError ? error.status : 500);
      if (!response.headersSent && !response.destroyed) json(response, status, { error: status === 500 ? 'Modelwerk konnte die Anfrage nicht bearbeiten.' : error.message });
      else if (!response.writableEnded) response.destroy();
    }
  });
  return server;
}

function openBrowser(url) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
  child.on('error', () => console.log(`Bitte öffne ${url} manuell.`));
  child.unref();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv.includes('--preview') ? 'preview' : 'local';
  const host = mode === 'preview' ? '0.0.0.0' : '127.0.0.1';
  const port = Number(process.env.PORT || 3210);
  try {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT muss zwischen 1 und 65535 liegen.');
    const server = createModelwerkServer({ mode });
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} ist schon belegt. Wähle einen anderen PORT.` : error.message);
      process.exitCode = 1;
    });
    server.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      console.log(`Modelwerk ${mode === 'preview' ? '(Web-Vorschau)' : '(lokal)'}: ${url}`);
      if (mode === 'local' && process.argv.includes('--open')) openBrowser(url);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
