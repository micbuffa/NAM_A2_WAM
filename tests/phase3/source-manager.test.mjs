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
