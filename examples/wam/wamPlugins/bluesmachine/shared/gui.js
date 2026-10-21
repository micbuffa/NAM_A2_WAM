import './controls.js';
import {prepareFonts} from './fonts.js';

import {createTonelabAmp} from '../../utils/tonelab-pedal.js';

// Each machine keeps its original faceplate picture and title font (assets of this plugin).
const asset = path => new URL(`../assets/${path}`, import.meta.url).href;
const LOOKS = {
  blues: {name: 'Blues Machine', color: '#4f86c6',
    skin: {image: asset('BluesMachine.png'), fit: 'stretch', background: '#3b3229', ink: '#2b1d10', vendorInk: '#4a3a22', font: 'Henny Penny'}},
  cleanfull: {name: 'Clean Machine', color: '#e3a857',
    skin: {image: asset('CleanMachine.png'), fit: 'stretch', background: '#f07a2a', ink: '#3b1f0a', vendorInk: '#5a3a1a',
      font: 'Shady Lane', fontUrl: asset('shadylane-webfont.woff2')}},
  modernmetal: {name: 'Modern Metal', color: '#b9c2cc',
    skin: {image: asset('backgrounds/ModernMetalBackground1.png'), fit: 'stretch', background: '#6f6e73', ink: '#1a1a1a', vendorInk: '#333',
      font: 'Frijole', fontUrl: asset('fonts/Frijole-Regular.ttf')}},
};
const KNOBS = [['volume','Volume'],['master','Master'],['drive','Drive'],['bass','Bass'],['middle','Middle'],['treble','Treble'],['presence','Presence'],['reverb','Reverb']];

// TONELAB faceplate. The editor shows Reverb on 0..10 while the DSP/state range is 0..4 (as the original GUI did).
export async function createGui(plugin) {
  const node = plugin.audioNode;
  const scale = id => id === 'reverb' ? 0.4 : 1;
  return createTonelabAmp(plugin, {
    ...LOOKS[plugin.slug],
    vendor: 'WAP amp sim',
    bypass: 'bypass',
    read: id => node.values[id] / scale(id),
    write: (id, value) => node.setParamValue(id, value * scale(id)),
    knobs: KNOBS.map(([id, label]) => ({id, label, min: 0, max: 10, default: node.config[id].defaultValue / scale(id)})),
    selects: [{
      label: 'Preset', header: true,
      options: node.getFactoryPresets().map(p => ({value: p.id, label: p.name})),
      get: () => node.selectedPreset,
      set: id => node.loadFactoryPreset(id),
      disabled: () => Boolean(node.loading),
    }],
    status: () => node.loading ? 'Loading sound\u2026' : '',
  });
}

export async function createLegacyGui(plugin, baseURL) {
  const gui = document.createElement('wap2-amp-editor');
  await gui.initialize(plugin,baseURL); return gui;
}
class AmpEditor extends HTMLElement {
  async initialize(plugin,baseURL) {
    this.plugin = plugin; this.node = plugin.audioNode; this.baseURL = baseURL;
    this.attachShadow({mode:'open'});
    this.abort = new AbortController();
    const {default:template} = await import(new URL('template.js',baseURL));
    const styledTemplate = await prepareFonts(plugin.slug,baseURL,template);
    if (this.abort.signal.aborted) return;
    this.shadowRoot.innerHTML = styledTemplate.replace(/url\(['"]?(\.\/assets\/[^)'"\s]+)['"]?\)/g,
      (_,path)=>`url("${new URL(path,baseURL).href}")`)+
      `<style>
        :host{margin:8px 0 30px;color-scheme:light;--preset-width:120px}
        :host([data-amp=blues]){--preset-width:70px}
        :host([data-amp=modernmetal]){--preset-width:100px}
        #background-image{border-radius:10px;display:block}
        .feedback{position:absolute;top:155px;left:0;font:12px system-ui;color:inherit}
        select:disabled{opacity:.5}
        .knob, wap2-webaudio-knob, .wap2-webaudio-knob-body{cursor:ns-resize !important}
        .amp-footer{position:absolute;left:30px;right:20px;top:100px;height:30px;display:grid;
          grid-template-columns:var(--preset-width) minmax(0,1fr) 60px;gap:8px;align-items:center}
        .amp-footer #menuPresets{position:static;width:100%;height:22px;box-sizing:border-box;margin:0;padding:0 3px}
        .amp-footer #label_713{position:static;text-align:center;white-space:nowrap;font-size:30px;line-height:30px;cursor:default}
        :host([data-amp=modernmetal]) .amp-footer #label_713{font-size:20px}
        .amp-footer #switch1{position:static;top:auto;right:auto;bottom:auto;width:60px;height:30px;display:block}
      </style><div class="feedback" role="status"></div>`;
    this.dataset.amp = plugin.slug;
    const footer=document.createElement('div'); footer.className='amp-footer';
    footer.append(this.shadowRoot.querySelector('#menuPresets'),this.shadowRoot.querySelector('#label_713'),this.shadowRoot.querySelector('.switchCont#switch1'));
    this.shadowRoot.append(footer);
    const modern=plugin.slug==='modernmetal', blues=plugin.slug==='blues';
    const asset = path => new URL('assets/'+path,baseURL).href;
    this.shadowRoot.querySelector('#background-image').src = asset(modern?'backgrounds/ModernMetalBackground1.png':blues?'BluesMachine.png':'CleanMachine.png');
    this.knobs = [...this.shadowRoot.querySelectorAll('.knob')];
    for (const element of this.knobs) {
      const knob=element.querySelector('wap2-webaudio-knob');
      knob.setAttribute('src',asset(modern?'knobs/Jambalaya.png':blues?'Hippy_2.png':'Jambalaya.png'));
      knob.setAttribute('aria-label',element.id);
      if (element.id==='reverb') {
        // The editor spans 0..10 while the unchanged DSP/state range spans 0..4 here.
        knob.setAttribute('step','0.01');
        knob.setAttribute('value',String(this.node.values.reverb/0.4));
        knob.setAttribute('defvalue',String(this.node.values.reverb/0.4));
      }
      knob.setAttribute('title','Click and drag vertically');
      knob.addEventListener('input',()=>this.node.setParamValue(element.id,Number(knob.value)*(element.id==='reverb'?0.4:1)).catch(e=>this.error(e)),{signal:this.abort.signal});
    }
    for (const [container,id,invert] of [['switch1','bypass',true],['switchpreamp','preampPos',false],['switchfilter','filterstate',false]]) {
      const control=this.shadowRoot.querySelector(`#${container} wap2-webaudio-switch`);
      if (!control) continue;
      control.setAttribute('src',asset(modern?'switches/switch_2.png':'switch_2.png'));
      control.setAttribute('aria-label',id);
      control.addEventListener('change',()=>this.node.setParamValue(id,invert?1-Number(control.value):Number(control.value)).catch(e=>this.error(e)),{signal:this.abort.signal});
    }
    this.menu = this.shadowRoot.querySelector('#menuPresets');
    // Match the original WAP menu: selection, order and historical display names.
    this.menu.replaceChildren(...this.node.getFactoryPresets().map(p=>new Option(p.name,p.id)));
    this.menu.setAttribute('aria-label','Amp preset');
    this.menu.addEventListener('change',async()=>{
      try { await this.node.loadFactoryPreset(this.menu.value); } catch(e){this.error(e);}
    },{signal:this.abort.signal});
    this.unsubscribe=this.node.subscribe(()=>this.refresh());
    this.refresh();
  }
  connectedCallback() { queueMicrotask(()=>this.refresh()); }
  refresh() {
    if (!this.menu || !this.isConnected) return;
    const values=this.node.values;
    for (const el of this.knobs) el.querySelector('wap2-webaudio-knob').setValue(el.id==='reverb'?values[el.id]/0.4:values[el.id],false);
    for (const [container,id,invert] of [['switch1','bypass',true],['switchpreamp','preampPos',false],['switchfilter','filterstate',false]]) {
      const control=this.shadowRoot.querySelector(`#${container} wap2-webaudio-switch`);
      control?.setValue(invert?1-values[id]:values[id],false);
    }
    this.menu.value=this.node.selectedPreset; this.menu.disabled=!!this.node.loading;
    this.shadowRoot.querySelector('.feedback').textContent=this.node.loading?'Loading sound…':'';
  }
  error(error) { this.shadowRoot.querySelector('.feedback').textContent=error.message; this.refreshMenu(); }
  refreshMenu() { if(this.menu)this.menu.value=this.node.selectedPreset; }
  destroy() { this.abort?.abort(); this.unsubscribe?.(); }
}
if (!customElements.get('wap2-amp-editor')) customElements.define('wap2-amp-editor',AmpEditor);
