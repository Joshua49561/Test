import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { isCloudOllamaName, validOllamaName, isHuggingFaceRepo, validLMStudioModel, validLMStudioQuantization } from './public/model-name.js';
import { defaultRuntimes, runtimes } from './public/runtimes.js';

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
  try { if (typeof raw === 'string' && raw.length <= 512) url = new URL(raw); } catch { /* reported below */ }
  if (!url || !['http:', 'https:'].includes(url.protocol) || !loopback.has(url.hostname) || url.username || url.password || url.hash || url.search) {
    throw new Error(`${key} muss eine lokale HTTP(S)-Adresse sein (localhost, 127.0.0.1 oder [::1]).`);
  }
  return url.href.replace(/\/+$/, '');
}

function runtimeConfig(id, rawBase, key, field = 'Adresse') {
  const type = id === 'ollama' || id === 'lmstudio' ? id : 'openai';
  let base = rawBase === null ? null : localBase(rawBase, field);
  if (type === 'lmstudio') {
    const root = base.replace(/(?:\/api)?\/v1$/, '');
    return { id, type, base: `${root}/v1`, nativeBase: `${root}/api/v1`, key };
  }
  if (type === 'openai' && base && new URL(base).pathname === '/') base += '/v1';
  return { id, type, base, key };
}

function providersFrom(env) {
  const [ollama, lmstudio] = defaultRuntimes;
  return new Map([
    ['ollama', runtimeConfig('ollama', env.MODELWERK_OLLAMA_URL || ollama.base, undefined, 'MODELWERK_OLLAMA_URL')],
    ['lmstudio', runtimeConfig('lmstudio', env.MODELWERK_LMSTUDIO_URL || lmstudio.base, env.MODELWERK_LMSTUDIO_KEY, 'MODELWERK_LMSTUDIO_URL')],
    ['compatible', runtimeConfig('compatible', env.MODELWERK_OPENAI_URL || null, env.MODELWERK_OPENAI_KEY, 'MODELWERK_OPENAI_URL')],
  ]);
}

function configureRuntime(providers, defaults, body, port) {
  const { id, base, apiKey, reset } = body ?? {};
  if (!runtimes.some(runtime => runtime.id === id)) throw new HttpError(400, 'Unbekannte Laufzeit.');
  if (reset === true) {
    if (defaults.has(id)) providers.set(id, defaults.get(id));
    else providers.delete(id);
    return;
  }
  if (apiKey !== undefined && (typeof apiKey !== 'string' || apiKey.length > 4096 || !/^[\x21-\x7e]*$/.test(apiKey))) {
    throw new HttpError(400, 'Der API-Schlüssel ist ungültig.');
  }
  let config;
  try {
    if (typeof base !== 'string' || !base.trim()) throw new Error('Bitte gib die lokale API-Adresse ein.');
    config = runtimeConfig(id, base.trim(), apiKey);
    const url = new URL(config.base);
    if (Number(url.port || (url.protocol === 'https:' ? 443 : 80)) === port) throw new Error('Wähle den Port der Laufzeit, nicht den von Modelwerk.');
  } catch (error) { throw new HttpError(400, error.message); }
  const previous = providers.get(id);
  if (apiKey === undefined && config.base === previous?.base) config.key = previous.key;
  providers.set(id, config);
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

function upstream(provider, path, signal, data, base = provider.base) {
  return fetch(`${base}${path}`, {
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

const validModelId = id => typeof id === 'string' && Boolean(id.trim()) && id.length <= 512;
const modelSize = bytes => Number.isFinite(bytes) && bytes > 0 ? bytes : null;

async function listModels(provider, signal, native = false) {
  const isOllama = provider.type === 'ollama';
  try {
    const result = await upstream(provider, isOllama ? '/api/tags' : '/models', signal, undefined, native ? provider.nativeBase : provider.base);
    if (!result.ok) {
      await result.body?.cancel();
      return { status: result.status === 401 || result.status === 403 ? 'auth-required' : 'unreachable', entries: [] };
    }
    const payload = await upstreamJson(result, 4 * 1024 * 1024);
    const entries = isOllama || native ? payload?.models : payload?.data;
    if (Array.isArray(entries)) return { status: 'connected', entries };
  } catch { /* Fall back to the compatible API when the native API is unavailable. */ }
  return { status: 'unreachable', entries: [] };
}

const nativeChatModel = entry => entry?.type === 'llm' && validModelId(entry.key);
const loadedInstance = model => Array.isArray(model.loaded_instances)
  ? model.loaded_instances.find(instance => validModelId(instance?.id))?.id : undefined;

async function discover(provider) {
  if (!provider.base) return { status: 'not-configured', models: [], download: false };
  const isOllama = provider.type === 'ollama';
  const native = provider.type === 'lmstudio' ? await listModels(provider, AbortSignal.timeout(2200), true) : null;
  if (native?.status === 'connected') {
    const models = new Map();
    for (const item of native.entries.filter(nativeChatModel)) {
      models.set(item.key, {
        id: item.key, provider: provider.id, name: safeString(item.display_name),
        size: modelSize(item.size_bytes), parameters: safeString(item.params_string),
        quantization: safeString(item.quantization?.name), loaded: Boolean(loadedInstance(item)),
      });
    }
    return { status: 'connected', models: [...models.values()], download: true };
  }
  const { status, entries } = await listModels(provider, AbortSignal.timeout(2600));
  const models = new Map();
  for (const item of entries) {
    const id = isOllama ? item?.name || item?.model : item?.id;
    if (!validModelId(id)) continue;
    if (isOllama && (item.remote_model || item.remote_host || isCloudOllamaName(id))) continue;
    models.set(id, {
      id, provider: provider.id,
      ...(isOllama ? {
        size: modelSize(item.size), family: safeString(item.details?.family),
        parameters: safeString(item.details?.parameter_size),
      } : {}),
    });
  }
  return {
    status: status === 'unreachable' && native?.status === 'auth-required' ? 'auth-required' : status,
    models: [...models.values()], download: isOllama && status === 'connected',
  };
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

async function upstreamProblem(result, fallback) {
  let problem;
  try {
    if (result.headers.get('content-type')?.includes('json')) {
      const payload = await upstreamJson(result, 64_000);
      problem = safeString(payload?.error?.message ?? payload?.error, 400);
    } else await result.body?.cancel();
  } catch { /* use the generic upstream error */ }
  return new HttpError(502, problem || fallback || `Die Laufzeit hat die Anfrage abgelehnt (HTTP ${result.status}).`);
}

async function streamResponse(response, timeout, request, run) {
  if (response.destroyed) return;
  const client = new AbortController();
  const deadline = AbortSignal.timeout(timeout);
  const signal = AbortSignal.any([client.signal, deadline]);
  response.once('close', () => client.abort());
  const emit = item => writeEvent(response, item, signal);
  try {
    const result = await request(signal);
    if (!result.ok) throw await upstreamProblem(result);
    response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    await run(result, emit, signal);
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

async function prepareLMStudioModel(provider, model, signal) {
  const listSignal = AbortSignal.any([signal, AbortSignal.timeout(2600)]);
  const { entries } = await listModels(provider, listSignal, true);
  const entry = entries.find(item => nativeChatModel(item) && item.key === model);
  if (!entry) return model; // The OpenAI-compatible endpoint also supports older versions of LM Studio.
  const loaded = loadedInstance(entry);
  if (loaded) return loaded;
  const result = await upstream(provider, '/models/load', signal, { model }, provider.nativeBase);
  if (!result.ok) throw await upstreamProblem(result, 'LM Studio konnte das Modell nicht laden.');
  const payload = await upstreamJson(result, 64_000);
  if (payload?.status !== 'loaded' || !validModelId(payload.instance_id)) throw new HttpError(502, 'LM Studio hat keine geladene Modellinstanz zurückgegeben.');
  return payload.instance_id;
}

async function chat(response, provider, model, messages) {
  const isOllama = provider.type === 'ollama';
  const request = async signal => {
    const id = provider.type === 'lmstudio' ? await prepareLMStudioModel(provider, model, signal) : model;
    return upstream(provider, isOllama ? '/api/chat' : '/chat/completions', signal, { model: id, messages, stream: true });
  };
  await streamResponse(response, 15 * 60_000, request, async (result, emit) => {
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
  const request = signal => upstream(provider, '/api/pull', signal, { model, stream: true });
  await streamResponse(response, 2 * 60 * 60_000, request, async (result, emit) => {
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

async function pullLMStudio(response, provider, model, quantization) {
  const request = signal => upstream(provider, '/models/download', AbortSignal.any([signal, AbortSignal.timeout(30_000)]), {
    model, ...(quantization ? { quantization } : {}),
  }, provider.nativeBase);
  await streamResponse(response, 2 * 60 * 60_000, request, async (result, emit, signal) => {
    let job = await upstreamJson(result, 64_000);
    const jobId = job?.job_id;
    while (!signal.aborted) {
      if (job?.status === 'completed' || job?.status === 'already_downloaded') {
        await emit({ status: 'success' });
        return;
      }
      if (job?.status === 'failed') throw new HttpError(502, 'Der Download in LM Studio ist fehlgeschlagen. Prüfe ihn in LM Studio.');
      if (!['downloading', 'paused'].includes(job?.status) || typeof jobId !== 'string' || !/^[a-z0-9_-]{1,160}$/i.test(jobId)) {
        throw new HttpError(502, 'LM Studio hat keinen gültigen Download-Status zurückgegeben.');
      }
      const total = modelSize(job.total_size_bytes);
      const completed = total && Number.isFinite(job.downloaded_bytes) ? Math.max(0, Math.min(total, job.downloaded_bytes)) : null;
      await emit({ status: job.status === 'paused' ? 'paused' : 'downloading', total, completed });
      await delay(1000, undefined, { signal });
      const status = await upstream(provider, `/models/download/status/${jobId}`, AbortSignal.any([signal, AbortSignal.timeout(10_000)]), undefined, provider.nativeBase);
      if (!status.ok) throw await upstreamProblem(status, 'Der Download-Status ist nicht erreichbar. Prüfe den Download in LM Studio.');
      job = await upstreamJson(status, 64_000);
    }
    signal.throwIfAborted();
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
  const defaults = mode === 'local' ? providersFrom(env) : new Map();
  const providers = new Map(defaults);
  const sourceRef = mode === 'preview' && /^[a-z0-9][a-z0-9._/-]{0,139}$/i.test(env.MODELWERK_SOURCE_REF ?? '') ? env.MODELWERK_SOURCE_REF : 'main';
  let activePull = null;
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
          const found = await Promise.all([...providers.values()].map(async provider => ({
            id: provider.id, base: provider.base, hasKey: Boolean(provider.key), ...await discover(provider),
          })));
          return json(response, 200, {
            mode, providers: found.map(({ models, ...info }) => ({ ...info, count: models.length })),
            models: found.flatMap(entry => entry.models),
          });
        }
        if (path === '/api/connection' && req.method === 'POST') {
          const config = await bodyJson(req);
          if (activePull && activePull === config?.id) throw new HttpError(409, 'Beende zuerst den aktiven Download oder seine Anzeige, bevor du diese Laufzeit änderst.');
          configureRuntime(providers, defaults, config, server.address()?.port);
          return json(response, 200, { ok: true });
        }
        if (path === '/api/chat' && req.method === 'POST') {
          const body = await bodyJson(req);
          const provider = providers.get(body?.provider);
          const { model, messages } = body ?? {};
          if (!provider?.base || !validModelId(model) ||
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
          const { provider: id = 'ollama', model, quantization } = await bodyJson(req) ?? {};
          const provider = providers.get(id);
          if (!provider?.base || !['ollama', 'lmstudio'].includes(id)) throw new HttpError(400, 'Diese Laufzeit unterstützt keine Downloads in Modelwerk.');
          if (id === 'ollama') {
            if (!validOllamaName(model)) throw new HttpError(400, 'Ungültiger Ollama-Modellname.');
            if (isCloudOllamaName(model)) throw new HttpError(400, 'Modelwerk installiert nur lokale Modelle, keine Cloud-Varianten.');
          } else {
            if (!validLMStudioModel(model)) throw new HttpError(400, 'Gib eine LM-Studio-Katalog-ID oder eine Hugging-Face-Modell-URL ein.');
            if (quantization !== undefined && (!isHuggingFaceRepo(model) || !validLMStudioQuantization(quantization))) {
              throw new HttpError(400, 'Eine Quantisierung kann nur bei einer Hugging-Face-Modell-URL angegeben werden, z. B. Q4_K_M.');
            }
          }
          if (activePull) throw new HttpError(409, 'Ein Download läuft bereits.');
          activePull = id;
          try {
            return id === 'ollama' ? await pull(response, provider, model) : await pullLMStudio(response, provider, model, quantization);
          } finally { activePull = null; }
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
