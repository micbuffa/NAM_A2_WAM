import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {join} from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const dist = join(root, 'dist/NAM_A2_WAM');

test('static distribution contains self-contained plugins and consistent Factory assets', async () => {
  for (const file of ['index.html', 'host.css', 'main.js', 'plugins/nam-wam/index.js', 'plugins/cabinet-wam/index.js',
    'plugins/nam-wam/nam-simd.wasm', 'plugins/cabinet-wam/nam-simd.wasm']) await stat(join(dist, file));
  const nam = JSON.parse(await readFile(join(dist, 'plugins/nam-wam/models-manifest.json')));
  const irs = JSON.parse(await readFile(join(dist, 'plugins/cabinet-wam/irs-manifest.json')));
  assert.ok(nam.assets.length > 0 && irs.assets.length > 0);
  for (const asset of nam.assets) await stat(join(dist, 'plugins/nam-wam/models', ...asset.relativePath.split('/')));
  for (const asset of irs.assets) await stat(join(dist, 'plugins/cabinet-wam/IRs', ...asset.relativePath.split('/')));
  const host = await readFile(join(dist, 'main.js'), 'utf8');
  assert.match(host, /\.\/plugins\/nam-wam\/index\.js/);
  assert.match(host, /\.\/plugins\/cabinet-wam\/index\.js/);
  assert.doesNotMatch(host, /\.\.\/(?:src|examples|build)|\/api\/test-audio-files/);
  for (const file of ['plugins/nam-wam/tone3000/Tone3000Auth.js', 'plugins/nam-wam/tone3000/Tone3000Client.js']) await stat(join(dist, file));
  assert.doesNotMatch(host, /(?:client_secret\s*[:=]\s*['"][^'"]+|secret_key\s*[:=]\s*['"]|t3k_cs_)/i);
});
