import test from 'node:test';import assert from 'node:assert/strict';
import {WEBNN_DEVICE_KEY,webnnContextOptions,loadWebnnDevice,saveWebnnDevice} from '../../examples/wam/source-separation/WebNNDevice.js';
test('CPU GPU and NPU remain distinct context preferences',()=>{for(const deviceType of ['cpu','gpu','npu'])assert.deepEqual(webnnContextOptions(deviceType),{deviceType,accelerated:deviceType!=='cpu'});});
test('unsupported spelling never silently becomes a CPU preference',()=>{for(const x of ['ntu','wasm','auto',null])assert.throws(()=>webnnContextOptions(x));});
test('remember the chosen preference across reloads',()=>{const m=new Map(),store={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};assert.equal(loadWebnnDevice(store),'gpu');for(const d of ['cpu','gpu','npu']){saveWebnnDevice(store,d);assert.equal(loadWebnnDevice(store),d);assert.equal(m.get(WEBNN_DEVICE_KEY),d);}});
test('corrupt or unavailable storage does not prevent selecting a device',()=>{assert.equal(loadWebnnDevice({getItem:()=> 'bad'}),'gpu');const s={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(loadWebnnDevice(s),'gpu');assert.equal(saveWebnnDevice(s,'npu'),'npu');});
