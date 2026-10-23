import test from 'node:test';
import assert from 'node:assert/strict';
import {ModelSelectionTransaction} from '../../examples/wam/source-separation/ModelSelectionTransaction.js';
const old={modelId:'six',backend:'webgpu',useCase:'guitar'},next={modelId:'four',backend:'wasm'};
test('opening/editing/cancelling settings leaves the running generation intact',()=>{
 const tx=new ModelSelectionTransaction(),token=tx.token();tx.begin(old);old.modelId='six';
 assert.deepEqual(tx.cancel(),old);assert.ok(tx.current(token));assert.equal(tx.draft,null);
});
test('same model/backend confirmation preserves the running job',async()=>{
 const tx=new ModelSelectionTransaction();tx.begin(old);const token=tx.token();
 await tx.commit(old,{stop:()=>assert.fail('stop'),reset:()=>assert.fail('reset'),prepare:async()=>{}});
 assert.ok(tx.current(token));
});
test('confirmation invalidates old callbacks before stopping, resetting, then preparing',async()=>{
 const tx=new ModelSelectionTransaction();tx.begin(old);const token=tx.token(),events=[];
 await tx.commit(next,{stop(){assert.equal(tx.current(token),false);events.push('stop');},reset(s){assert.equal(s.modelId,'four');events.push('reset');},async prepare(){events.push('prepare');}});
 assert.deepEqual(events,['stop','reset','prepare']);assert.equal(tx.draft,null);
});
test('backend change also cancels and resets; stale preparation cannot complete a later selection',async()=>{
 const tx=new ModelSelectionTransaction();tx.begin(old);let finish;const first=tx.commit({...old,backend:'wasm'},{stop(){},reset(){},prepare:()=>new Promise(r=>finish=r)});
 tx.begin({...old,backend:'wasm'});await tx.commit(next,{stop(){},reset(){},prepare:async()=>{}});finish();assert.equal(await first,false);
});
test('failed preparation preserves a new generation with empty reset reader, never revives old results',async()=>{
 const tx=new ModelSelectionTransaction();tx.begin(old);const token=tx.token();let reset=false;
 await assert.rejects(tx.commit(next,{stop(){},reset(){reset=true;},prepare:async()=>{throw Error('missing model');}}),/missing model/);
 assert.equal(reset,true);assert.equal(tx.current(token),false);
});
test('early Settings waits for the initialized selection so Cancel cannot restore an empty model',async()=>{
 const tx=new ModelSelectionTransaction();let release,selection={modelId:'',backend:'wasm'};
 const ready=new Promise(r=>release=r),opening=tx.beginWhenReady(ready,()=>selection);
 assert.equal(tx.draft,null);selection={modelId:'quality',backend:'webgpu'};release();await opening;
 selection={modelId:'preview',backend:'wasm'};assert.deepEqual(tx.cancel(),{modelId:'quality',backend:'webgpu'});
});
test('failed initialization never creates an empty settings draft; repeated opens keep the original snapshot',async()=>{
 const tx=new ModelSelectionTransaction();await assert.rejects(tx.beginWhenReady(Promise.resolve(),()=>({modelId:''})),/indisponible/);assert.equal(tx.draft,null);
 await tx.beginWhenReady(Promise.resolve(),()=>old);await tx.beginWhenReady(Promise.resolve(),()=>next);assert.deepEqual(tx.cancel(),old);
});
