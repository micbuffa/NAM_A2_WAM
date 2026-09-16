import test from 'node:test';
import assert from 'node:assert/strict';
import SourceManager, {MUSIC_CAPTURE_CONSTRAINTS} from '../../examples/wam/SourceManager.js';

const makeTrack = () => ({stopped: false, stop() { this.stopped = true; }});
const makeStream = () => { const track = makeTrack(); return {track, getTracks: () => [track]}; };
const makeGain = () => ({gain:{value:1,setValueAtTime(value){this.value=value;}},connect(){this.connected=true;}});

test('enumerates only audio inputs and requests music-oriented permission', async () => {
  const permission = makeStream();
  const calls = [];
  const mediaDevices = {
    getUserMedia: async (constraints) => { calls.push(constraints); return permission; },
    enumerateDevices: async () => [{kind:'audioinput',deviceId:'usb',label:'USB Interface'}, {kind:'videoinput',deviceId:'cam'}],
  };
  const player = {pause(){}, load(){}};
  const audioContext = {currentTime:0,createGain:makeGain,createMediaElementSource: () => ({connect(){},disconnect(){}})};
  const manager = new SourceManager({audioContext, wamNode:{}, mediaDevices, player});
  const inputs = await manager.enumerateInputs({requestPermission:true});
  assert.deepEqual(inputs.map((device) => device.deviceId), ['usb']);
  assert.equal(permission.track.stopped, true);
  assert.deepEqual(calls[0].audio, MUSIC_CAPTURE_CONSTRAINTS);
});

test('device switching targets deviceId and stops the previous stream', async () => {
  const streams = [makeStream(), makeStream()];
  const constraints = [];
  const mediaDevices = {getUserMedia: async (value) => { constraints.push(value); return streams.shift(); }};
  const nodes = [];
  const audioContext = {
    currentTime: 0, createGain: makeGain,
    createMediaElementSource: () => ({connect(){},disconnect(){}}),
    createMediaStreamSource: () => { const node = {connected:false,disconnected:false,connect(){this.connected=true;},disconnect(){this.disconnected=true;}}; nodes.push(node); return node; },
  };
  const player = {pause(){},load(){}};
  const manager = new SourceManager({audioContext, wamNode:{}, mediaDevices, player});
  const first = await manager.activateLive('interface-a');
  await manager.activateLive('interface-b');
  assert.equal(first.track.stopped, true);
  assert.equal(nodes[0].disconnected, true);
  assert.deepEqual(constraints[1].audio.deviceId, {exact:'interface-b'});
  assert.equal(constraints[1].audio.echoCancellation, false);
  assert.equal(constraints[1].audio.noiseSuppression, false);
  assert.equal(constraints[1].audio.autoGainControl, false);
});

test('rejects a browser stream that does not match the requested physical input', async () => {
  const track=makeTrack();track.label='MacBook Microphone';track.getSettings=()=>({deviceId:'mac-mic'});
  const stream={track,getTracks:()=>[track],getAudioTracks:()=>[track]};
  const audioContext={currentTime:0,createGain:makeGain,createMediaElementSource:()=>({connect(){},disconnect(){}}),createMediaStreamSource:()=>({connect(){},disconnect(){}})};
  const manager=new SourceManager({audioContext,wamNode:{},mediaDevices:{getUserMedia:async()=>stream},player:{pause(){},load(){}}});
  await assert.rejects(()=>manager.activateLive('scarlett-solo'),/different audio input/u);
  assert.equal(track.stopped,true);
  assert.equal(manager.liveStream,null);
});

test('a later input request wins when browser permission requests resolve out of order', async () => {
  let resolveFirst;const firstPromise=new Promise((resolve)=>{resolveFirst=resolve;});
  const first=makeStream(),second=makeStream(),constraints=[];
  const mediaDevices={getUserMedia:(value)=>{constraints.push(value);return constraints.length===1?firstPromise:Promise.resolve(second);}};
  const nodes=[];const audioContext={currentTime:0,createGain:makeGain,createMediaElementSource:()=>({connect(){},disconnect(){}}),createMediaStreamSource:(stream)=>{const node={stream,connect(){},disconnect(){}};nodes.push(node);return node;}};
  const manager=new SourceManager({audioContext,wamNode:{},mediaDevices,player:{pause(){},load(){}}});
  const pendingFirst=manager.activateLive('mac-mic');
  const selected=await manager.activateLive('scarlett-solo');
  resolveFirst(first);await pendingFirst;
  assert.equal(selected,second);
  assert.equal(first.track.stopped,true);
  assert.equal(manager.liveStream,second);
  assert.equal(nodes.length,1);
  assert.deepEqual(constraints[1].audio.deviceId,{exact:'scarlett-solo'});
});

test('routes only the selected physical interface channel instead of downmixing loopback channels', async () => {
  const track=makeTrack();track.label='Scarlett 2i2 USB';track.getSettings=()=>({deviceId:'scarlett',channelCount:4});
  const stream={track,getTracks:()=>[track],getAudioTracks:()=>[track]};
  const connections=[];
  const splitter={connect(target,output,input){connections.push({target,output,input});},disconnect(){}};
  const source={connect(target){connections.push({sourceTarget:target});},disconnect(){}};
  const audioContext={currentTime:0,createGain:makeGain,createMediaElementSource:()=>({connect(){},disconnect(){}}),createMediaStreamSource:()=>source,createChannelSplitter:(count)=>{assert.equal(count,4);return splitter;}};
  const manager=new SourceManager({audioContext,wamNode:{},mediaDevices:{getUserMedia:async()=>stream},player:{pause(){},load(){}}});
  await manager.activateLive('scarlett',0);
  assert.deepEqual(manager.liveInput,{requestedDeviceId:'scarlett',deviceId:'scarlett',label:'Scarlett 2i2 USB',channelCount:4,channelIndex:0});
  assert.equal(connections[0].sourceTarget,splitter);
  assert.deepEqual(connections[1],{target:manager.sourceTrim,output:0,input:0});
  assert.equal(connections.some((connection)=>connection.output===2||connection.output===3),false);
});

test('file mode stops live input and connects only media element source to WAM', async () => {
  const stream = makeStream();
  let mediaConnected = false;
  const mediaNode = {connect(){mediaConnected=true;},disconnect(){mediaConnected=false;}};
  const audioContext = {currentTime:0,createGain:makeGain,createMediaElementSource:()=>mediaNode,createMediaStreamSource:()=>({connect(){},disconnect(){}})};
  const player = {src:'',pause(){},load(){this.loaded=true;}};
  const manager = new SourceManager({audioContext,wamNode:{},mediaDevices:{getUserMedia:async()=>stream},player});
  await manager.activateLive('usb');
  await manager.activateFile('./assets/audio/test.wav');
  assert.equal(stream.track.stopped, true);
  assert.equal(mediaConnected, true);
  assert.equal(manager.mode, 'file');
  assert.equal(player.loaded, true);
});

test('file and live source trims have independent defaults and remembered values', async () => {
  const stream = makeStream();
  const audioContext = {currentTime:0,createGain:makeGain,
    createMediaElementSource:()=>({connect(){},disconnect(){}}), createMediaStreamSource:()=>({connect(){},disconnect(){}})};
  const manager = new SourceManager({audioContext,wamNode:{},mediaDevices:{getUserMedia:async()=>stream},player:{pause(){},load(){}}});
  await manager.activateFile('test.wav');
  assert.equal(manager.activeTrimDb, -18);
  manager.setTrimDb(-22.5);
  await manager.activateLive('usb');
  assert.equal(manager.activeTrimDb, 0);
  manager.setTrimDb(3.5);
  await manager.activateFile('test.wav');
  assert.equal(manager.activeTrimDb, -22.5);
  await manager.activateLive('usb');
  assert.equal(manager.activeTrimDb, 3.5);
});

test('source switching routes only the active source through one shared trim node', async () => {
  const streams = [makeStream(), makeStream()];
  const connections = [];
  const mediaNode = {connect(target){connections.push(['file',target]);},disconnect(){connections.push(['file-disconnect']);}};
  const liveNodes = [];
  const audioContext = {currentTime:0,createGain:makeGain,createMediaElementSource:()=>mediaNode,
    createMediaStreamSource:()=>{const node={connect(target){connections.push(['live',target]);},disconnect(){this.disconnected=true;}};liveNodes.push(node);return node;}};
  const manager = new SourceManager({audioContext,wamNode:{},mediaDevices:{getUserMedia:async()=>streams.shift()},player:{pause(){},load(){}}});
  await manager.activateFile('test.wav');
  await manager.activateLive('usb');
  await manager.activateFile('test.wav');
  assert.equal(liveNodes[0].disconnected, true);
  assert.equal(connections.filter(([kind]) => kind === 'live').length, 1);
  assert.equal(connections.filter(([kind]) => kind === 'file').length, 2);
  assert.ok(connections.filter(([kind]) => kind === 'live' || kind === 'file').every(([,target]) => target === manager.sourceTrim));
});
