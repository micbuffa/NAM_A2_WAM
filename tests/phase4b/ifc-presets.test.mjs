import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
for (const variant of [1,2]) {
 const base=new URL(`../../examples/wam/wamPlugins/EndUserAmp${variant}/`,import.meta.url);
 const {FACTORY_PRESETS}=await import(new URL('factory-presets.js',base));
 const {withFactoryPresets}=await import(new URL('preset-state.js',base));
 class Parameters {
  constructor(){this.values={...FACTORY_PRESETS[0].parameters};this._wamNode={getParamsValues:()=>this.values};}
  async getState(){return {...this.values};}
  async setState(values){for(const [key,value] of Object.entries(values)){assert.equal(typeof value,'number');this.values[key]=Math.fround(value);}}
 }
 const Amp=withFactoryPresets(Parameters);
 test(`Amp${variant} presets cover all DSP controls and contain no host effects`,async()=>{
  const meta=JSON.parse(await readFile(new URL('dsp-meta.json',base)));const controls={};
  const walk=items=>items.forEach(x=>x.items?walk(x.items):x.address&&(['checkbox','button'].includes(x.type)||x.init!==undefined)&&(controls[x.address]=x));walk(meta.ui);
  assert.equal(Object.keys(controls).length,variant===1?30:47);
  assert.deepEqual(FACTORY_PRESETS.map(p=>p.name),['Default','Clean','Crunch','Disto / Hi gain','Jazzy','Jordan']);
  for(const preset of FACTORY_PRESETS){
   assert.deepEqual(Object.keys(preset.parameters).sort(),Object.keys(controls).sort());
   for(const [key,value] of Object.entries(preset.parameters)){assert.ok(Number.isFinite(value));assert.ok(value>=(controls[key].min??0)-1e-5&&value<=(controls[key].max??1)+1e-5);}
  }
 });
 test(`Amp${variant} preset round trips preserve edited settings, selection and instance isolation`,async()=>{
  const a=new Amp(),b=new Amp();const initial=await b.getState();
  for(const preset of FACTORY_PRESETS){await a.loadFactoryPreset(preset.id);assert.equal(a.getFactoryPresetStatus().modified,false);assert.equal(a.getFactoryPresetStatus().id,preset.id);}
  await a.loadFactoryPreset('clean');const key=Object.keys(a.values).find(k=>k.endsWith('/Master_Volume'));a.values[key]=.123;
  assert.equal(a.getFactoryPresetStatus().modified,true);
  const saved=JSON.parse(JSON.stringify(await a.getState()));await a.loadFactoryPreset('crunch');await a.setState(saved);
  assert.equal(a.getFactoryPresetStatus().id,'clean');assert.equal(a.getFactoryPresetStatus().modified,true);assert.ok(Math.abs(a.values[key]-.123)<1e-6);
  assert.deepEqual(await b.getState(),initial);
  await b.setState(saved);assert.deepEqual(await b.getState(),await a.getState());
  const legacy={...FACTORY_PRESETS[2].parameters};await a.setState(legacy);assert.equal(a.getFactoryPresetStatus().id,null);
  await a.setState({...legacy,__wamFactoryPreset:{version:1,id:'removed-preset'}});assert.equal(a.getFactoryPresetStatus().id,null);
  const before=await a.getState();await assert.rejects(a.loadFactoryPreset('missing'),RangeError);assert.deepEqual(await a.getState(),before);
 });
}
