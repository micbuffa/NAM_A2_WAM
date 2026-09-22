import test from 'node:test';
import assert from 'node:assert/strict';
import {readAudioDevicePreferences,saveAudioDevicePreferences,resolveInputPreference} from '../../examples/wam/AudioDevicePreferences.js';

test('audio choices round-trip without overwriting unrelated device choices', () => {
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  let stored=null;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>stored,setItem:(_,value)=>{stored=value;}}});
  try {
    saveAudioDevicePreferences({inputDeviceId:'audiobox',inputChannel:1});
    saveAudioDevicePreferences({outputDeviceId:'speakers'});
    assert.deepEqual(readAudioDevicePreferences(),{inputDeviceId:'audiobox',inputChannel:1,outputDeviceId:'speakers'});
    stored='invalid JSON';assert.equal(readAudioDevicePreferences().inputChannel,0);
    stored=JSON.stringify({inputChannel:-1,inputDeviceId:7});assert.equal(readAudioDevicePreferences().inputChannel,0);
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Access denied');}});
    assert.doesNotThrow(()=>saveAudioDevicePreferences({inputChannel:1}));
    assert.equal(readAudioDevicePreferences().inputDeviceId,'');
  } finally { if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage; }
});

test('restores a connected interface and chooses an existing fallback after hardware changes', () => {
  const devices=[{deviceId:'usb'},{deviceId:'default'}];
  assert.deepEqual(resolveInputPreference(devices,'usb',1),{deviceId:'usb',channel:1});
  assert.deepEqual(resolveInputPreference(devices,'removed',1),{deviceId:'default',channel:0});
  assert.deepEqual(resolveInputPreference([{deviceId:'usb'}],'removed',1),{deviceId:'usb',channel:0});
  assert.deepEqual(resolveInputPreference([],'removed',1),{deviceId:'',channel:0});
});
