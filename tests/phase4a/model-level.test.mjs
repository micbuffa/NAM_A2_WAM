import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_LOUDNESS_TARGET_DB, measuredModelLevelCompensationDb, modelLevelCompensationDb, modelLoudnessFromNam} from '../../src/nam-wam/ModelLevel.js';

test('NAM loudness normalization targets -18 dB and preserves relative capture levels', () => {
  assert.equal(MODEL_LOUDNESS_TARGET_DB, -18);
  assert.ok(Math.abs(modelLevelCompensationDb(-23.36697769165039) - 5.366977691650391) < 1e-9);
  assert.ok(Math.abs(modelLevelCompensationDb(-15.65613842010498) + 2.3438615798950195) < 1e-9);
});

test('NAM loudness normalization is optional, finite-safe, and bounded', () => {
  assert.equal(modelLevelCompensationDb(-40), 12);
  assert.equal(modelLevelCompensationDb(5), -12);
  assert.equal(modelLevelCompensationDb(undefined), 0);
  assert.equal(modelLevelCompensationDb(null), 0);
  assert.equal(modelLevelCompensationDb(-23, false), 0);
});

test('slimmable TONE3000 models use the active submodel loudness with a container fallback', () => {
  const slimmable = {metadata:{loudness:-19},config:{submodels:[
    {model:{metadata:{loudness:-25}}}, {model:{metadata:{loudness:-14}}},
  ]}};
  assert.equal(modelLoudnessFromNam(slimmable, 'lite'), -25);
  assert.equal(modelLoudnessFromNam(slimmable, 'full'), -14);
  assert.equal(modelLoudnessFromNam({metadata:{loudness:-21}}, 'full'), -21);
  assert.equal(modelLoudnessFromNam({metadata:{}}, 'full'), null);
});

test('measured calibration targets -18 dBFS with correction and peak safety limits', () => {
  assert.deepEqual(measuredModelLevelCompensationDb(-28, -24), {
    compensationDb:10, requestedDb:10, peakLimited:false, clamped:false,
  });
  assert.equal(measuredModelLevelCompensationDb(-40, -30).compensationDb, 12);
  const peakLimited = measuredModelLevelCompensationDb(-24, -3);
  assert.equal(peakLimited.compensationDb, 2);
  assert.equal(peakLimited.peakLimited, true);
  assert.equal(measuredModelLevelCompensationDb(-120, -110), null);
});
