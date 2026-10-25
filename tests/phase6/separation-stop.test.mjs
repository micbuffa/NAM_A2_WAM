import test from 'node:test';
import assert from 'node:assert/strict';
import {separationStopState,requestSeparationStop} from '../../examples/wam/source-separation/SeparationStopControl.js';
test('stop control stays discoverable, enabled only during active work, and locks while stopping',()=>{
 assert.deepEqual(separationStopState(false),{disabled:true,label:'Stopper la séparation'});
 assert.equal(separationStopState(true).disabled,false);
 assert.deepEqual(separationStopState(true,true),{disabled:true,label:'Arrêt en cours…'});
 assert.deepEqual(separationStopState(false,true),separationStopState(false));
});
test('stop locks before cancelling every backend; idle and duplicate requests cannot kill a later preparation',()=>{
 const calls=[],runners=Array.from({length:4},(_,i)=>({cancel:()=>calls.push(i)}));
 const options={busy:true,requested:false,runners,onRequest:()=>calls.push('lock')};
 assert.equal(requestSeparationStop(options),true);assert.deepEqual(calls,['lock',0,1,2,3]);
 calls.length=0;assert.equal(requestSeparationStop({...options,requested:true}),false);assert.equal(requestSeparationStop({...options,busy:false}),false);assert.deepEqual(calls,[]);
});
