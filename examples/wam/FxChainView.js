import {fallbackThumbnail, PLUGIN_CATEGORIES} from './WamPluginRegistry.js';

const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;};
export class FxChainView {
  constructor(chain,container,report) {
    Object.assign(this,{chain,container,report});this.openSerial=0;this.activeId=null;
    this.cards=new Map();this.parking=element('div');this.parking.hidden=true;document.body.append(this.parking);
    this.dialog=element('dialog','fx-editor');
    const bar=element('header','fx-editor-bar');this.title=element('strong');this.bypass=element('button');
    this.remove=element('button','','Remove');const close=element('button','','×');close.setAttribute('aria-label','Close editor');
    bar.append(this.title,this.bypass,this.remove,close);this.mount=element('div','fx-editor-mount');this.dialog.append(bar,this.mount);document.body.append(this.dialog);
    close.onclick=()=>this.close();this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.bypass.onclick=()=>this.toggle(this.activeId);
    this.remove.onclick=async()=>{const id=this.activeId;this.close();try{await chain.remove(id);}catch(e){report(e.message,true);}};
    this.menu=element('dialog','fx-menu');document.body.append(this.menu);
    chain.addEventListener('change',()=>this.render());chain.addEventListener('error',e=>report(e.detail.message,true));
    this.render();this.timer=setInterval(()=>this.refresh().catch(error=>report(error.message,true)),350);
  }
  async toggle(id) {try{const e=this.chain.find(id);await this.chain.setBypass(id,!e.bypass);}catch(e){this.report(e.message,true);} }
  render() {
    const ids=this.chain.entries.map(e=>e.id).join('|');
    if(ids!==this.layout){
      this.layout=ids;this.container.replaceChildren();this.cards.clear();
      const add=before=>{const button=element('button','fx-add','+');button.setAttribute('aria-label',before?'Insert effect before '+(before.record?.name||before.kind):'Insert effect at end');button.onclick=()=>this.showMenu(before?.id||null,button);this.container.append(button);};
      for(const entry of this.chain.entries){
        add(entry);const card=element('article','fx-card'),toolbar=element('div','fx-card-toolbar');
        const bypass=element('button','','Bypass');bypass.onclick=()=>this.toggle(entry.id);toolbar.append(bypass);
        const photo=element('button','fx-photo'),image=element('img');photo.append(image);photo.onclick=()=>this.open(entry.id,photo);
        image.onerror=()=>{image.onerror=null;image.src=fallbackThumbnail({id:entry.id,name:entry.record?.name||entry.kind});};
        card.append(toolbar,photo);this.container.append(card);this.cards.set(entry.id,{card,bypass,image,photo});
      }add(null);
      const map=document.querySelector('.chain-map');
      if(map){map.replaceChildren(element('span','','INPUT'));for(const entry of this.chain.entries)map.append(element('i'),element('strong','',entry.record?.name||entry.kind.toUpperCase()));map.append(element('i'),element('span','','OUTPUT'));}
    }
    this.refresh().catch(error=>this.report(error.message,true));
  }
  async refresh() {
    if(this.refreshing)return;this.refreshing=true;
    try { for(const e of this.chain.entries){
      const card=this.cards.get(e.id);if(!card)continue;
      let name=e.record?.name||e.kind,image=e.record?.thumbnailUrl;
      if(e.kind==='nam'){const m=e.plugin.audioNode.getModelSnapshot();name=m?.provenance?.title||m?.name||'NeuralWAMp';image=m?.provenance?.imageUrl;}
      if(e.kind==='cabinet'){const ir=e.plugin.audioNode.getIrSnapshot();name=ir?.metadata?.title||ir?.name||'Cabinet';image=ir?.metadata?.imageUrl;}
      if(e.kind!=='effect'){const params=await e.plugin.audioNode.getParameterValues(false,'bypass');e.bypass=Number(params.bypass?.value)>=.5;}
      image ||= fallbackThumbnail({id:e.id,name});
      if(card.image.dataset.source!==image){card.image.dataset.source=image;card.image.src=image;}
      card.image.alt=name;card.photo.title=e.error?`${name}: ${e.error}`:name;card.photo.setAttribute('aria-label',`Open ${name}`);
      card.card.classList.toggle('is-bypassed',e.bypass||!e.plugin);card.bypass.setAttribute('aria-pressed',String(e.bypass));card.bypass.textContent=e.bypass?'Bypassed':'Active';card.bypass.title=e.routingStatus||'Toggle bypass';
      if(this.activeId===e.id){this.bypass.textContent=e.bypass?'Bypass ON':'Bypass OFF';this.bypass.setAttribute('aria-pressed',String(e.bypass));}
    } } finally {this.refreshing=false;}
  }
  close() {
    this.openSerial++;this.activeId=null;
    for(const gui of [...this.mount.children]){gui.setEditorVisible?.(false);this.parking.append(gui);}
    this.dialog.close();this.returnFocus?.focus();
  }
  async open(id,trigger) {
    if(this.dialog.open)this.close();const serial=++this.openSerial;this.activeId=id;this.returnFocus=trigger;
    const e=this.chain.find(id);this.title.textContent=e.record?.name||(e.kind==='nam'?'NeuralWAMp':'NeuralWAMp Cabinet');this.remove.hidden=e.kind!=='effect';
    this.dialog.showModal();this.mount.textContent='Loading editor…';
    try {
      const gui=await this.chain.getGui(id);
      if(serial!==this.openSerial){if(!gui.isConnected)this.parking.append(gui);return;}
      this.mount.replaceChildren(gui);gui.setEditorVisible?.(true);
      if(e.kind==='cabinet')gui.setRoutingStatus(e.plugin.audioNode.routingMode,e.routingStatus||'');
      await this.refresh();
    }catch(error){if(serial===this.openSerial)this.mount.textContent=`Editor unavailable: ${error.message}`;this.report(error.message,true);}
  }
  showMenu(beforeId,trigger) {
    this.menu.replaceChildren();const close=element('button','','Close');close.onclick=()=>{this.menu.close();trigger.focus();};
    const title=element('h3','','Insert an effect'),status=element('p');this.menu.append(close,title,status);
    for(const category of PLUGIN_CATEGORIES){
      const records=this.chain.registry.records.filter(r=>r.category===category&&r.role!=='tuner'&&!r.isInstrument);
      if(!records.length)continue;this.menu.append(element('h4','',category.replaceAll('-',' / ')));
      const group=element('div','fx-menu-group');this.menu.append(group);
      for(const record of records){
        const button=element('button','fx-menu-item'),image=element('img');image.src=record.thumbnailUrl||fallbackThumbnail(record);image.alt='';image.onerror=()=>{image.onerror=null;image.src=fallbackThumbnail(record);};button.append(image,element('span','',record.name));group.append(button);
        button.onclick=async()=>{
          this.menu.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent=`Loading ${record.name}…`;
          try{await this.chain.insert(record,beforeId);this.menu.close();this.container.querySelector('button')?.focus();}
          catch(error){status.textContent=error.message;this.report(error.message,true);}
          finally{this.menu.querySelectorAll('button').forEach(b=>b.disabled=false);}
        };
      }
    }this.menu.showModal();
  }
}
