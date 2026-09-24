import test from 'node:test';
import assert from 'node:assert/strict';
import {ToneCallbackSession} from '../../src/shared/ToneCallbackSession.js';

test('OAuth callback ownership is per instance, deduplicated and independent of GUI creation',async()=>{
  const globals=['window','location','sessionStorage','BroadcastChannel'].map(key=>[key,globalThis[key]]);
  const entries=new Map();const fakeLocation={href:'http://localhost/',origin:'http://localhost',pathname:'/'};
  Object.assign(globalThis,{location:fakeLocation,window:{location:fakeLocation,fetch:globalThis.fetch,addEventListener(){},removeEventListener(){}},sessionStorage:{getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)},BroadcastChannel:undefined});
  const plugin=id=>({instanceId:id,constructor:{tone3000Config:{clientId:'public',redirectUri:'http://localhost/'}},audioNode:new EventTarget()});
  const a=new ToneCallbackSession(plugin('a'),'nam'),b=new ToneCallbackSession(plugin('b'),'nam');
  let callsA=0,callsB=0;a.client.completeAuthorization=async()=>{callsA++;return {ok:true};};b.client.completeAuthorization=async()=>{callsB++;return {ok:true};};
  try{
    a.claim();const callback={href:'http://localhost/?code=test&state=test'};
    await Promise.all([a.complete(callback),a.complete(callback),b.complete(callback)]);
    assert.equal(callsA,1);assert.equal(callsB,0);
    b.claim();await b.complete(callback);assert.equal(callsB,1);
    a.claim();a.destroy();await a.complete({href:'http://localhost/?code=next'});assert.equal(callsA,1);
  }finally{a.destroy();b.destroy();for(const[key,value]of globals){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
