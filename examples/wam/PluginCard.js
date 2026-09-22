import {fallbackThumbnail} from './WamPluginRegistry.js';

export class WamPluginCard extends HTMLElement{
  set record(value){this._record=value;this.render();}
  get record(){return this._record;}
  connectedCallback(){if(this._record)this.render();}
  render(){
    const record=this._record;if(!record)return;this.replaceChildren();this.className='plugin-card';this.dataset.category=record.category;this.tabIndex=0;this.setAttribute('role','button');this.setAttribute('aria-label',`Open ${record.name} plugin GUI`);
    const image=document.createElement('img');image.alt='';image.src=record.thumbnailUrl||fallbackThumbnail(record);image.addEventListener('error',()=>{image.src=fallbackThumbnail(record);},{once:true});
    const body=document.createElement('div'),title=document.createElement('strong'),vendor=document.createElement('span'),tags=document.createElement('small');
    title.textContent=record.name;vendor.textContent=record.vendor;tags.textContent=[record.category,...record.tags.slice(0,3)].join(' · ');body.append(title,vendor,tags);
    const state=document.createElement('span');state.className=`plugin-status ${record.status}`;state.textContent=record.status;
    const open=()=>this.dispatchEvent(new CustomEvent('plugin-load',{detail:{record},bubbles:true}));
    this.onclick=event=>{if(event.target.closest('button'))return;open();};this.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}};
    const button=document.createElement('button');button.type='button';button.textContent=record.role==='tuner'?'Open tuner':'Open GUI';button.addEventListener('click',open);
    this.append(image,body,state,button);
  }
}
if(!customElements.get('wam-plugin-card'))customElements.define('wam-plugin-card',WamPluginCard);
