import test from 'node:test';
import assert from 'node:assert/strict';
import {guitarCorrection} from '../../src/nam-wam/GuitarCalibration.js';
test('guitar calibration matches quiet and driven models at the same output target',()=>{
 const driven=guitarCorrection(-19,-5),clean=guitarCorrection(-48,-27);
 assert.equal(-19+driven.compensationDb,-24);
 assert.equal(-48+clean.compensationDb,-24);
 assert.ok(clean.compensationDb>12);
 assert.equal(clean.clamped,false);
});
test('guitar calibration preserves peak headroom and reports unreachable targets',()=>{
 const result=guitarCorrection(-40,-10);
 assert.equal(result.compensationDb,9);assert.equal(result.peakLimited,true);assert.equal(result.clamped,true);
 assert.equal(guitarCorrection(-70,-60).compensationDb,36);
 assert.throws(()=>guitarCorrection(-Infinity,-Infinity),/silent/);
 assert.throws(()=>guitarCorrection(-100,-90),/silent/);
});
