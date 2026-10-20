import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ModelDownloadManager, modelKey, sha256} from '../../examples/wam/source-separation/ModelDownloadManager.js';
import {detectCapabilities} from '../../examples/wam/source-separation/Capabilities.js';

const bytes = new TextEncoder().encode('weights-fixture').buffer;
async function fixture(options = {}) {
  const records = new Map(); const requests = [];
  const cache = {get: async key => records.get(key), put: async record => records.set(record.key, record), delete: async key => records.delete(key)};
  const model = {id: 'test', version: '1', label: 'Test', license: {name: 'MIT', url: 'https://example.org/license'},
    files: [{url: './weights.bin', size: bytes.byteLength, sha256: await sha256(bytes)}]};
  const manager = new ModelDownloadManager({cache, baseURL: 'https://example.org/prototype/',
    fetchImpl: async (url, init) => { requests.push({url, init}); return new Response(bytes.slice(0)); }, ...options});
  return {manager, cache, model, records, requests};
}

test('real bytes are verified, cached and reused without network; removal allows a new download', async () => {
  const {manager, model, records, requests} = await fixture();
  const progress = []; manager.addEventListener('progress', e => progress.push(e.detail));
  await manager.download(model);
  assert.equal((await manager.getStatus(model)).state, 'installed');
  assert.equal(records.size, 1); assert.equal(requests.length, 1);
  assert.equal(requests[0].init.credentials, 'omit');
  await manager.download(model); assert.equal(requests.length, 1);
  assert.ok(progress.some(state => state.state === 'verifying'));
  assert.equal(progress.at(-1).cached, true);
  await manager.remove(model); assert.equal((await manager.getStatus(model)).state, 'missing');
  await manager.download(model); assert.equal(requests.length, 2);
});

test('concurrent requests share one task and version/hash changes produce independent keys', async () => {
  const {manager, model, requests} = await fixture();
  const first = manager.download(model); const second = manager.download(model);
  assert.equal(first, second); await first; assert.equal(requests.length, 1);
  assert.notEqual(modelKey(model), modelKey({...model, version: '2'}));
  assert.notEqual(modelKey(model), modelKey({...model, files: [{...model.files[0], sha256: 'a'.repeat(64)}]}));
});

test('invalid hash, wrong size, truncated file and HTTP failure never publish an installation', async () => {
  for (const response of [() => new Response(new Uint8Array(bytes.byteLength)),
    () => new Response(new Uint8Array(bytes.byteLength + 1)), () => new Response('short'),
    () => new Response('error', {status: 404})]) {
    const {manager, model, records} = await fixture({fetchImpl: async () => response()});
    await assert.rejects(manager.download(model)); assert.equal(records.size, 0);
    assert.equal(manager.states.get(model.id).state, 'error');
  }
});

test('partial multi-file download does not publish any files and leaves previous version intact', async () => {
  let calls = 0;
  const {manager, model, records} = await fixture({fetchImpl: async () => ++calls === 1 ? new Response(bytes.slice(0)) : new Response('failure', {status: 500})});
  records.set('old-version', {id: 'test', version: 'old'});
  model.files.push({...model.files[0], url: './second.bin'});
  await assert.rejects(manager.download(model));
  assert.equal(records.size, 1); assert.ok(records.has('old-version'));
});

test('cancelling during stream transfer discards partial bytes and permits retry', async () => {
  let manager;
  const data = await fixture({fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(bytes).slice(0, 2)); },
  }))});
  manager = data.manager;
  manager.addEventListener('progress', e => { if (e.detail.received === 2) manager.cancel(data.model.id); });
  await assert.rejects(manager.download(data.model), {name: 'AbortError'});
  assert.equal(data.records.size, 0); assert.equal(manager.tasks.size, 0);
  manager.fetch = async () => new Response(bytes.slice(0)); await manager.download(data.model);
  assert.equal((await manager.getStatus(data.model)).state, 'installed');
});

test('cache quota failure reports a useful message and never reports installed', async () => {
  const {manager, model, cache} = await fixture();
  cache.put = async () => { throw new DOMException('quota', 'QuotaExceededError'); };
  await assert.rejects(manager.download(model), {name: 'QuotaExceededError'});
  assert.equal(manager.states.get(model.id).message, 'Espace de stockage insuffisant.');
});

test('cache corruption is detected, then a successful download repairs it', async () => {
  const {manager, model, records} = await fixture(); await manager.download(model);
  records.get(modelKey(model)).files[0] = new Uint8Array(bytes.byteLength).buffer;
  assert.equal((await manager.getStatus(model)).state, 'corrupt');
  await manager.download(model); assert.equal((await manager.getStatus(model)).state, 'installed');
});

test('invalid metadata and unsafe origins are rejected before fetching', async () => {
  const {manager, model, requests} = await fixture();
  for (const invalid of [{...model, license: null}, {...model, version: null},
    {...model, files: [{...model.files[0], sha256: 'invalid'}]},
    {...model, files: [{...model.files[0], url: 'https://evil.example/weights'}]},
    {...model, files: [{...model.files[0], url: 'javascript:alert(1)'}]}]) await assert.rejects(manager.download(invalid));
  assert.equal(requests.length, 0);
});

test('WebGPU probing checks adapter and device, releases the device and handles failures', async () => {
  assert.equal((await detectCapabilities({})).webgpu, false);
  assert.equal((await detectCapabilities({gpu: {requestAdapter: async () => null}})).webgpu, false);
  let destroyed = false;
  assert.equal((await detectCapabilities({gpu: {requestAdapter: async () => ({requestDevice: async () => ({destroy() { destroyed = true; }})})}})).webgpu, true);
  assert.equal(destroyed, true);
  assert.equal((await detectCapabilities({gpu: {requestAdapter: async () => { throw Error('denied'); }}})).webgpu, false);
});

test('shipped diagnostic catalog hashes match the actual downloaded files', async () => {
  const base = new URL('../../examples/wam/source-separation/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('fixtures/catalog.json', base)));
  assert.equal(manifest.version, 1); assert.equal(manifest.models.length, 2);
  for (const model of manifest.models) for (const file of model.files) {
    const data = await readFile(new URL(file.url, base));
    assert.equal(data.byteLength, file.size); assert.equal(await sha256(data), file.sha256);
    assert.equal(model.kind, 'fixture'); assert.equal(model.roles.length, 0);
  }
});
