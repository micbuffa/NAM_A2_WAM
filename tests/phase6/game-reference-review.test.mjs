import test from 'node:test';import assert from 'node:assert/strict';
import {QUALIFICATION_AXES,qualifyGameCase,qualificationReport} from '../../examples/wam/source-separation/GameReferenceReview.js';
import {gameReviewSource,verifiedGameWav} from '../../examples/wam/source-separation/GameReviewSource.js';
const input=()=>({caseId:'gha-1-20',listener:'auditeur',chain:'casque',answers:Object.fromEntries(QUALIFICATION_AXES.map(k=>[k,k==='backingContainsGuitar'?'no':'yes'])),playedRoles:['reference','backing','rhythm']});
test('qualification requires actual declarations and three playback roles',()=>{
 for(const change of [x=>x.listener='',x=>x.chain='',x=>delete x.answers.guitarOnly,x=>x.playedRoles=['reference'],x=>x.caseId='other']){const x=input();change(x);assert.throws(()=>qualifyGameCase(x));}
});
test('uncertainty is exportable without becoming qualified or independent',()=>{const x=input();x.answers.rhythmIsBass='uncertain';const o=qualifyGameCase(x);assert.equal(o.qualification,'unresolved');assert.equal(o.trainingExposure,'unknown');assert.equal(o.independentCorpus,false);assert.equal(o.recommendationEligible,false);});
test('listener qualified never means independently audited or recommendation eligible',()=>{const o=qualifyGameCase(input(),()=> '2026-10-25T00:00:00Z');assert.equal(o.qualification,'listener-qualified');assert.equal(o.recommendationEligible,false);assert.match(o.playbackCaveat,/do not establish/);});
test('empty report never fabricates human results; duplicate case rejected',()=>{assert.equal(qualificationReport([]).humanResultsAvailable,false);const o=qualifyGameCase(input());assert.equal(qualificationReport([o]).status,'partial');assert.throws(()=>qualificationReport([o,o]));});
test('all six observations required for completed qualification',()=>{const a=[1,2,3].flatMap(i=>[20,90].map(t=>qualifyGameCase({...input(),caseId:`gha-${i}-${t}`})));assert.equal(qualificationReport(a).status,'completed');});
test('game source is unknown and Other is not a guitar reference',()=>{
 const manifest={protocol:'local-game-assigned-stems-v1',sampleRate:44100,frames:264600,redistributeAudio:false,recommendationEligible:false,trainingExposure:'unknown',cases:[1,2,3].flatMap(i=>[20,90].map(t=>({id:`gha-${i}-${t}`,track:'test',offsetSeconds:t,target:'guitar',otherIsGuitar:false,frames:264600,sampleRate:44100,files:Object.fromEntries(['mix','reference','backing','rhythm'].map(r=>[r,{path:`gha-${i}-${t}/${r}.wav`,sha256:'a'.repeat(64)}]))})))};
 const s=gameReviewSource(manifest,'gha-1-20');assert.equal(s.metadata.provenance,'unknown');assert.equal(s.metadata.otherIsGuitar,false);assert.equal(s.evidence.recommendationEligible,false);assert.throws(()=>gameReviewSource(manifest,'missing'));
});
test('corrupt or missing local WAV cannot enter the listening comparison',async()=>{
 const opts={baseURL:'http://localhost/',digest:async()=> 'actual',fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})};
 await assert.rejects(verifiedGameWav({path:'a',sha256:'wrong'},opts),/Empreinte/);assert.equal((await verifiedGameWav({path:'a',sha256:'actual'},opts)).byteLength,4);
 await assert.rejects(verifiedGameWav({path:'a'}, {...opts,fetcher:async()=>({ok:false})}),/absent/);
});
