import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile, unlink} from 'node:fs/promises';
import {resolve} from 'node:path';

test('development server dynamically discovers added and removed audio files', async (t) => {
  const port = 18765;
  const marker = resolve('examples/wam/assets/audio/.phase3-dynamic-test.wav');
  const server = spawn(process.execPath, ['examples/wam/server.mjs'], {env:{...process.env,PORT:String(port)},stdio:'ignore'});
  t.after(async () => { server.kill(); try { await unlink(marker); } catch {} });
  await new Promise((resolveReady, reject) => {
    const timeout = setTimeout(resolveReady, 500);
    server.once('error', (error) => { clearTimeout(timeout); reject(error); });
  });
  await writeFile(marker, new Uint8Array([82,73,70,70]));
  const added = await fetch(`http://127.0.0.1:${port}/api/test-audio-files`).then((response) => response.json());
  assert.ok(added.includes('.phase3-dynamic-test.wav'));
  await unlink(marker);
  const removed = await fetch(`http://127.0.0.1:${port}/api/test-audio-files`).then((response) => response.json());
  assert.ok(!removed.includes('.phase3-dynamic-test.wav'));
});
