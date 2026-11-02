import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {registerAppearance} from '../../examples/wam/ui/Appearance.js';
const source = await readFile(new URL('../../examples/wam/ui/theme.js', import.meta.url), 'utf8');
function boot({saved = null, dark = false, blocked = false} = {}) {
  const events = new Map(), mediaEvents = new Map(), writes = [];
  const media = {matches: dark, addEventListener: (type, fn) => mediaEvents.set(type, fn)};
  const context = {document: {documentElement: {dataset: {}}}, matchMedia: () => media,
    localStorage: {getItem() {if (blocked) throw Error('Denied'); return saved;}, setItem(key, value) {if (blocked) throw Error('Denied'); writes.push([key, value]);}},
    CustomEvent: class {constructor(type, fields) {this.type = type; Object.assign(this, fields);}},
    addEventListener(type, fn) {events.set(type, [...events.get(type) ?? [], fn]);},
    dispatchEvent(event) {for (const fn of events.get(event.type) ?? []) fn(event);},
  };
  vm.runInNewContext(source, context);
  return {api: context.NamAppearance, root: context.document.documentElement, writes,
    system(dark) {media.matches = dark; mediaEvents.get('change')();},
    storage(value) {context.dispatchEvent({type: 'storage', key: 'nam-a2.appearance', newValue: value});}};
}
test('appearance restores before main, defaults safely and validates values without storing invalid input', () => {
  for (const saved of [null, 'bogus']) assert.equal(boot({saved}).root.dataset.theme, 'dark');
  for (const saved of ['dark', 'light', 'warm']) assert.equal(boot({saved}).root.dataset.theme, saved);
  const {api, writes, root} = boot(); api.set('light'); assert.equal(root.dataset.theme, 'light');
  assert.deepEqual(writes, [['nam-a2.appearance', 'light']]);
  assert.throws(() => api.set('bogus'), /Unknown appearance/); assert.equal(writes.length, 1);
});
test('system mode follows OS changes; explicit choices stay fixed', () => {
  const f = boot({saved: 'system', dark: true}); assert.equal(f.root.dataset.theme, 'dark');
  f.system(false); assert.equal(f.root.dataset.theme, 'light'); assert.equal(f.api.preference, 'system');
  f.api.set('warm'); f.system(true); assert.equal(f.root.dataset.theme, 'warm');
});
test('blocked storage still allows session selection; cross-tab reset uses default', () => {
  const f = boot({blocked: true}); f.api.set('warm'); assert.equal(f.root.dataset.theme, 'warm');
  f.storage('light'); assert.equal(f.api.preference, 'light'); f.storage(null); assert.equal(f.root.dataset.theme, 'dark');
});
test('Appearance settings exposes labelled native choices and releases update listener', () => {
  const old = {document: globalThis.document, add: globalThis.addEventListener, remove: globalThis.removeEventListener};
  const listeners = new Set();
  const el = tag => ({tag, children: [], append(...nodes) {this.children.push(...nodes);}});
  try {
    globalThis.document = {createElement: el}; globalThis.addEventListener = (_, fn) => listeners.add(fn); globalThis.removeEventListener = (_, fn) => listeners.delete(fn);
    let section; const api = {preference: 'dark', set(value) {this.preference = value;}};
    registerAppearance({addSection(value) {section = value;}}, api);
    const container = el('section'), dispose = section.render(container);
    const [label, select] = container.children[1].children;
    assert.equal(label.htmlFor, select.id); assert.deepEqual(select.children.map(o => o.value), ['dark','light','warm','system']);
    select.value = 'warm'; select.onchange(); assert.equal(api.preference, 'warm');
    assert.equal(listeners.size, 1); dispose(); assert.equal(listeners.size, 0);
  } finally {globalThis.document = old.document; globalThis.addEventListener = old.add; globalThis.removeEventListener = old.remove;}
});
function luminance(hex) {const rgb = hex.match(/[a-f0-9]{2}/gi).map(x => parseInt(x,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4); return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('lighter palette text, primary buttons and waveforms meet contrast targets', async () => {
  const css = await readFile(new URL('../../examples/wam/ui/tokens.css', import.meta.url),'utf8');
  const blocks = [...css.matchAll(/\{([^{}]*)\}/g)].map(m => Object.fromEntries([...m[1].matchAll(/(--tl-[\w-]+):\s*(#[a-f\d]{6})\s*;/gi)].map(v=>[v[1],v[2]])));
  const light = blocks.find(b => b['--tl-bg'] === '#eef1f2'), warm = {...light,...blocks.find(b => b['--tl-bg'] === '#f1ece3')};
  for (const palette of [light,warm]) {
    for (const text of ['--tl-text','--tl-text-1','--tl-text-2','--tl-text-muted']) assert.ok(contrast(palette[text],palette['--tl-surface-1']) >= 4.5, text);
    assert.ok(contrast(palette['--tl-accent'],palette['--tl-on-accent']) >= 4.5);
    assert.ok(contrast(palette['--tl-accent-muted'],palette['--tl-surface-2']) >= 3);
  }
});
test('static and Rails source share early bootstrap and distribution includes appearance assets', async () => {
  const root = new URL('../../', import.meta.url);
  const html = await readFile(new URL('examples/wam/index.html',root),'utf8');
  assert.ok(html.indexOf('src="./ui/theme.js"') < html.indexOf('<body>'));
  const build = await readFile(new URL('tools/build-static-dist.mjs',root),'utf8');
  assert.match(build, /'ui\/theme.js'/); assert.match(build, /'ui\/Appearance.js'/);
  assert.match(await readFile(new URL('examples/wam/main.js',root),'utf8'), /registerAppearance\(settings\)/);
});
