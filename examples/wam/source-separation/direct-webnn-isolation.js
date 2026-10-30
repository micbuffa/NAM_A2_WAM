const $=id=>document.getElementById(id);let worker=null,report=null,timer=null;
const status=text=>{$('status').textContent=text;};
const finish=state=>{clearTimeout(timer);worker?.terminate();worker=null;if(report){report.status=state;report.finished=new Date().toISOString();}$('run').disabled=false;$('stop').disabled=true;$('export').disabled=!report;};
function watchdog(){clearTimeout(timer);timer=setTimeout(()=>{if(report.activeProbe)report.runs.push({...report.activeProbe,status:'timeout',error:{message:'Worker terminated after 90 seconds without progress; native completion unknown.'}});status('Timed out. Export the partial report; no automatic retry.');finish('timeout');render();},90000);}
function render(){
 $('results').replaceChildren();
 for(const row of report.runs){const tr=document.createElement('tr');for(const value of [row.kind,`${row.index??'—'} ${row.operation??''}`,row.operationCount??'—',row.constructionMs==null?'—':(row.constructionMs/1000).toFixed(3),row.buildMs==null?'—':(row.buildMs/1000).toFixed(3),row.status+(row.error?' · '+row.error.message:'')]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('results').append(tr);}
}
$('run').onclick=async()=>{
 const config={device:$('device').value,start:Number($('start').value),step:Number($('step').value)};if($('end').value!=='')config.end=Number($('end').value);
 if(!Number.isInteger(config.start)||!Number.isInteger(config.step)||config.start<0||config.step<1||config.end!=null&&(!Number.isInteger(config.end)||config.end<config.start)){status('Invalid range.');return;}
 report={protocol:'direct-webnn-graph-isolation-v1',date:new Date().toISOString(),userAgent:navigator.userAgent,config,status:'running',runs:[],events:[],limitations:'Compilation only; altered outputs/cut edges may change compiler behavior. No physical device or inference validation.'};
 $('run').disabled=true;$('stop').disabled=false;$('export').disabled=false;render();status('Starting Worker…');
 const current=report;
 fetch('./build-info.json').then(async response=>{if(response.ok)current.buildInfo=await response.json();}).catch(()=>{});
 try{worker=new Worker(new URL('./direct-webnn-isolation-worker.js',import.meta.url),{type:'module'});
 worker.onmessage=({data})=>{watchdog();report.events.push({...data,at:new Date().toISOString()});if(data.type==='identity')Object.assign(report,{model:data.model,operationCount:data.operationCount});if(data.type==='probe')report.activeProbe={kind:data.kind,index:data.index};if(data.type==='progress')status(data.message);if(data.type==='result'){report.runs.push(data.record);report.activeProbe=null;render();}if(data.type==='done'){status('Completed. Export JSON for analysis.');finish('completed');}if(data.type==='fatal'){report.error=data.error;status(data.error.message);finish('error');}};
 worker.onerror=event=>{report.error={message:event.message};status('Worker failed: '+event.message);finish('error');};watchdog();worker.postMessage(config);
 }catch(error){report.error={message:error.message};status(error.message);finish('error');}
};
$('stop').onclick=()=>{if(report?.activeProbe)report.runs.push({...report.activeProbe,status:'cancelled'});status('Stopped. Partial results can be exported.');finish('cancelled');render();};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='direct-webnn-isolation-'+new Date().toISOString().replaceAll(':','-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
