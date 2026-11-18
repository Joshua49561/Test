import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalog, categories, families, featuredCatalog } from '../public/catalog.js';
import { isCloudOllamaName, validOllamaName, validLMStudioModel } from '../public/model-name.js';

const variants = family => catalog.filter(entry => entry.family === family).map(entry => entry.id).sort();

test('GPT-OSS und Gemma enthalten die lokalen Standardvarianten der Modellfamilien', () => {
  assert.deepEqual(variants('gpt-oss'), ['gpt-oss:120b', 'gpt-oss:20b']);
  assert.deepEqual(variants('gemma'), [
    'gemma:2b', 'gemma:7b', 'gemma2:2b', 'gemma2:9b', 'gemma2:27b',
    'gemma3:270m', 'gemma3:1b', 'gemma3:4b', 'gemma3:12b', 'gemma3:27b', 'gemma3n:e2b', 'gemma3n:e4b',
    'gemma4:e2b', 'gemma4:e4b', 'gemma4:12b', 'gemma4:26b', 'gemma4:31b',
  ].sort());
  assert.deepEqual(featuredCatalog.map(entry => entry.id), ['llama3.2:3b', 'gpt-oss:20b', 'gemma4:e2b']);
});

test('Katalogmodelle und Aliase sind eindeutig, installierbar und korrekt kategorisiert', () => {
  const ids = new Set();
  for (const entry of catalog) {
    assert.ok(entry.description && entry.params && entry.size, entry.id);
    assert.ok(!entry.family || families.some(family => family.id === entry.family), entry.id);
    assert.ok(entry.tags.length && entry.tags.every(tag => categories.includes(tag)), entry.id);
    for (const id of [entry.id, ...(entry.aliases ?? [])]) {
      assert.ok(validOllamaName(id) && !isCloudOllamaName(id), id);
      assert.ok(!ids.has(id), `Wiederholtes Tag: ${id}`);
      ids.add(id);
    }
  }
});


test('direkt verknüpfte LM-Studio-Karten besitzen gültige und eindeutige Katalog-IDs', () => {
  const ids = catalog.filter(entry => entry.lmstudio).map(entry => entry.lmstudio);
  assert.ok(ids.includes('openai/gpt-oss-20b'));
  assert.ok(ids.includes('openai/gpt-oss-120b'));
  assert.ok(ids.includes('google/gemma-4-e2b'));
  assert.ok(ids.every(validLMStudioModel));
  assert.equal(new Set(ids).size, ids.length);
});
