import './shared/controls.js';
const base = new URL('./',import.meta.url);
let font;
import {createTonelabAmp} from '../utils/tonelab-pedal.js';

// TONELAB faceplate. Levels come from analysers tapped on the node input and output while the editor is
// shown (as the original editor did); the input meter only counts the enabled channels.
export async function createGui(plugin) {
  const node = plugin.audioNode, ctx = node.context;
  let taps = null, analysers = null;
  const data = new Float32Array(256);
  const peak = analyser => { analyser.getFloatTimeDomainData(data); let p = 0; for (const v of data) p = Math.max(p, Math.abs(v)); return p; };
  const level = (side) => {
    if (!analysers) return 0;
    const pair = analysers[side === 'out' ? 1 : 0];
    const p = Math.max(...pair.map((a, c) => side === 'out' || node.values[c ? 'rightInput' : 'leftInput'] ? peak(a) : 0));
    return (20 * Math.log10(Math.max(p, 1e-6)) + 60) / 60;
  };
  return createTonelabAmp(plugin, {
    name: 'Ampsim Utility',
    color: '#9aa5b1',
    skin: {image: new URL('assets/utility.png', base).href, fit: 'stretch', background: '#1b1b1b', ink: '#f8f8f8', font: 'Utility Metal', fontUrl: new URL('assets/metalfont.ttf', base).href},
    read: id => node.values[id],
    write: (id, value) => node.setParamValue(id, value),
    knobs: [
      {id: 'inputGain', label: 'Input', min: 0.01, max: 2, default: 1, log: true, format: v => `${(20 * Math.log10(v)).toFixed(1)} dB`},
      {id: 'noiseGate', label: 'Gate', min: -120, max: 0, default: -120, step: 1, unit: 'dB'},
    ],
    switches: [{id: 'leftInput', label: 'Left in'}, {id: 'rightInput', label: 'Right in'}],
    meters: [{label: 'In', level: () => level('in')}, {label: 'Out', level: () => level('out')}],
    attach: () => {
      if (taps || node.destroyed) return;
      taps = [ctx.createChannelSplitter(2), ctx.createChannelSplitter(2)];
      AudioNode.prototype.connect.call(node, taps[0]); node._output.connect(taps[1]);
      analysers = taps.map(splitter => [0, 1].map(channel => {
        const analyser = ctx.createAnalyser(); analyser.fftSize = 256; splitter.connect(analyser, channel); return analyser;
      }));
    },
    detach: () => {
      if (!taps) return;
      try { AudioNode.prototype.disconnect.call(node, taps[0]); node._output.disconnect(taps[1]); } catch {}
      for (const tap of taps) tap.disconnect();
      for (const pair of analysers) for (const analyser of pair) analyser.disconnect();
      taps = null; analysers = null;
    },
  });
}

export async function createLegacyGui(plugin) {
  font ||= new FontFace('wap2-utility-metalfont',`url("${new URL('assets/metalfont.ttf',base)}")`).load().then(face=>document.fonts.add(face));
  await font;
  const gui = document.createElement('wap2-utility-editor'); gui.initialize(plugin); return gui;
}
class UtilityEditor extends HTMLElement {
  initialize(plugin) {
    this.plugin=plugin; this.node=plugin.audioNode; this.abort=new AbortController();
    const asset = name => new URL('assets/'+name,base).href;
    this.attachShadow({mode:'open'}).innerHTML=`<style>
      :host{display:block;width:232px;height:272px;margin:8px;color-scheme:dark}
      .pedal{position:relative;width:232px;height:272px;border-radius:10px;background:url("${asset('utility.png')}") center/100% 100%;box-shadow:4px 5px 6px #000b,inset -2px -2px 5px #0003,inset 3px 1px 1px 4px #fff3;color:#f8f8f8}
      .knob{position:absolute;left:75px;width:82px;text-align:center;font:17px 'wap2-utility-metalfont';line-height:20px}
      #gain{top:38px}#gate{top:120px}
      wap2-webaudio-knob,.wap2-webaudio-knob-body{cursor:ns-resize!important}
      h2{position:absolute;top:207px;left:0;width:100%;margin:0;text-align:center;font:40px 'wap2-utility-metalfont';font-weight:normal}
      canvas{position:absolute;top:38px;width:35px;height:150px}#in{left:31px}#out{left:168px}
      .channels{position:absolute;top:188px;left:31px;width:35px;display:flex;justify-content:center}
      button{font:bold 10px Arial;background:transparent;border:0;padding:1px 3px;color:#777;cursor:pointer}button[aria-pressed=true]{color:lightgreen}button:focus-visible{outline:1px solid white}
      .out-label{position:absolute;top:189px;left:168px;width:35px;text-align:center;font:bold 10px Arial}
      .error{position:absolute;bottom:2px;font:10px system-ui;color:#ffb6b6}
    </style><div class="pedal">
      <canvas id="in" width="70" height="300" aria-label="Input levels"></canvas>
      <canvas id="out" width="70" height="300" aria-label="Output levels"></canvas>
      <div class="knob" id="gain"><wap2-webaudio-knob id="inputGain" src="${asset('Jambalaya.png')}" width="40" height="40" sprites="100" min="0.01" max="2" log="1" step="0.01" value="1" defvalue="1" aria-label="Input Gain" title="Click and drag vertically"></wap2-webaudio-knob><div>Input Gain</div></div>
      <div class="knob" id="gate"><wap2-webaudio-knob id="noiseGate" src="${asset('Jambalaya.png')}" width="40" height="40" sprites="100" min="-120" max="0" step="1" value="-120" defvalue="-120" aria-label="Noise Gate" title="Click and drag vertically"></wap2-webaudio-knob><div>Noise Gate</div></div>
      <div class="channels"><button id="leftInput" aria-label="Enable left input">L</button><button id="rightInput" aria-label="Enable right input">R</button></div><span class="out-label">OUT</span><h2>Utility</h2><span class="error" role="status"></span></div>`;
    this.knobs=[...this.shadowRoot.querySelectorAll('wap2-webaudio-knob')];
    for (const knob of this.knobs) knob.addEventListener('input',()=>this.node.setParamValue(knob.id,Number(knob.value)).catch(e=>this.error(e)),{signal:this.abort.signal});
    for (const id of ['leftInput','rightInput']) this.shadowRoot.getElementById(id).addEventListener('click',()=>this.node.setParamValue(id,1-this.node.values[id]).catch(e=>this.error(e)),{signal:this.abort.signal});
    this.unsubscribe=this.node.subscribe(()=>this.sync()); this.sync();
  }
  get properties() { return {dataWidth:{type:Number,value:232},dataHeight:{type:Number,value:272}}; }
  error(e) { this.shadowRoot.querySelector('.error').textContent=e.message; }
  sync() {
    if (!this.isConnected) return;
    for(const knob of this.knobs) knob.setValue(this.node.values[knob.id],false);
    for(const id of ['leftInput','rightInput']) this.shadowRoot.getElementById(id).setAttribute('aria-pressed',String(!!this.node.values[id]));
  }
  connectedCallback() {
    queueMicrotask(()=>this.sync());
    if (this.abort?.signal.aborted || this.taps) return;
    const ctx=this.node.context;
    this.taps=[ctx.createChannelSplitter(2),ctx.createChannelSplitter(2)];
    AudioNode.prototype.connect.call(this.node,this.taps[0]); this.node._output.connect(this.taps[1]);
    this.analysers=this.taps.map(splitter=>[0,1].map(channel=>{
      const analyser=ctx.createAnalyser();analyser.fftSize=256;splitter.connect(analyser,channel);return analyser;
    }));
    const data=new Float32Array(256);
    const draw=()=>{
      this.analysers.forEach((pair,index)=>{
        const canvas=this.shadowRoot.getElementById(index?'out':'in'),g=canvas.getContext('2d');g.clearRect(0,0,70,300);g.fillStyle='#161616';g.fillRect(0,0,70,300);
        pair.forEach((analyser,c)=>{
          analyser.getFloatTimeDomainData(data);let peak=0;for(const sample of data)peak=Math.max(peak,Math.abs(sample));
          const active=index || this.node.values[c?'rightInput':'leftInput'];
          const height=active?Math.max(0,Math.min(1,(20*Math.log10(Math.max(peak,1e-6))+60)/60))*300:0;
          const gradient=g.createLinearGradient(0,300,0,0);gradient.addColorStop(0,'#36b849');gradient.addColorStop(.75,'#d9d840');gradient.addColorStop(1,'#eb4b35');g.fillStyle=gradient;g.fillRect(c*35+5,300-height,24,height);
        });
      });
      this.raf=requestAnimationFrame(draw);
    };draw();
  }
  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    if (!this.taps) return;
    try { AudioNode.prototype.disconnect.call(this.node,this.taps[0]);this.node._output.disconnect(this.taps[1]); } catch {}
    for(const tap of this.taps)tap.disconnect();for(const pair of this.analysers)for(const analyser of pair)analyser.disconnect();
    this.taps=null;this.analysers=null;
  }
  destroy() { this.disconnectedCallback();this.abort?.abort();this.unsubscribe?.(); }
}
if(!customElements.get('wap2-utility-editor'))customElements.define('wap2-utility-editor',UtilityEditor);
