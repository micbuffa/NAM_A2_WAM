import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,access} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import http from 'node:http';
import {YouTubeImportService,youtubeURL} from '../../tools/YouTubeImportService.mjs';
import {YouTubeImportClient} from '../../examples/wam/source-separation/YouTubeImportClient.js';
const url='https://youtu.be/BaW_jenozKc';
test('single video URLs are canonicalized; credentials, local/proxy URLs and malformed IDs are rejected',()=>{
 assert.equal(youtubeURL(url+'?t=3'),'https://www.youtube.com/watch?v=BaW_jenozKc');
 for(const u of ['http://youtu.be/BaW_jenozKc','https://evil.youtube.com/watch?v=BaW_jenozKc','https://localhost/','https://youtube.com/playlist?list=123','https://u:p@youtube.com/watch?v=BaW_jenozKc','https://youtu.be/BaW_jenozKc/extra'])assert.throws(()=>youtubeURL(u));
});
function fakeRun({duration=10,live=false,fail=false}={}){return async(binary,args,{onLine}={})=>{
 if(args.includes('--dump-single-json'))return JSON.stringify({id:'BaW_jenozKc',title:'Fixture',duration,is_live:live});
 if(fail)throw Error('Extraction refusée');
 onLine('PROGRESS:{"downloaded_bytes":4,"total_bytes":8}');
 await writeFile(join(dirname(args[args.indexOf('--output')+1]),'audio.webm'),Buffer.from('fixture'));return '';
};}
test('native audio, real byte progress, metadata/hash, deletion and cleanup',async()=>{
 const s=new YouTubeImportService({run:fakeRun()});try{const j=s.start(url),states=[];const update=s.update.bind(s);s.update=(job,p)=>{states.push(p);update(job,p);};await j.task;assert.equal(j.state,'ready');assert.equal(j.metadata.extension,'webm');assert.equal(j.metadata.sha256.length,64);assert.ok(states.some(p=>p.progress===50));const path=j.path;await s.cancel(j.id);await assert.rejects(access(path));}finally{await s.close();}
});
test('oversize duration, live, failed extraction preserve error state and remove partial data',async()=>{
 for(const config of [{duration:1900},{live:true},{fail:true}]){const s=new YouTubeImportService({run:fakeRun(config)});try{const j=s.start(url);await j.task;assert.equal(j.state,'error');await assert.rejects(access(j.directory));}finally{await s.close();}}
});
test('only one concurrent import; cancellation aborts extraction and discards job',async()=>{
 let started;const begin=new Promise(r=>started=r);const s=new YouTubeImportService({run:async(_,__,{signal})=>{started();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));}});
 try{const j=s.start(url);await begin;assert.throws(()=>s.start(url),/déjà/);await s.cancel(j.id);assert.equal(s.jobs.size,0);await assert.rejects(access(j.directory));}finally{await s.close();}
});
test('HTTP lifecycle delivers SSE once and native blob to client, without polling',async()=>{
 const s=new YouTubeImportService({run:fakeRun()}),paths=[];const server=http.createServer((req,res)=>{paths.push(req.url);void s.handle(req,res,new URL(req.url,`http://${req.headers.host}`));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/media-imports`;
 try{const c=new YouTubeImportClient({base});assert.equal((await c.capabilities()).available,true);const result=await c.import(url);assert.equal(await result.blob.text(),'fixture');assert.equal(result.metadata.name,'Fixture');assert.equal(paths.filter(p=>p.endsWith('/events')).length,1);assert.equal(s.jobs.size,0);
 const rejected=await fetch(base,{method:'POST',headers:{origin:'https://foreign.example','content-type':'application/json'},body:JSON.stringify({url})});assert.equal(rejected.status,403);
 }finally{await s.close();await new Promise(r=>server.close(r));}
});
test('cancel while POST is pending cleans late job and never returns audio',async()=>{
 let resolvePost;const deleted=[];const c=new YouTubeImportClient({base:'/jobs',fetch:async(path,options)=>{if(options.method==='POST')return new Promise(r=>resolvePost=r);if(options.method==='DELETE'){deleted.push(path);return new Response('{}');}throw Error('Unexpected request');}});
 const pending=c.import(url);await new Promise(r=>setImmediate(r));await c.cancel();resolvePost(new Response(JSON.stringify({id:'late'})));await assert.rejects(pending,{name:'AbortError'});assert.deepEqual(deleted,['/jobs/late']);
});
test('simultaneous import requests invalidate the older one before POST',async()=>{
 let posts=0;const c=new YouTubeImportClient({fetch:async(path,options)=>{if(options.method==='POST'){posts++;return new Response(JSON.stringify({error:'fixture stop'}),{status:400});}return new Response('{}');}});
 const [older,newer]=await Promise.allSettled([c.import(url),c.import(url)]);assert.equal(older.status,'rejected');assert.equal(older.reason.name,'AbortError');assert.equal(newer.status,'rejected');assert.equal(posts,1);
});
test('download size limit rejects an oversized native file and cleans it',async()=>{
 const s=new YouTubeImportService({run:fakeRun(),maxBytes:5});try{const j=s.start(url);await j.task;assert.notEqual(j.state,'ready');await assert.rejects(access(j.directory));}finally{await s.close();}
});
test('expired completed jobs remove their temporary audio',async()=>{
 const s=new YouTubeImportService({run:fakeRun(),ttl:20});try{const j=s.start(url);await j.task;j.updated-=1000;await new Promise(r=>setTimeout(r,100));assert.equal(s.jobs.size,0);await assert.rejects(access(j.directory));}finally{await s.close();}
});
test('static deployment without API reports unavailable; SSE errors are exposed and cleaned',async()=>{
 const unavailable=new YouTubeImportClient({fetch:async()=>new Response('Not found',{status:404})});assert.deepEqual(await unavailable.capabilities(),{available:false});
 let deleted=false;const c=new YouTubeImportClient({base:'/jobs',fetch:async(path,options)=>{if(options.method==='POST')return new Response(JSON.stringify({id:'blocked'}));if(options.method==='DELETE'){deleted=true;return new Response('{}');}return new Response('data: {"state":"error","message":"Vidéo indisponible"}\n\n');}});
 await assert.rejects(c.import(url),/Vidéo indisponible/);assert.equal(deleted,true);
});
function panelDocument(){
 const nodes=new Map();for(const selector of ['[type=submit]','[type=button]','[role=status]','progress'])nodes.set(selector,{disabled:selector==='[type=submit]',hidden:false,removeAttribute(){}});
 nodes.set('form',{elements:{url:{value:url}}});const panel={querySelector:s=>nodes.get(s),remove(){}};
 return {document:{createElement:()=>panel},nodes};
}
test('a missing service keeps import disabled even when a local file cancels a pending UI operation',async()=>{
 const old=globalThis.document,{document,nodes}=panelDocument();globalThis.document=document;
 try{const {createYouTubeImportPanel}=await import('../../examples/wam/source-separation/YouTubeImportClient.js');const p=createYouTubeImportPanel({client:{capabilities:async()=>({available:false}),cancel:async()=>{}}});await new Promise(r=>setImmediate(r));p.cancel();assert.equal(nodes.get('[type=submit]').disabled,true);assert.match(nodes.get('[role=status]').textContent,/serveur Node local/);p.destroy();}finally{globalThis.document=old;}
});
test('cancel during decoding aborts commit and a late decoder completion cannot report a ready import',async()=>{
 const old=globalThis.document,{document,nodes}=panelDocument();globalThis.document=document;let release,signal;
 try{const {createYouTubeImportPanel}=await import('../../examples/wam/source-separation/YouTubeImportClient.js');const p=createYouTubeImportPanel({client:{capabilities:async()=>({available:true}),cancel:async()=>{},import:async()=>({blob:new Blob(['x']),metadata:{name:'fixture'}})},onImport:async(_,s)=>{signal=s;await new Promise(r=>release=r);}});await new Promise(r=>setImmediate(r));const pending=nodes.get('form').onsubmit({preventDefault(){}});await new Promise(r=>setImmediate(r));p.cancel();assert.equal(signal.aborted,true);release();await pending;assert.match(nodes.get('[role=status]').textContent,/annulé/);assert.doesNotMatch(nodes.get('[role=status]').textContent,/Audio prêt/);p.destroy();}finally{globalThis.document=old;}
});
test('real downloader process preserves split UTF-8 characters',async()=>{
 const {runDownloader}=await import('../../tools/YouTubeImportService.mjs');const output=await runDownloader(process.execPath,['-e',"const b=Buffer.from('été');process.stdout.write(b.subarray(0,1));setTimeout(()=>process.stdout.write(b.subarray(1)),10)"]);assert.equal(output,'été');
});
test('cancelling waits for process termination even if the child ignores SIGTERM',async()=>{
 const {runDownloader}=await import('../../tools/YouTubeImportService.mjs');const controller=new AbortController();const pending=runDownloader(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"],{signal:controller.signal,onLine:()=>controller.abort(),timeout:5000});await assert.rejects(pending,/annulé/);
});
