import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_PROTOCOL,validateGameManifest,scoreGameStems} from '../../examples/wam/source-separation/LocalGameEvaluation.js';
const fixture=()=>({protocol:GAME_PROTOCOL,frames:264600,sampleRate:44100,redistributeAudio:false,recommendationEligible:false,trainingExposure:'unknown',cases:[1,2,3].flatMap(i=>[20,90].map(t=>({id:`gha-${i}-${t}`,frames:264600,sampleRate:44100,target:'guitar',otherIsGuitar:false,offsetSeconds:t,files:Object.fromEntries(['mix','reference','backing','rhythm'].map(r=>[r,{path:`gha-${i}-${t}/${r}.wav`,sha256:'a'.repeat(64)}]))})))});
test('six frozen game windows accepted without upgrading provenance',()=>assert.equal(validateGameManifest(fixture()).recommendationEligible,false));
test('reject shifted or duplicate windows, sample changes and missing references',()=>{
 for(const mutate of [m=>m.cases[0].offsetSeconds=21,m=>m.cases[0]=m.cases[1],m=>m.cases[0].frames=1,m=>delete m.cases[0].files.rhythm,m=>m.cases.pop()]){const m=fixture();mutate(m);assert.throws(()=>validateGameManifest(m));}
});
test('reject promotion to recommendation or unverified purity claims',()=>{
 for(const mutate of [m=>m.recommendationEligible=true,m=>m.trainingExposure='independent',m=>m.cases[0].otherIsGuitar=true,m=>m.redistributeAudio=true]){const m=fixture();mutate(m);assert.throws(()=>validateGameManifest(m));}
});
const signal=(phase=0)=>[0,1].map(()=>Float32Array.from({length:64},(_,i)=>Math.sin(i*.3+phase)*.1));
test('dedicated guitar scores and provisional rhythm stay explicitly separated',()=>{
 const guitar=signal(),bass=signal(1),mix=guitar.map((c,k)=>Float32Array.from(c,(x,i)=>x+bass[k][i]));
 const s=scoreGameStems({roles:['guitar','bass']},[...guitar,...bass],{reference:guitar,backing:bass,rhythm:bass,mix});
 assert.equal(s.assignedGuitar.valid,true);assert.equal(s.provisionalRhythm.valid,true);assert.equal(s.recommendationEligible,false);assert.equal(s.assignedGuitar.siSdrDb,120);
});
test('Other cannot substitute the unqualified game guitar stem',()=>assert.throws(()=>scoreGameStems({roles:['other','bass']},[],{}),/Autres/));
