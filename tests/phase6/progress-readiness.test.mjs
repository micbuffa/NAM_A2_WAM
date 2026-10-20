import test from 'node:test';
import assert from 'node:assert/strict';
import {SeparationProgress, transportState, separationMessage} from '../../examples/wam/source-separation/SeparationProgress.js';
import {MultitrackEngine} from '../../examples/wam/source-separation/MultitrackEngine.js';

test('progress uses segment completion, stays monotone across FT specialists and reserves 100 for ready', () => {
  const progress = new SeparationProgress();
  assert.equal(progress.update({phase:'cache'}),0);
  let previous = 0;
  for(let index = 0; index < 4; index++) {
    for(const data of [{phase:'load'}, {phase:'inference',progress:.5}, {phase:'inference',progress:1}, {phase:'model-complete'}]) {
      const value = progress.update({...data,modelIndex:index,totalModels:4});
      assert.ok(value >= previous && value < 100); previous = value;
    }
  }
  assert.equal(progress.update({phase:'audio'}),96);
  assert.equal(progress.update({phase:'inference',progress:NaN}),96);
  assert.equal(progress.update({phase:'ready'}),100);
});

test('progress names the actual track and does not pretend 6s computes stems sequentially',()=>{
  assert.equal(separationMessage({phase:'track-complete',trackIndex:1,totalTracks:4,trackRole:'bass'}),'Séparation — piste 2/4 — Basse, terminée !');
  assert.equal(separationMessage({phase:'inference',totalTracks:6}),'Séparation — 6 pistes ensemble, en cours…');
  const progress=new SeparationProgress();
  assert.equal(progress.update({phase:'track-complete',modelIndex:0,totalModels:4}),27);
});

function context() {
  let resume;
  const ctx = {state:'suspended',currentTime:0,
    resume:()=>new Promise(resolve=>{resume=()=>{ctx.state='running';resolve();};}),
    createGain:()=>({gain:{setTargetAtTime(){}},connect(to){return to;},disconnect(){}}),
    createStereoPanner:()=>({pan:{setTargetAtTime(){}},connect(to){return to;},disconnect(){}}),
    createBufferSource:()=>({connect(to){return to;},disconnect(){},start(){ctx.starts++;},stop(){}}),
    starts:0, resolve:()=>resume(),
  };
  return ctx;
}
const tracks = [{id:'guitar',buffer:{duration:5,length:220500,sampleRate:44100}}];

test('Play stays disabled during deferred audio preparation and enables only when ready',async()=>{
  const ctx=context(),engine=new MultitrackEngine(ctx);engine.load(tracks);
  assert.equal(transportState(engine).disabled,true);
  const preparing=engine.prepare();
  assert.equal(engine.preparing,true); assert.equal(engine.ready,false);
  assert.deepEqual(transportState(engine),{disabled:true,label:'Préparation audio…',canActivate:false});
  ctx.resolve();await preparing;
  assert.equal(engine.ready,true);assert.equal(transportState(engine).disabled,false);
  assert.equal(transportState(engine,{busy:true}).disabled,true);
  assert.equal(transportState(engine,{installing:true}).disabled,true);
  engine.destroy();
});

test('slow play has one pending start, rejects repeated clicks and restores controls on failure',async()=>{
  const ctx=context(),engine=new MultitrackEngine(ctx);engine.load(tracks);
  const starting=engine.play(); await engine.play();
  assert.equal(ctx.starts,0);assert.equal(transportState(engine).disabled,true);
  ctx.resolve();await starting;
  assert.equal(ctx.starts,1);assert.equal(transportState(engine).label,'Pause');
  engine.pause();ctx.state='suspended';ctx.resume=async()=>{throw Error('device unavailable');};
  await assert.rejects(engine.play(),/device unavailable/);
  assert.equal(engine.starting,false);assert.equal(engine.preparing,false);
  assert.equal(transportState(engine).canActivate,true);assert.equal(transportState(engine).disabled,true);
  engine.destroy();
});

test('UI readiness handles empty engine and interrupted context without enabling Play',()=>{
  assert.equal(transportState(null).disabled,true);
  const ctx=context(),engine=new MultitrackEngine(ctx);engine.load(tracks);ctx.state='interrupted';
  assert.equal(engine.ready,false);assert.equal(transportState(engine).canActivate,true);
  engine.destroy();assert.equal(transportState(engine).canActivate,false);
});
