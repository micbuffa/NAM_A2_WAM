// Presentation only: never changes audio routing, arming or project state.
export const TRACK_CONTROL_STYLES=Object.freeze(['logic','ableton','reaper','cubase']);
const KEY='nam-a2.track-controls';
export class TrackControlStyle extends EventTarget {
  constructor({root=globalThis.document?.documentElement,storage,events=globalThis}={}) {
    super();Object.assign(this,{root,events});this.preference='reaper';
    try{this.storage=storage===undefined?globalThis.localStorage:storage;const value=this.storage?.getItem(KEY);if(TRACK_CONTROL_STYLES.includes(value))this.preference=value;}catch{}
    this.onStorage=event=>{if(event.key!==KEY&&event.key!==null)return;this.preference=TRACK_CONTROL_STYLES.includes(event.newValue)?event.newValue:'reaper';this.apply();};
    events.addEventListener?.('storage',this.onStorage);this.apply();
  }
  apply(){if(this.root)this.root.dataset.trackControls=this.preference;this.dispatchEvent(new Event('change'));}
  set(value){
    if(!TRACK_CONTROL_STYLES.includes(value))throw new RangeError('Unknown track control style');
    this.preference=value;try{this.storage?.setItem(KEY,value);}catch{}this.apply();
  }
  destroy(){this.events.removeEventListener?.('storage',this.onStorage);if(this.root)delete this.root.dataset.trackControls;}
}
// All variants stay inside the same button, preserving focus/listeners and state.
export function appendTrackControlGlyphs(button,kind,doc=document){
  const variants={logic:{monitor:'I',arm:'R'},ableton:{monitor:'IN',arm:'record'},reaper:{monitor:'speaker',arm:'microphone'},cubase:{monitor:'speaker',arm:'recordOutline'}};
  for(const style of TRACK_CONTROL_STYLES){
    const value=variants[style][kind],text=['I','R','IN'].includes(value);
    const glyph=doc.createElement(text?'span':'tl-icon');
    glyph.className=`track-control-glyph track-control-${style}`;glyph.setAttribute('aria-hidden','true');
    if(text)glyph.textContent=value;
    else{glyph.setAttribute('name',value);glyph.setAttribute('size','15');}
    button.append(glyph);
  }
}
export function appendTrackControlPreference(container,style){
  const field=document.createElement('div');field.className='appearance-field';
  const label=document.createElement('label');label.htmlFor='trackControlStyle';label.textContent='Track control style';
  const select=document.createElement('select');select.id='trackControlStyle';
  for(const [value,text]of [['logic','Logic-like · I / R'],['ableton','Ableton-like · IN / record circle'],['reaper','Reaper-like · speaker / microphone'],['cubase','Cubase-like · speaker / outlined record circle']]){
    const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
  }
  select.value=style.preference;select.onchange=()=>style.set(select.value);
  const sync=()=>{select.value=style.preference;};style.addEventListener('change',sync);
  const preview=document.createElement('div');preview.className='track-control-preview';
  for(const [kind,text]of [['monitor','Input monitoring'],['arm','Arm recording']]){
    const item=document.createElement('span');item.className='track-control-example';
    const glyph=document.createElement('span');glyph.className='track-control-preview-icon';glyph.setAttribute('role','img');glyph.setAttribute('aria-label',text);appendTrackControlGlyphs(glyph,kind);
    item.append(glyph,document.createTextNode(text));preview.append(item);
  }
  const note=document.createElement('p');note.className='host-help';note.textContent='Inspired icons for Studio track headers only; transport icons and themes stay unchanged. Functions and shortcuts stay the same: monitoring is on/off, independent from arming (R). Saved on this browser.';
  field.append(label,select,preview,note);container.append(field);
  return()=>style.removeEventListener('change',sync);
}
