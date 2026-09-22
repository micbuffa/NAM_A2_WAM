import test from 'node:test';
import assert from 'node:assert/strict';
import OutputDeviceManager from '../../examples/wam/OutputDeviceManager.js';

test('recovers interrupted audio by selecting default output before resuming', async () => {
  const calls=[];
  const context={state:'interrupted',async setSinkId(id){calls.push(['sink',id]);},async resume(){calls.push(['resume']);this.state='running';}};
  const manager=new OutputDeviceManager({audioContext:context,mediaDevices:{}});
  manager.selectedDeviceId='unplugged';
  await manager.recover();
  assert.deepEqual(calls,[['sink',''],['resume']]);
  assert.equal(manager.selectedDeviceId,'');
});

test('terminal renderer closure is reported instead of attempting an impossible resume', async () => {
  const manager=new OutputDeviceManager({audioContext:{state:'closed',resume(){assert.fail('Cannot resume closed context');}},mediaDevices:{}});
  await assert.rejects(()=>manager.recover(),/Reload the page/u);
});

test('output changes remain ordered and recover after a rejected selection', async () => {
  const calls=[];
  const manager=new OutputDeviceManager({audioContext:{async setSinkId(id){calls.push(id);if(id==='removed')throw Error('NotFoundError');}},mediaDevices:{}});
  const failed=manager.select('removed');const fallback=manager.select('');
  await assert.rejects(()=>failed,/NotFoundError/u);await fallback;
  assert.deepEqual(calls,['removed','']);assert.equal(manager.selectedDeviceId,'');
});

test('enumerates audio outputs and selects sink IDs including system default', async () => {
  const calls = [];
  const audioContext = {setSinkId: async (id) => calls.push(id)};
  const mediaDevices = {enumerateDevices: async () => [{kind:'audioinput',deviceId:'in'}, {kind:'audiooutput',deviceId:'speakers'}]};
  const manager = new OutputDeviceManager({audioContext,mediaDevices});
  assert.deepEqual((await manager.enumerateOutputs()).map((device) => device.deviceId), ['speakers']);
  await manager.select('speakers');
  await manager.select('');
  assert.deepEqual(calls, ['speakers','']);
});

test('disappearing selected output falls back to system default', async () => {
  const calls = [];
  const manager = new OutputDeviceManager({audioContext:{setSinkId:async(id)=>calls.push(id)},
    mediaDevices:{enumerateDevices:async()=>[{kind:'audiooutput',deviceId:'remaining'}]}});
  manager.selectedDeviceId = 'removed';
  await manager.refresh();
  assert.deepEqual(calls, ['']);
  assert.equal(manager.selectedDeviceId, '');
});

test('unsupported setSinkId keeps system default without breaking audio', async () => {
  const manager = new OutputDeviceManager({audioContext:{},mediaDevices:{enumerateDevices:async()=>[]}});
  assert.equal(manager.supported, false);
  assert.equal(await manager.select('speakers'), false);
  assert.equal(manager.selectedDeviceId, '');
});

test('explicit output authorization selects the returned device', async () => {
  const calls = [];
  const manager = new OutputDeviceManager({audioContext:{setSinkId:async(id)=>calls.push(id)},
    mediaDevices:{selectAudioOutput:async()=>({kind:'audiooutput',deviceId:'authorized'})}});
  await manager.authorize();
  assert.deepEqual(calls, ['authorized']);
});
