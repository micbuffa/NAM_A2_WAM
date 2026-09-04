import test from 'node:test';
import assert from 'node:assert/strict';
import {createCodeChallenge, createCodeVerifier, createLoginUrl, createSelectUrl, completeOAuthCallback, storageKeys} from '../../src/nam-wam/tone3000/Tone3000Auth.js';
import Tone3000Client from '../../src/nam-wam/tone3000/Tone3000Client.js';
import Tone3000Downloads from '../../src/nam-wam/tone3000/Tone3000Downloads.js';
import ModelFavorites from '../../src/nam-wam/ModelFavorites.js';
import {createFactoryBundle, createZip, sanitizePathSegment} from '../../src/nam-wam/tone3000/FactoryBundle.js';
import {readFile} from 'node:fs/promises';

const storage = () => { const values = new Map(); return {setItem:(k,v)=>values.set(k,String(v)),getItem:(k)=>values.get(k)||null,removeItem:(k)=>values.delete(k)}; };
const fixedRandom = (bytes) => bytes.fill(7);
const fakeIndexedDB = () => {
  const records = new Map(); let created = false;
  const database = {objectStoreNames:{contains:()=>created},createObjectStore:()=>{created=true;},close(){},
    transaction(){let transaction;const complete=()=>queueMicrotask(()=>transaction.oncomplete?.());const store={
      getAll(){const request={};queueMicrotask(()=>{request.result=[...records.values()];request.onsuccess?.();});return request;},
      put(value){records.set(value.identity,value);complete();},delete(identity){records.delete(identity);complete();},clear(){records.clear();complete()},
    };transaction={objectStore:()=>store};return transaction;}};
  return {open(){const request={};queueMicrotask(()=>{request.result=database;if(!created)request.onupgradeneeded?.();request.onsuccess?.();});return request;}};
};

test('TONE3000 PKCE uses URL-safe verifier and SHA-256 challenge', async () => {
  const verifier = createCodeVerifier(fixedRandom);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.equal(await createCodeChallenge('test-verifier'), 'JBbiqONGWPaAmwXk_8bT6UnlPfrn65D32eZlJS-zGG0');
});

test('Select Flow stores transaction state and requests NAM A2 models', async () => {
  const store = storage();
  const url = await createSelectUrl({clientId:'t3k_pk_test', redirectUri:'https://example.test/audio/NAM_A2_WAM/', storage:store, randomValues:fixedRandom});
  const params = new URL(url).searchParams;
  assert.equal(params.get('prompt'), 'select_tone');
  assert.equal(params.get('architecture'), '2');
  assert.equal(params.get('format'), 'nam');
  assert.equal(params.has('platform'), false);
  assert.equal(params.get('state'), store.getItem(storageKeys.state));
  assert.equal(params.get('code_challenge_method'), 'S256');
});

test('Select Flow can explicitly select IR tones without an architecture filter', async () => {
  const url = await createSelectUrl({clientId:'t3k_pk_test',redirectUri:'https://example.test/',storage:storage(),randomValues:fixedRandom,options:{format:'ir',architecture:null}});
  const params = new URL(url).searchParams;
  assert.equal(params.get('format'), 'ir'); assert.equal(params.has('architecture'), false);
});

test('OAuth callback rejects mismatched state without exchanging a code', async () => {
  const store = storage(); store.setItem(storageKeys.state, 'expected'); store.setItem(storageKeys.verifier, 'verifier');
  let calls = 0;
  const result = await completeOAuthCallback({clientId:'t3k_pk_test', redirectUri:'https://example.test/', storage:store,
    location:{href:'https://example.test/?code=abc&state=wrong'}, fetchImpl:async()=>{calls += 1;}});
  assert.equal(result.ok, false); assert.match(result.error, /state/i); assert.equal(calls, 0);
});

test('cancelled Select Flow is handled without token exchange', async () => {
  const store = storage(); store.setItem(storageKeys.state, 'expected');
  const result = await completeOAuthCallback({clientId:'t3k_pk_test', redirectUri:'https://example.test/', storage:store,
    location:{href:'https://example.test/?canceled=true'}, fetchImpl:async()=>{throw new Error('must not fetch');}});
  assert.equal(result.canceled, true); assert.match(result.error, /cancelled/i); assert.equal(store.getItem(storageKeys.state), null);
});

test('TONE3000 client sends Bearer auth, filters A2 models, and downloads model text', async () => {
  const calls = [];
  const client = new Tone3000Client({clientId:'t3k_pk_test', redirectUri:'https://example.test/', storage:storage(),
    fetchImpl:async(url, options={}) => { calls.push({url, options});
      if (url.includes('/models?')) return new Response(JSON.stringify({data:[{id:1,architecture:2,model_url:'https://download.test/a.nam',name:'A2'},{id:2,architecture:1,model_url:'x'}]}), {status:200});
      if (url === 'https://download.test/a.nam') return new Response('{"architecture":"WaveNet"}', {status:200});
      return new Response(JSON.stringify({id:42,name:'Test tone',images:['https://images.test/tone.jpg']}), {status:200});
    }});
  client.setTokens({access_token:'access-test',expires_in:3600});
  const tone = await client.getTone(42); const models = await client.getCompatibleModels(42); const model = await client.downloadModel(models[0]);
  assert.equal(tone.id, 42); assert.deepEqual(tone.images, ['https://images.test/tone.jpg']); assert.deepEqual(models.map((entry) => entry.id), [1]);
  assert.equal(model.text, '{"architecture":"WaveNet"}');
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer access-test');
  assert.equal(calls.at(-1).options.headers.get('Authorization'), 'Bearer access-test');
});

test('TONE3000 client binds native browser fetch to Window', async () => {
  const hadWindow = Object.hasOwn(global, 'window');
  const previousWindow = global.window;
  const browserWindow = {
    fetch(url, options = {}) {
      assert.equal(this, browserWindow);
      assert.match(String(url), /\/tones\/42/u);
      assert.equal(options.headers.get('Authorization'), 'Bearer access-test');
      return Promise.resolve(new Response(JSON.stringify({id:42,title:'Safari-safe'}), {status:200}));
    },
  };
  global.window = browserWindow;
  try {
    const client = new Tone3000Client({clientId:'t3k_pk_test', redirectUri:'https://example.test/', storage:storage()});
    client.setTokens({access_token:'access-test', expires_in:3600});
    assert.equal((await client.getTone(42)).title, 'Safari-safe');
  } finally {
    if (hadWindow) global.window = previousWindow;
    else delete global.window;
  }
});

test('authorization URL creation does not navigate the current window', async () => {
  const client = new Tone3000Client({clientId:'t3k_pk_test', redirectUri:'https://example.test/', storage:storage()});
  const url = await client.createAuthorizationUrl({preview:'true'});
  assert.equal(new URL(url).searchParams.get('preview'), 'true');
  assert.equal(new URL(url).searchParams.get('prompt'), 'select_tone');
});

test('login URL omits Select Flow prompt so the GUI can open its own browser', async () => {
  const url = await createLoginUrl({clientId:'t3k_pk_test', redirectUri:'https://example.test/', storage:storage(), randomValues:fixedRandom});
  assert.equal(new URL(url).searchParams.has('prompt'), false);
});

test('TONE3000 client exposes official catalog streams and pagination', async () => {
  const calls = [];
  const client = new Tone3000Client({clientId:'t3k_pk_test', redirectUri:'https://example.test/', storage:storage(), fetchImpl:async(url, options = {}) => {
    calls.push({url, options}); return new Response(JSON.stringify({data:[{id:7, title:'Catalog tone'}]}), {status:200});
  }});
  client.setTokens({access_token:'access-test', expires_in:3600});
  assert.equal((await client.listTrendingTones('amp')).data[0].id, 7);
  assert.equal((await client.listFavoritedTones({page:2, pageSize:12, gear:'amp-cab'})).data[0].id, 7);
  assert.match(calls[0].url, /\/tones\/trending\?gear=amp/u);
  assert.match(calls[1].url, /\/tones\/favorited\?page=2&page_size=12&gear=amp-cab/u);
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer access-test');
});

test('NAM GUI completes a relayed popup callback using the relayed URL', async () => {
  const gui = await readFile(new URL('../../src/nam-wam/gui.js', import.meta.url), 'utf8');
  assert.match(gui, /completeAuthorization\(location\)/u);
});

test('TONE3000 downloads persist, list, delete, and clear requested model files', async () => {
  const downloads = new Tone3000Downloads({indexedDBImpl:fakeIndexedDB()});
  await downloads.save({identity:'tone3000:7:9',name:'capture.nam',text:'{"architecture":"WaveNet"}',creator:'Creator',license:'CC BY',downloadedAt:'2026-09-03T10:00:00Z'});
  assert.equal((await downloads.list())[0].creator, 'Creator');
  await downloads.delete('tone3000:7:9'); assert.equal((await downloads.list()).length, 0);
  await downloads.save({identity:'tone3000:8:10',name:'other.nam',text:'{}'});
  await downloads.clear(); assert.equal((await downloads.list()).length, 0);
  downloads.close();
});

test('favorites persist complete external model snapshots and can be removed', async () => {
  const favorites = new ModelFavorites({indexedDBImpl:fakeIndexedDB()});
  const asset={id:'external:abc',filename:'favorite.nam',displayName:'Favorite',source:'External',data:'{"architecture":"WaveNet"}'};
  await favorites.save(asset);
  const records=await favorites.list();assert.equal(records[0].identity,'external:abc');assert.equal(records[0].asset.data,asset.data);
  await favorites.delete(asset.id);assert.equal((await favorites.list()).length,0);favorites.close();
});

test('Factory exporter creates a sanitized rich bundle without temporary model URLs', async () => {
  const tone={id:42,title:'Amp / Test',description:'Curated set',gear:'amp',format:'nam',license:'cc-by',url:'https://www.tone3000.com/tones/42',images:['https://img.test/a.jpg'],user:{username:'creator',display_name:'Creator',url:'https://www.tone3000.com/users/creator'},makes:[{name:'EVH'}],tags:[{name:'gain'}]};
  const models=[{id:7,name:'Lead V7.nam',architecture_version:2,size:'standard',model_url:'https://temporary.test/model'}];
  const bundle=await createFactoryBundle({tone,models,downloads:[{modelId:7,bytes:new TextEncoder().encode('{"architecture":"WaveNet"}')}],kind:'nam',image:{bytes:new Uint8Array([1,2,3]),contentType:'image/jpeg',url:tone.images[0]},importedAt:'2026-09-03T12:00:00Z'});
  assert.equal(sanitizePathSegment('Amp / Test'), 'Amp Test');
  assert.match(bundle.root,/tone3000\/creator\/Amp Test--t42/u);
  assert.equal(bundle.manifest.assets[0].file,'captures/Lead V7--m7.nam');
  assert.equal(bundle.manifest.tone.image,'cover.jpg');
  assert.equal(bundle.manifest.tone.category,'guitar');
  assert.doesNotMatch(JSON.stringify(bundle.manifest),/model_url|temporary\.test/u);
  const zipBytes=new Uint8Array(await createZip(bundle.entries,new Date('2026-01-01T12:00:00Z')).arrayBuffer());
  assert.deepEqual([...zipBytes.slice(0,4)],[0x50,0x4b,0x03,0x04]);
});
