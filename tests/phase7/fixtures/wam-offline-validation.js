import initializeWamHost from '../../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js';
import {destroyPluginInstance} from '../../../examples/wam/WamPluginRegistry.js';
const $=id=>document.getElementById(id),catalogueUrl=new URL('../../../examples/wam/wamPlugins/plugins.json',import.meta.url);
const deadline=async(promise,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label}: timed out after 12s`)),12000);})]);}finally{clearTimeout(timer);}};
function stats(buffer){let peak=0,sum=0,tailSum=0,tailCount=0,finite=true;for(let c=0;c<buffer.numberOfChannels;c++){const samples=buffer.getChannelData(c);for(let i=0;i<samples.length;i++){const value=samples[i];finite&&=Number.isFinite(value);peak=Math.max(peak,Math.abs(value));sum+=value*value;if(i>=buffer.sampleRate){tailSum+=value*value;tailCount++;}}}return{finite,peak,rms:Math.sqrt(sum/(buffer.length*buffer.numberOfChannels)),tailRms:Math.sqrt(tailSum/tailCount)};}
async function render(entry,rate,onStage,state){
 const context=new OfflineAudioContext(2,rate*2,rate),instances=[];let expired=false,processorError=null;
 try{
  onStage('host initialization');const[groupId]=await deadline(initializeWamHost(context),'WAM host');
  const snapshots=[],assets=[];
  for(const [index,uri]of (entry.chain||[entry.uri]).entries()){
   onStage('plugin initialization');const{default:Plugin}=await deadline(import(new URL(uri,catalogueUrl).href),'import');
   const pending=Plugin.createInstance(groupId,context);pending.then(value=>{if(expired)destroyPluginInstance(value);},()=>{});
   const plugin=await deadline(pending,'createInstance');instances.push(plugin);plugin.audioNode.addEventListener('processorerror',()=>{processorError='AudioWorklet processorerror';});
   onStage('state');if(state!==undefined)await deadline(plugin.audioNode.setState(entry.chain?state[index]:state),'setState');
   snapshots.push(await deadline(plugin.audioNode.getState(),'getState'));
   assets.push({model:plugin.audioNode.getModelSnapshot?.()?.name??null,ir:plugin.audioNode.getIrSnapshot?.()?.name??null});
  }
  const input=context.createBuffer(1,rate*2,rate),samples=input.getChannelData(0);
  for(let i=0;i<rate*.5;i++){const t=i/rate;samples[i]=.1*(Math.sin(2*Math.PI*110*t)+.5*Math.sin(2*Math.PI*164.81*t)+.3*Math.sin(2*Math.PI*220*t))*Math.min(1,i/128);}
  samples[0]=.2;const source=context.createBufferSource();source.buffer=input;let output=source;for(const plugin of instances){output.connect(plugin.audioNode);output=plugin.audioNode;}output.connect(context.destination);source.start();
  onStage('render');const audio=await deadline(context.startRendering(),'startRendering');if(processorError)throw Error(processorError);
  const metrics=stats(audio);if(!metrics.finite)throw Error('Non-finite output');
  return{snapshot:entry.chain?snapshots:snapshots[0],audio,metrics,model:assets.find(a=>a.model)?.model??null,ir:assets.find(a=>a.ir)?.ir??null};
 }finally{expired=true;for(const plugin of instances)destroyPluginInstance(plugin);}
}
$('run').onclick=async()=>{
 $('run').disabled=true;$('rows').replaceChildren();const rate=Number($('rate').value),scope=$('scope').value,rows=[];
 try{
  const{plugins}=await(await fetch(catalogueUrl)).json();const entries=plugins.filter(p=>p.enabled!==false&&(scope==='all'||/src\/(nam|cabinet)-wam\//.test(p.uri)));
  entries.push({uri:'NAM → cabinet (chain)',chain:['../../../src/nam-wam/index.js','../../../src/cabinet-wam/index.js']});
  for(const entry of entries){
   const row={uri:entry.uri,stage:'pending',status:'running'},tr=document.createElement('tr');for(let i=0;i<6;i++)tr.append(document.createElement('td'));$('rows').append(tr);tr.children[0].textContent=entry.uri;
   const stage=text=>{row.stage=text;tr.children[1].textContent=text;$('status').textContent=`${rows.length+1}/${entries.length} · ${entry.uri} · ${text}`;};
   try{const first=await render(entry,rate,stage);row.metrics=first.metrics;row.model=first.model;row.ir=first.ir;
    stage('state round trip');const second=await render(entry,rate,text=>stage(`restore: ${text}`),first.snapshot);row.restoredMetrics=second.metrics;
    let sum=0;for(let c=0;c<first.audio.numberOfChannels;c++){const a=first.audio.getChannelData(c),b=second.audio.getChannelData(c);for(let i=0;i<a.length;i++)sum+=(a[i]-b[i])**2;}
    row.repeatDifferenceRms=Math.sqrt(sum/(first.audio.length*first.audio.numberOfChannels));row.status=first.metrics.peak>1e-9&&second.metrics.peak>1e-9?'pass':'silent';row.stage='complete';
   }catch(error){row.status='error';row.error=error.message;}
   rows.push(row);tr.children[1].textContent=row.stage;tr.children[2].textContent=row.error||row.status;for(const[index,key]of [[3,'peak'],[4,'rms'],[5,'tailRms']])tr.children[index].textContent=row.metrics?.[key]?.toExponential(3)||'—';
   $('result').textContent=JSON.stringify({date:new Date().toISOString(),userAgent:navigator.userAgent,rate,scope,rows},null,2);
  }
  $('status').textContent=`Complete · ${rows.filter(r=>r.status==='pass').length}/${rows.length} pass · ${rate}Hz`;
 }catch(error){$('status').textContent=`FAIL ${error.stack}`;}finally{$('run').disabled=false;}
};
