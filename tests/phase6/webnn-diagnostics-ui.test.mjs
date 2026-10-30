import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as experiment from '../../examples/wam/source-separation/WebNNExperiment.js';
import * as recommendations from '../../examples/wam/source-separation/BenchmarkRecommendations.js';
const file=path=>readFile(new URL('../../'+path,import.meta.url),'utf8');
test('UI converts milliseconds to seconds without changing raw report values and describes actual measured audio',()=>{
 assert.equal(experiment.formatExperimentSeconds(11469.3),'11.469');
 assert.equal(experiment.formatExperimentSeconds(1.8),'0.002');
 assert.equal(experiment.formatExperimentSeconds(undefined),'—');
 const input={name:'my-song.wav',frames:264600,sampleRate:44100,sourceDurationSeconds:270};
 assert.match(experiment.experimentAudioDescription(input),/my-song.wav · tested first 6.000 s · source length 270.000 s/);
 assert.equal(input.frames,264600);assert.match(experiment.experimentAudioDescription(),/No measured audio/);
});
test('restored results identify measured audio separately from next selection and error buttons open the matching log',async()=>{
 class Element{constructor(){this.children=[];this.dataset={};this.files=[];this.value='';this.elements=[];}append(x){this.children.push(x);}replaceChildren(){this.children=[];}scrollIntoView(){this.scrolled=true;}}
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 get('input').value='music';get('seconds').value='6';
 const record={config:{model:'roformer6',session:1,backend:'webnn-cpu'},status:'error',phases:{sessionCreateMs:11022.5},error:{message:'Unsupported operator'}};
 const report={protocol:experiment.EXPERIMENT_PROTOCOL,date:'2026-10-29',status:'completed-with-failures',input:{name:'external.wav',frames:264600,sampleRate:44100},runs:[record]};
 const storage={getItem:()=>JSON.stringify(report),setItem(){}};
 const document={getElementById:get,createElement:()=>new Element(),addEventListener(){}};
 const code=(await file('examples/wam/source-separation/webnn-diagnostics.js')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',"'https://example.test/lab/'");
 vm.runInNewContext(code,{URL,...experiment,...recommendations,fetch:async()=>({ok:true,json:async()=>({runs:[]})}),document,localStorage:storage,navigator:{userAgent:'test'},crossOriginIsolated:true});
 assert.match(get('measuredAudio').textContent,/external.wav · tested first 6.000 s/);
 assert.match(get('selectedAudio').textContent,/Slow Motion Dream/);
 const row=get('rows').children[0];assert.equal(row.children[5].textContent,'11.023');assert.equal(row.children[10].children[0].textContent,'See log');
 row.children[10].children[0].onclick();assert.equal(get('logPanel').open,true);assert.equal(get('logPanel').scrolled,true);assert.match(get('details').textContent,/Unsupported operator/);
 get('input').value='file';get('file').files=[{name:'next-song.mp3'}];get('seconds').value='12';get('input').onchange();
 assert.equal(get('fileField').hidden,false);assert.match(get('selectedAudio').textContent,/next-song.mp3 · first 12 s/);assert.match(get('measuredAudio').textContent,/external.wav/);
 get('input').value='guitar';get('input').onchange();assert.equal(get('fileField').hidden,true);assert.match(get('selectedAudio').textContent,/CleanChords/);
});
test('every highlighted table header has explanatory mouse and keyboard help and seconds are explicit',async()=>{
 const html=await file('examples/wam/source-separation/webnn-diagnostics.html');
 const headers=[...html.matchAll(/<th\s([^>]+)>([^<]+)<\/th>/g)];assert.equal(headers.length,11);
 for(const [,attrs]of headers){assert.match(attrs,/tabindex="0"/);assert.match(attrs,/title="[^"]+"/);assert.match(attrs,/data-tooltip="[^"]+"/);}
 assert.match(html,/Hover headers to see explanations/);assert.equal(headers.filter(([, ,label])=>label.includes('(s)')).length,6);
 assert.match(html,/id="audioControls"/);assert.match(html,/value="guitar"/);assert.match(html,/id="seconds"[^>]+max="30"/);
 const builder=await file('tools/build-webnn-benchmark.mjs');assert.match(builder,/fixtures\/music\/clean-chords.mp3/);
});
