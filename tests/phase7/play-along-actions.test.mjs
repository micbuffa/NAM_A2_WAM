import test from 'node:test';
import assert from 'node:assert/strict';
import {audioImportChoices,mp3Filename,mp3Header,PlayAlongMp3,saveAudioDownload} from '../../examples/wam/backing-track-player/PlayAlongActions.js';
import {useYoutubeInTone} from '../../examples/wam/projects/StudioBackingLibrary.js';
import {StudioMixExporter} from '../../examples/wam/projects/StudioMixExporter.js';

const buffer=(extra={})=>({duration:.1,length:4410,sampleRate:44100,numberOfChannels:2,...extra});
test('Tone import only offers file and YouTube even when audio is loaded, with local import still usable offline',()=>{
 const calls=[],choices=audioImportChoices({local:()=>calls.push('file'),youtube:()=>calls.push('youtube'),download:()=>calls.push('mp3')});
 assert.deepEqual(choices.map(c=>c.label),['Import from a file','Import from YouTube']);
 choices.forEach(c=>c.run());assert.deepEqual(calls,['file','youtube']);
 const offline=audioImportChoices({local(){}});assert.equal(offline.length,2);assert.equal(offline[1].run,null);
});
test('MP3 sources reuse their original bytes or URL, rather than encoding again or renaming WAV bytes',async()=>{
 const exporter=new PlayAlongMp3({encode(){throw Error('must not encode MP3');}});
 const file=new Blob([new Uint8Array([0xff,0xfb,0x90,0x64,1,2])],{type:'audio/mpeg'});
 const local=await exporter.prepare({buffer:buffer(),sourceFile:file,title:'Song.wav'});
 assert.equal(local.blob,file);assert.equal(local.filename,'Song.mp3');
 for(const entry of [{url:'https://test.example/Song.mp3?x=1'}, {url:'/api/tracks/1/audio',filename:'youtube-1.mp3'}]){
  const result=await exporter.prepare({buffer:buffer(),entry,title:'Full song'});assert.equal(result.url,entry.url);assert.equal(result.filename,'Full song.mp3');
 }
 assert.equal(mp3Header(new Uint8Array([82,73,70,70])),false);assert.equal(mp3Header(new Uint8Array([73,68,51,4])),true);
 assert.equal(mp3Filename('../bad:file.FLAC'),'.._bad_file.mp3');
});
test('non-MP3 full audio is resampled to 44.1 kHz stereo and encoded independently of playback settings',async()=>{
 let request,started=0;const rendered=buffer(),source={connect(){return this;},start(){started++;}};
 const exporter=new PlayAlongMp3({createContext:frames=>{assert.equal(frames,4410);return{createBufferSource:()=>source,startRendering:async()=>rendered};},
  encode:async(audio,onProgress,{signal})=>{request=audio;assert.equal(signal.aborted,false);onProgress(75);return{blob:new Blob(['real encoded bytes'],{type:'audio/mpeg'})};}});
 const progress=[];const wav=new Blob(['RIFF pretend wav'],{type:'audio/wav'});
 const result=await exporter.prepare({buffer:buffer({sampleRate:48000,numberOfChannels:1}),sourceFile:wav,title:'Take.wav',onProgress:value=>progress.push(value)});
 assert.equal(request,rendered);assert.equal(started,1);assert.equal(result.blob.type,'audio/mpeg');assert.equal(result.filename,'Take.mp3');assert.match(progress.at(-1),/75%/);
});
test('track/account changes cancel conversion; no stale download is published',async()=>{
 let resolve;const exporter=new PlayAlongMp3({encode:()=>new Promise(done=>{resolve=done;})});
 const pending=exporter.prepare({buffer:buffer(),title:'Old'});exporter.cancel();resolve({blob:new Blob(['old'])});
 await assert.rejects(pending,error=>error.name==='AbortError');
 const oversized=new PlayAlongMp3();await assert.rejects(oversized.prepare({buffer:buffer({duration:86400})}),/512 MiB/);
});
test('the MP3 worker terminates promptly when encoding is cancelled',async()=>{
 let terminated=0;const abort=new AbortController();
 const encoder=new StudioMixExporter({api:null,workerFactory:()=>({postMessage(){},terminate(){terminated++;}})});
 const pending=encoder.encode(buffer(),()=>{},{signal:abort.signal});abort.abort();
 await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(terminated,1);
});
test('download anchors use safe filenames and release their temporary blob URLs',()=>{
 const calls=[],link={click(){calls.push(['download',this.href,this.download]);},remove(){calls.push('remove');}};
 saveAudioDownload({blob:new Blob(['mp3']),filename:'Song.mp3'},{document:{createElement:()=>link,body:{append(){}}},
  urls:{createObjectURL:()=> 'blob:audio',revokeObjectURL:url=>calls.push(url)},schedule:fn=>fn()});
 assert.deepEqual(calls,[['download','blob:audio','Song.mp3'],'remove','blob:audio']);
});
test('a ready YouTube job opens its original MP3 in Tone without separation or autoplay',async()=>{
 const calls=[],player={engine:{pause(){calls.push('pause');},async loadTrack(id){calls.push(id);return true;}},renderList(){},setExpanded(value){assert.equal(value,true);}};
 await useYoutubeInTone({job:{sourceTrackId:42},library:{list:async()=>calls.push('list')},player,
  projectPlayer:{pause(){calls.push('studio pause');}},workspaces:{show(name){calls.push(name);}}});
 assert.deepEqual(calls,['studio pause','pause','list','studio-source-42','tone']);
});

test('older YouTube jobs resolve only a unique authorized source within their own project',async()=>{
 const calls=[],player={engine:{pause(){},loadTrack:async id=>{calls.push(id);return true;}},renderList(){},setExpanded(){}};
 const input={job:{projectId:12,metadata:{videoId:'vid'}},player,projectPlayer:{pause(){}},workspaces:{show(){}},
  library:{list:async()=>{},tracks:[{id:'studio-source-10',origin:'youtube',projectId:12,videoId:'vid'},{id:'studio-source-20',origin:'youtube',projectId:13,videoId:'vid'}]}};
 await useYoutubeInTone(input);assert.deepEqual(calls,['studio-source-10']);
 input.library.tracks.push({...input.library.tracks[0],id:'studio-source-11'});
 await assert.rejects(useYoutubeInTone(input),/unique available source/);assert.equal(calls.length,1);
});
