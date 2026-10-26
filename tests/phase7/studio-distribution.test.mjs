import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readdir, readFile} from 'node:fs/promises';

import {STUDIO_RUNTIME_ASSETS} from '../../examples/wam/projects/StudioRuntimeAssets.js';

const directory = new URL('../../dist/NAM_A2_WAM/source-separation/', import.meta.url);
test('the product distribution keeps waveform dependencies without the separation laboratory or local weights', async () => {
  assert.deepEqual((await readdir(directory)).sort(), [...new Set(STUDIO_RUNTIME_ASSETS.map(path => path.split('/')[0]))].sort());
  for (const file of ['renderer.js', 'renderer-utils.js', 'event-emitter.js', 'LICENSE', 'NOTICE.md', 'integrity.json']) {
    await access(new URL(`vendor/wavesurfer/${file}`, directory));
  }
});


test('Studio ships precisely the two approved model identities, orders and pinned weights', async () => {
  const {models} = JSON.parse(await readFile(new URL('studio-models.json', directory), 'utf8'));
  assert.deepEqual(models.map(m => m.id), ['htdemucs_4s_onnx', 'bs_roformer_sw_6s']);
  assert.deepEqual(models.map(m => m.roles), [['drums','bass','other','vocals'], ['bass','drums','other','vocals','guitar','piano']]);
  for (const model of models) {
    assert.deepEqual(model.backends, ['webgpu', 'wasm']);
    assert.match(model.files[0].url, /^https:/u);
    assert.match(model.files[0].sha256, /^[a-f0-9]{64}$/u);
  }
  const plan = JSON.parse(await readFile(new URL('roformer-stage-plan.json', directory)));
  assert.equal(plan.sourceSha256, models[1].files[0].sha256);
  assert.equal(plan.sourceBytes, models[1].files[0].size);
});
