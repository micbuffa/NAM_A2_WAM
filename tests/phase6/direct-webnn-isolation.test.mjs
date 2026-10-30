import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ancestorIndices,isolationEndpoints,collectOperandDescriptors,compileIsolationProbe} from '../../examples/wam/source-separation/DirectWebNNIsolation.js';
const recipe=()=>({format:'direct-webnn-graph-v1',inputs:{audio:{id:'i',dataType:'float32',shape:[2]}},constants:{c:{dataType:'float32',shape:[2],offset:0,bytes:8}},outputs:{out:{id:'v2',dataType:'float32',shape:[2]}},operations:[{op:'add',args:['i','c'],outputs:['v0']},{op:'add',args:['i','i'],outputs:['v1']},{op:'add',args:['v0','c'],outputs:['v2']}]});
function native(){
 const contexts=[],builds=[];let fail=false;
 class Builder{
  constructor(c){this.context=c;this.ops=[];}
  input(name,d){return{...d,name};}
  constant(d){return{...d,constant:true};}
  add(a,b){assert.ok(a&&b);this.ops.push([a,b]);return{shape:a.shape,dataType:a.dataType};}
  async build(outputs){builds.push({ops:this.ops,outputs});if(fail)throw Error('native compilation failure');return{destroy(){contexts.find(c=>c===this)?.destroy();}};}
 }
 return{Builder,contexts,builds,setFail:v=>fail=v,createContext:async options=>{const c={options,destroyed:false,destroy(){this.destroyed=true;}};contexts.push(c);return c;}};
}
test('endpoint ancestors follow actual dependencies, omit unrelated branches, validate indices and bound scan',()=>{
 assert.deepEqual(ancestorIndices(recipe(),2),[0,2]);assert.deepEqual(ancestorIndices(recipe(),1),[1]);
 assert.deepEqual(isolationEndpoints(10,{start:2,end:9,step:3}),[2,5,8,9]);assert.equal(isolationEndpoints(1816).length,16);
 for(const index of [-1,3,.5])assert.throws(()=>ancestorIndices(recipe(),index));
 assert.throws(()=>isolationEndpoints(100,{step:1}),/64/);assert.throws(()=>isolationEndpoints(10,{end:10}));
 // An operand inside options is also a dependency (e.g. normalization scale).
 const g=recipe();g.operations[2].options={scale:{operand:'v1'}};assert.deepEqual(ancestorIndices(g,2),[0,1,2]);
});
test('probes share native operator construction, prune ancestors and substitute only single-operator cut edges',async()=>{
 const n=native(),g=recipe(),weights=new ArrayBuffer(8),descriptors=collectOperandDescriptors(new n.Builder({}),g,weights);
 const options={...n,descriptors,index:2};
 const ancestors=await compileIsolationProbe(g,weights,options);assert.equal(ancestors.status,'ok');assert.equal(ancestors.operationCount,2);assert.equal(n.builds[0].ops.length,2);
 const single=await compileIsolationProbe(g,weights,{...options,kind:'single'});assert.equal(single.status,'ok');assert.equal(single.operationCount,1);assert.deepEqual(single.cutInputs.v0,{shape:[2],dataType:'float32'});assert.equal(n.builds[1].ops[0][0].name,'cut_v0');assert.equal(n.builds[1].ops[0][1].constant,true);
 const original=await compileIsolationProbe(g,weights,{...options,kind:'original'});assert.equal(original.operationCount,3);assert.ok(n.builds[2].outputs.out);
 assert.equal(n.contexts.length,3);assert.ok(n.contexts.every(c=>c.destroyed));assert.equal(single.physicalDeviceVerified,false);
});
test('failed native builds retain phase/error, destroy context and do not substitute a backend',async()=>{
 const n=native();n.setFail(true);
 const record=await compileIsolationProbe(recipe(),new ArrayBuffer(8),{...n,index:0,device:'npu'});
 assert.equal(record.status,'error');assert.equal(record.error.phase,'build');assert.match(record.error.message,/native compilation/);assert.equal(n.contexts[0].options.deviceType,'npu');assert.equal(n.contexts[0].destroyed,true);assert.ok(record.buildMs>=0);
 n.setFail(false);assert.equal((await compileIsolationProbe(recipe(),new ArrayBuffer(8),{...n,kind:'baseline'})).status,'ok');assert.equal(n.contexts.length,2);
});
function uiHarness(code){
 const ids=['device','start','end','step','run','stop','export','status','results'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{value:({device:'cpu',start:'0',end:'',step:'128'})[id]??'',disabled:false,children:[],textContent:'',append(v){this.children.push(v);},replaceChildren(){this.children=[];}}]));
 const workers=[],timers=new Map();let timerId=0;
 class Worker{constructor(){workers.push(this);}postMessage(config){this.config=config;}terminate(){this.terminated=true;}}
 const context=vm.createContext({document:{getElementById:id=>nodes[id],createElement:()=>({children:[],append(v){this.children.push(v);},click(){}})},navigator:{userAgent:'fake'},Worker,URL,Blob,Date,fetch:async()=>({ok:false}),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(code.replace('new URL(\'./direct-webnn-isolation-worker.js\',import.meta.url)',"'worker.js'"),context);
 return{nodes,workers,timers};
}
test('UI runs, cancels, handles native errors, timeout and unavailable Worker without becoming stuck',async()=>{
 const code=await readFile(new URL('../../examples/wam/source-separation/direct-webnn-isolation.js',import.meta.url),'utf8');
 const {nodes,workers,timers}=uiHarness(code);await nodes.run.onclick();assert.equal(nodes.run.disabled,true);assert.equal(workers[0].config.step,128);
 workers[0].onmessage({data:{type:'probe',kind:'original'}});nodes.stop.onclick();assert.equal(workers[0].terminated,true);assert.equal(nodes.run.disabled,false);assert.match(nodes.results.children[0].children.at(-1).textContent,/cancelled/);
 await nodes.run.onclick();workers[1].onmessage({data:{type:'fatal',error:{message:'No native WebNN'}}});assert.equal(nodes.status.textContent,'No native WebNN');assert.equal(nodes.export.disabled,false);
 await nodes.run.onclick();workers[2].onmessage({data:{type:'probe',kind:'ancestors',index:128}});[...timers.values()][0]();assert.equal(workers[2].terminated,true);assert.match(nodes.status.textContent,/Timed out/);assert.match(nodes.results.children[0].children.at(-1).textContent,/timeout/);
 nodes.start.value='-1';const count=workers.length;await nodes.run.onclick();assert.equal(workers.length,count);assert.equal(nodes.status.textContent,'Invalid range.');
});
test('actual isolation Worker orchestrates baseline, original, sparse closures and single probes, preserving identity/errors',async()=>{
 const code=(await readFile(new URL('../../examples/wam/source-separation/direct-webnn-isolation-worker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const n=native(),messages=[],calls=[];const g=recipe();
 const context=vm.createContext({navigator:{ml:{createContext:n.createContext}},MLGraphBuilder:n.Builder,loadDirectWebNNModel:async key=>{assert.equal(key,'demucs4');return{recipe:g,weights:new ArrayBuffer(8),indexEntry:{graph:{sha256:'identity'}}};},collectOperandDescriptors,isolationEndpoints,compileIsolationProbe:async(recipe,weights,options)=>{calls.push(options.kind);const result=await compileIsolationProbe(recipe,weights,options);if(options.kind==='ancestors'&&options.index===2)result.status='error';return result;},postMessage:data=>messages.push(data)});
 context.self=context;vm.runInContext(code,context);await context.onmessage({data:{device:'cpu',step:2}});
 assert.deepEqual(calls,['baseline','original','ancestors','ancestors','single']);assert.equal(messages.at(-1).type,'done');assert.equal(messages.find(m=>m.type==='identity').model.graph.sha256,'identity');assert.ok(n.contexts.every(c=>c.destroyed));
 const count=calls.length;await context.onmessage({data:{device:'bogus'}});assert.equal(calls.length,count);assert.equal(messages.at(-1).type,'fatal');
});
