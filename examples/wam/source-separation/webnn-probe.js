import {probeWebNN,WEBNN_PROBES} from './WebNNProbe.js';
const $=id=>document.getElementById(id);let generation=0,worker=null,rejectWorker=null;
let report={protocol:'webnn-native-capability-v1',status:'not-started',runs:[]};const show=()=>{$('report').textContent=JSON.stringify({...report,runs:undefined,note:undefined},null,2);$('rows').replaceChildren();for(const row of report.runs){const article=document.createElement('article'),heading=document.createElement('h2'),pre=document.createElement('pre');heading.textContent=`${row.scope} · ${row.id}`;pre.textContent=JSON.stringify(row);article.append(heading,pre);$('rows').append(article);}};show();
function cancel(){++generation;worker?.terminate();worker=null;rejectWorker?.(new DOMException('Annulé','AbortError'));rejectWorker=null;}
function inWorker(probe){return new Promise((resolve,reject)=>{
 const child=new Worker(new URL('./webnn-probe-worker.js',import.meta.url),{type:'module'});worker=child;
 const finish=fn=>{clearTimeout(timer);child.terminate();if(worker===child){worker=null;rejectWorker=null;}fn();};
 const timer=setTimeout(()=>finish(()=>resolve({status:'timeout',id:probe.id,requestedOptions:probe.options,effectiveHardware:'unknown'})),30000);
 rejectWorker=e=>finish(()=>reject(e));child.onmessage=({data})=>finish(()=>data.error?reject(Error(data.error)):resolve(data.result));child.onerror=e=>finish(()=>reject(Error(e.message)));child.postMessage(probe);
});}
async function inWindow(probe){let timer;try{return await Promise.race([probeWebNN(probe),new Promise(resolve=>{timer=setTimeout(()=>resolve({id:probe.id,status:'timeout',effectiveHardware:'unknown'}),30000);})]);}finally{clearTimeout(timer);}}
$('cancel').onclick=cancel;
$('run').onclick=async()=>{const token=++generation;report={protocol:'webnn-native-capability-v1',date:new Date().toISOString(),userAgent:navigator.userAgent,secureContext:isSecureContext,crossOriginIsolated,windowAPI:!!navigator.ml,status:'running',effectiveHardware:'unknown',runs:[],note:'A passed synthetic graph does not establish model support or NPU usage. deviceType and accelerated reflect different API generations; ignored keys cannot be detected.'};$('run').disabled=true;$('cancel').disabled=false;show();
 try{for(const scope of ['window','worker'])for(const probe of WEBNN_PROBES){if(token!==generation)throw new DOMException('Annulé','AbortError');$('status').textContent=`${scope} · ${probe.id}`;let row;
 if(scope==='worker')row=await inWorker(probe);else row=await inWindow(probe);
 if(token!==generation)throw new DOMException('Annulé','AbortError');report.runs.push({scope,...row});show();}report.status='completed';$('status').textContent=`Terminé · ${report.runs.filter(r=>r.status==='passed').length}/8 graphes réussis.`;
 }catch(e){report.status=e.name==='AbortError'?'cancelled':'error';report.error=e.message;$('status').textContent=e.message;}finally{$('run').disabled=false;$('cancel').disabled=true;show();}};
window.addEventListener('pagehide',cancel);
