import test from 'node:test';
import assert from 'node:assert/strict';
import {createCodeChallenge, createCodeVerifier, createSelectUrl, completeOAuthCallback, storageKeys} from '../../src/nam-wam/tone3000/Tone3000Auth.js';
import Tone3000Client from '../../src/nam-wam/tone3000/Tone3000Client.js';
import {readFile} from 'node:fs/promises';

const storage = () => { const values = new Map(); return {setItem:(k,v)=>values.set(k,String(v)),getItem:(k)=>values.get(k)||null,removeItem:(k)=>values.delete(k)}; };
const fixedRandom = (bytes) => bytes.fill(7);

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
  assert.equal(params.get('platform'), 'nam');
  assert.equal(params.get('state'), store.getItem(storageKeys.state));
  assert.equal(params.get('code_challenge_method'), 'S256');
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

test('NAM GUI completes a relayed popup callback using the relayed URL', async () => {
  const gui = await readFile(new URL('../../src/nam-wam/gui.js', import.meta.url), 'utf8');
  assert.match(gui, /completeAuthorization\(location\)/u);
});
