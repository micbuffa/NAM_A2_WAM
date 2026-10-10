// Native graph ownership and asynchronous IR preparation; no WAP SDK or prototype patch.
const audioBytes = new Map();
const decodedByContext = new WeakMap();
export async function decodeImpulse(context, url) {
  const native = context.nativeContext || context;
  let cache = decodedByContext.get(native);
  if (!cache) { cache = new Map(); decodedByContext.set(native, cache); }
  if (!cache.has(url)) {
    const promise = (async () => {
      if (!audioBytes.has(url)) {
        audioBytes.set(url, fetch(url).then(response => {
          if (!response.ok) throw Error(`Cannot load impulse: ${response.status} ${url}`);
          return response.arrayBuffer();
        }).catch(error => { audioBytes.delete(url); throw error; }));
      }
      return native.decodeAudioData((await audioBytes.get(url)).slice(0));
    })().catch(error => { cache.delete(url); throw error; });
    cache.set(url, promise);
  }
  return cache.get(url);
}
const revisions = new WeakMap();
export function queueImpulse(context, convolver, input, url, fade) {
  const owner = context.resources;
  const serial = (revisions.get(convolver) || 0) + 1;
  revisions.set(convolver, serial);
  const task = decodeImpulse(context, url).then(buffer => {
    if (owner.destroyed || revisions.get(convolver) !== serial) return;
    // Keep the original gain ramp and ConvolverNode normalization.
    input.gain.value = 0;
    convolver.buffer = buffer;
    input.gain.linearRampToValueAtTime(1, context.currentTime + fade);
  }).catch(error => { if (!owner.destroyed && revisions.get(convolver) === serial) owner.errors.push(error); })
    .finally(() => owner.pending.delete(task));
  owner.pending.add(task);
  return task;
}
export function ownedContext(native) {
  const resources = {nodes: new Set(), pending: new Set(), errors: [], destroyed: false};
  return new Proxy(native, {get(target, key) {
    if (key === 'nativeContext') return native;
    if (key === 'resources') return resources;
    const value = Reflect.get(target, key, target);
    if (typeof value !== 'function') return value;
    if (typeof key === 'string' && key.startsWith('create')) return (...args) => {
      const node = value.apply(target, args); resources.nodes.add(node); return node;
    };
    return value.bind(target);
  }});
}
export class NativeEngine {
  constructor(context, url) {
    this.context = ownedContext(context);
    this.URL = String(url).replace(/\/$/, '');
    this._input = this.context.createGain();
    this._output = this.context.createGain();
  }
  setup() {
    this.createNodes(); this.connectNodes();
    for (const [key, value] of Object.entries(this.params)) this[key] = value;
  }
  async ready() {
    const r = this.context.resources;
    while (r.pending.size) await Promise.all([...r.pending]);
    if (r.destroyed) throw Error('Amplifier has been destroyed');
    if (r.errors.length) throw r.errors.shift();
  }
  presets() { return this.amp.getPresets?.() || this.amp.presets; }
  async applyPreset(data) {
    // Prepare assets before touching the current sound; failed downloads leave it intact.
    const impulses = [[this.reverbImpulses,data.RN],[this.cabinetImpulses,data.CN]].map(([list,name]) => {
      const impulse = name === undefined ? list[0] : list.find(item=>item.name===name);
      if (!impulse) throw Error(`Unknown impulse: ${name}`);
      return impulse.url;
    });
    await Promise.all(impulses.map(url=>decodeImpulse(this.context,url)));
    if(this.context.resources.destroyed)throw Error('Amplifier has been destroyed');
    this.params = {status: 'enable'};
    this.amp.setPreset(this, structuredClone(data));
    await this.ready();
  }
  destroy() {
    const r = this.context.resources;
    if (r.destroyed) return;
    r.destroyed = true;
    for (const node of r.nodes) { try { node.disconnect(); } catch {} }
    r.nodes.clear();
  }
}
