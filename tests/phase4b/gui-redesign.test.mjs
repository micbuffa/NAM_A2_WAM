import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {access} from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('Phase 4b.2 host uses a sidebar and rack without duplicating plugin controls', async () => {
  const [html, css, main] = await Promise.all([read('examples/wam/index.html'), read('examples/wam/host.css'), read('examples/wam/main.js')]);
  assert.match(html, /class="host-sidebar"/u);
  assert.match(html, /class="rack-grid"/u);
  assert.match(html, /href="\.\/host\.css"/u);
  assert.doesNotMatch(html, /host-(?:inputGain|outputGain|bypass)|id="cabinetMode"/u);
  assert.match(css, /grid-template-columns:\s*286px minmax\(0, 1fr\)/u);
  assert.match(css, /@media \(max-width: 720px\)/u);
  assert.match(main, /cabinet-routing-mode/u);
  assert.match(main, /node\.connect\(cabinetNode\)\.connect\(context\.destination\)/u);
});

test('NAM GUI is container-scoped and keeps compact source/details drawers', async () => {
  const gui = await read('src/nam-wam/gui.js');
  assert.match(gui, /class="drawer modelDrawer"/u);
  assert.match(gui, /class="drawer detailsDrawer"/u);
  for (const source of ['Factory', 'External', 'TONE3000']) assert.match(gui, new RegExp(`data-source="${source}"`, 'u'));
  assert.match(gui, /class="tone3000Browse"/u);
  assert.match(gui, /class="tone3000Auth"/u);
  assert.match(gui, /class="tone3000Authenticate"/u);
  assert.match(gui, /class="tone3000Logo"[^>]*src="\$\{tone3000LogoUrl\}"/u);
  assert.match(gui, /showToneAuthentication\(!this\.tone3000\?\.tokens\?\.access_token\)/u);
  await access(new URL('../../src/nam-wam/tone3000/TONE3000-logo.svg', import.meta.url));
  assert.match(gui, /class="tone3000Image"/u);
  assert.match(gui, /class="currentToneImage"/u);
  assert.match(gui, /class="tone3000Image"[^>]*crossorigin="anonymous"/u);
  assert.match(gui, /class="currentToneImage"[^>]*crossorigin="anonymous"/u);
  assert.match(gui, /tone\.images/u);
  assert.match(gui, /imageUrl:\s*getToneImageUrl\(this\._tone\)/u);
  assert.match(gui, /\.tone3000Image\s*\{[^}]*object-fit:contain/u);
  assert.match(gui, /\.currentToneImage\s*\{[^}]*object-fit:contain/u);
  assert.match(gui, /completeAuthorization\(location\)/u);
  assert.doesNotMatch(gui, /100vw|position:\s*fixed|(?:^|[}\s,])body\s*\{/mu);
});

test('Cabinet GUI is container-scoped and exposes AUTO plus collapsible IR sources', async () => {
  const gui = await read('src/cabinet-wam/gui.js');
  assert.match(gui, /class="routingMode"/u);
  assert.match(gui, /<option value="auto">AUTO<\/option>/u);
  assert.match(gui, /class="drawer irDrawer"/u);
  assert.match(gui, /data-source="Factory"/u);
  assert.match(gui, /data-source="External"/u);
  assert.doesNotMatch(gui, /100vw|position:\s*fixed|(?:^|[}\s,])body\s*\{/mu);
});
