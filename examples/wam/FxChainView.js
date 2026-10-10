import {fallbackThumbnail, PLUGIN_CATEGORIES} from './WamPluginRegistry.js';

const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;};
export class FxChainView {
  constructor(chain,container,report,options={}) {
    Object.assign(this,{chain,container,report,options});this.openSerial=0;this.activeId=null;
    this.cards=new Map();this.parking=element('div');this.parking.hidden=true;document.body.append(this.parking);
    this.dialog=element('dialog','fx-editor');
    const bar=element('header','fx-editor-bar');this.title=element('strong');
    this.replace=element('button','fx-replace','Replace');this.remove=element('button','','Remove');const close=element('button','','×');close.setAttribute('aria-label','Close editor');
    bar.append(this.title,this.replace,this.remove,close);this.mount=element('div','fx-editor-mount');
    const body=element('div','fx-editor-body');this.editorSides={input:this.createEditorSide('input'),output:this.createEditorSide('output')};
    body.append(this.editorSides.input.root,this.mount,this.editorSides.output.root);this.dialog.append(bar,body);document.body.append(this.dialog);
    this.mount.addEventListener('nam-capture-loaded',event=>{if(this.dialog.open&&event.target===this.chain.find(this.activeId)?.plugin?.audioNode?.gui)this.close();});
    close.onclick=()=>this.close();this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.remove.onclick=()=>this.confirmRemove(this.activeId);
    this.replace.onclick=()=>this.showMenu(null,this.replace,this.activeId);
    this.confirmation=element('dialog','fx-confirm');document.body.append(this.confirmation);
    this.menu=element('dialog','fx-menu');document.body.append(this.menu);
    chain.addEventListener('change',()=>this.render());chain.addEventListener('error',e=>report(e.detail.message,true));
    this.setupMeters();this.render();this.animateLevels();this.timer=setInterval(()=>this.refresh().catch(error=>report(error.message,true)),350);
  }
  createThinMeter(label) {
    const meter=element('span','fx-thin-meter');meter.setAttribute('role','meter');
    meter.setAttribute('aria-label',label);meter.setAttribute('aria-valuemin','-60');meter.setAttribute('aria-valuemax','0');
    meter.append(element('span','fx-meter-fill'));return meter;
  }
  updateThinMeter(meter,value,now) {
    meter.style.setProperty('--meter-level',String(value.level));
    meter.setAttribute('aria-valuenow',String(Math.max(-60,Math.min(0,value.db)).toFixed(1)));
    if(value.peak>=1)meter.dataset.clipUntil=String(now+1000);
    const clipping=Number(meter.dataset.clipUntil)>now;
    meter.classList.toggle('is-clipping',clipping);
    meter.title=clipping?'CLIP':`${value.db.toFixed(1)} dBFS`;
    meter.setAttribute('aria-valuetext',meter.title);
  }
  createEditorSide(side) {
    const name=side==='input'?'Input':'Output',root=element('aside','fx-editor-side fx-editor-'+side);
    const button=element('button','fx-plugin-gain-toggle');button.title=name+' gain';button.setAttribute('aria-label',name+' gain');button.setAttribute('aria-expanded','false');
    button.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 3v18M12 3v18M19 3v18M2 8h6M9 16h6M16 10h6"/></svg>';
    const panel=element('div','fx-plugin-gain-panel');panel.hidden=true;
    const label=element('label','',name+' gain'),slider=element('input'),value=element('output'),reset=element('button','','Reset');
    slider.type='range';slider.min='-48';slider.max='12';slider.step='.5';slider.setAttribute('aria-label',name+' gain in dB');label.append(slider);panel.append(label,value,reset);
    const set=db=>{try{this.chain.setEntryGain(this.activeId,side,db);this.syncEditorGains();}catch(error){this.report(error.message,true);}};
    slider.oninput=()=>set(slider.value);reset.onclick=()=>set(0);
    button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)slider.focus();};
    panel.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();}};
    const meter=this.createThinMeter(name+' level'),caption=element('span','fx-editor-side-label',side==='input'?'IN':'OUT');root.append(button,caption,meter,panel);
    return {root,button,panel,slider,value,meter};
  }
  syncEditorGains() {
    const entry=this.chain.entries.find(e=>e.id===this.activeId);if(!entry)return;
    for(const side of ['input','output']){const ui=this.editorSides[side],db=entry[side+'Db'];ui.slider.value=String(db);ui.value.textContent=`${db.toFixed(1)} dB`;ui.slider.setAttribute('aria-valuetext',ui.value.textContent);ui.button.title=`${side==='input'?'Input':'Output'} gain: ${ui.value.textContent}`;}
  }
  setupMeters() {
    // Decorative analogue face; the surrounding ARIA meter exposes dBFS.
    const point=(angle,radius)=>{
      const radians=angle*Math.PI/180;return [60+Math.sin(radians)*radius,68-Math.cos(radians)*radius];
    };
    let ticks='';
    for(let db=-60;db<=0;db+=6){
      const angle=-52+(db+60)/60*104,[x1,y1]=point(angle,48),[x2,y2]=point(angle,db%12===0?42:45);
      ticks+=`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${db>=-6?'#b33c2a':'#554734'}"/>`;
    }
    for(const db of [-60,-30,-12,0]){
      const [x,y]=point(-52+(db+60)/60*104,56);
      ticks+=`<text x="${x}" y="${y}" text-anchor="middle">${db}</text>`;
    }
    for(const meter of document.querySelectorAll('.fx-meter:not(.fx-meter-linear)'))meter.innerHTML=`<svg viewBox="0 0 120 76" aria-hidden="true"><path class="vu-arc" d="M22 38 Q60 1 98 38"/>${ticks}<text x="60" y="47" text-anchor="middle" class="vu-unit">dBFS</text><circle class="vu-clip" cx="109" cy="9" r="3"/><g class="vu-needle"><path d="M60 68L60 22"/></g><circle cx="60" cy="68" r="3" fill="#554734"/></svg>`;
    for(const meter of document.querySelectorAll('.fx-meter-linear'))meter.innerHTML='<span class="fx-meter-fill" aria-hidden="true"></span>';
    for(const input of document.querySelectorAll('.fx-gain input')){
      const sync=()=>input.setAttribute('aria-valuetext',`${Number(input.value).toFixed(1)} dB`);
      input.addEventListener('input',sync);input.addEventListener('change',sync);sync();
    }
  }
  async confirmRemove(id) {
    const entry=this.chain.find(id);
    if(this.confirmation.open)return;
    const title=element('h3','',`Remove ${entry.record?.name||entry.kind}?`);title.id='fx-remove-title';
    const message=element('p','','This instance and its settings will be removed from the chain.');
    const cancel=element('button','','Cancel'),remove=element('button','fx-confirm-delete','Remove');
    this.confirmation.setAttribute('aria-labelledby',title.id);this.confirmation.replaceChildren(title,message,cancel,remove);
    const confirmed=await new Promise(resolve=>{
      const finish=value=>{this.confirmation.close();resolve(value);};
      cancel.onclick=()=>finish(false);remove.onclick=()=>finish(true);
      this.confirmation.oncancel=event=>{event.preventDefault();finish(false);};
      this.confirmation.showModal();cancel.focus();
    });
    if(!confirmed)return;
    if(this.activeId===id)this.close();
    try{await this.chain.remove(id);this.container.querySelector('button')?.focus();}catch(error){this.report(error.message,true);}
  }
  animateLevels() {
    const tick=now=>{
      if(!document.hidden&&(!this.lastMeterTime||now-this.lastMeterTime>=33)){
        this.lastMeterTime=now;
        for(const [side,meter] of [['Input',this.chain.inputMeter],['Output',this.chain.outputMeter]]){
          const value=meter.read(),bar=document.getElementById(`${this.options.meterPrefix||'chain'}${side}Meter`),label=document.getElementById(`${this.options.meterPrefix||'chain'}${side}Level`);
          if(bar){
            bar.style.setProperty('--meter-level',String(value.level));
            bar.style.setProperty('--needle-angle',`${-52+value.level*104}deg`);bar.setAttribute('aria-valuenow',String(Math.max(-60,Math.min(0,value.db)).toFixed(1)));
            if(value.peak>=1)bar.dataset.clipUntil=String(now+1000);
            bar.classList.toggle('is-clipping',Number(bar.dataset.clipUntil)>now);
            label.textContent=Number(bar.dataset.clipUntil)>now?'CLIP':value.db<=-60?'−∞ dBFS':`${value.db.toFixed(1)} dBFS`;
          }
        }
        for(const entry of this.chain.entries){
          const value=entry.meter.read(),out=entry.outputMeter.read(),view=this.cards.get(entry.id),card=view?.card;if(!card)continue;
          this.updateThinMeter(view.inputMeter,value,now);this.updateThinMeter(view.outputMeter,out,now);
          if(this.activeId===entry.id&&this.dialog.open){this.updateThinMeter(this.editorSides.input.meter,value,now);this.updateThinMeter(this.editorSides.output.meter,out,now);}
          // RMS controls normal colour; a full-scale peak overrides it for one second.
          if(value.peak>=1)card.dataset.clipUntil=String(now+1000);
          const clipping=Number(card.dataset.clipUntil)>now;
          const warmth=Math.max(0,Math.min(1,(value.db+30)/24));
          card.style.setProperty('--halo-color',clipping?'#ff3535':`hsl(${140-108*warmth} 95% 62%)`);
          card.style.setProperty('--halo',clipping?1:Math.pow(value.level,.65));
        }
      }
      this.animation=requestAnimationFrame(tick);
    };this.animation=requestAnimationFrame(tick);
  }
  dropTarget(target,beforeId) { target.dataset.beforeId=beforeId||''; }
  async toggle(id) {try{const e=this.chain.find(id);await this.chain.setBypass(id,!e.bypass);}catch(e){this.report(e.message,true);} }
  render() {
    const ids=this.chain.entries.map(e=>e.id+':'+(e.plugin?.instanceId||e.record?.entryUrl||'')).join('|');
    if(ids!==this.layout){
      this.layout=ids;this.container.replaceChildren();this.cards.clear();
      const add=before=>{const button=element('button','fx-add','+');button.setAttribute('aria-label',before?'Insert effect before '+(before.record?.name||before.kind):'Insert effect at end');button.onclick=()=>this.showMenu(before?.id||null,button);this.dropTarget(button,before?.id||null);const slot=element('span','fx-slot');slot.append(button);slot.dataset.index=String(before?this.chain.entries.indexOf(before):this.chain.entries.length);
        if(this.options.onRoute){const route=element('button','fx-route-action','↳');route.title='Route to B here';route.setAttribute('aria-label','Route to B at this position');route.onclick=()=>this.options.onRoute(Number(slot.dataset.index),route);slot.append(route);
          let hideTimer;
          const showRoute=()=>{clearTimeout(hideTimer);slot.classList.add('route-visible');};
          const delayHide=()=>{clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!slot.matches(':hover,:focus-within'))slot.classList.remove('route-visible');},700);};
          slot.addEventListener('pointerenter',showRoute);slot.addEventListener('pointerleave',delayHide);
          slot.addEventListener('focusin',showRoute);slot.addEventListener('focusout',delayHide);}
        this.container.append(slot);};
      for(const entry of this.chain.entries){
        add(entry);const card=element('article','fx-card'),toolbar=element('div','fx-card-toolbar');
        const bypass=element('button','fx-bypass','Bypass');bypass.onclick=()=>this.toggle(entry.id);toolbar.append(bypass);
        const remove=element('button','fx-delete');
        remove.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
        remove.setAttribute('aria-label',`Remove ${entry.record?.name||entry.kind}`);
        remove.title='Remove plugin';
        remove.onclick=()=>this.confirmRemove(entry.id);toolbar.append(remove);
        const photo=element('button','fx-photo'),image=element('img'),caption=element('span','fx-caption');const inputMeter=this.createThinMeter('Plugin input level'),outputMeter=this.createThinMeter('Plugin output level');inputMeter.classList.add('fx-card-input-meter');outputMeter.classList.add('fx-card-output-meter');photo.append(inputMeter,image,caption,outputMeter);image.draggable=false;
        photo.onclick=()=>{if(!this.suppressClick)this.open(entry.id,photo);};
        let pointer=null,drop=null,crossLane=false;
        const clearDrag=()=>{card.classList.remove('is-dragging');drop?.classList.remove('fx-drop-target');pointer=null;drop=null;};
        photo.addEventListener('pointerdown',event=>{
          if(event.button!==0)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,moving:false};
          photo.setPointerCapture(event.pointerId);
        });
        photo.addEventListener('pointermove',event=>{
          if(!pointer)return;
          if(!pointer.moving&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)<6)return;
          pointer.moving=true;this.suppressClick=true;card.classList.add('is-dragging');
          drop?.classList.remove('fx-drop-target');
          drop=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-before-id]');
          crossLane=Boolean(drop&&!this.container.contains(drop));
          if(!this.container.contains(drop))drop=null;drop?.classList.add('fx-drop-target');
          const scroller=this.container.closest('.fx-scroll')||this.container,bounds=scroller.getBoundingClientRect();
          if(event.clientX<bounds.left+45)scroller.scrollLeft-=20;
          if(event.clientX>bounds.right-45)scroller.scrollLeft+=20;
        });
        photo.addEventListener('pointerup',async()=>{
          const target=pointer?.moving&&drop?drop.dataset.beforeId:null,moving=pointer?.moving,swap=drop?.classList.contains('fx-card');
          clearDrag();
          if(moving)setTimeout(()=>{this.suppressClick=false;},0);
          if(moving&&crossLane)this.report('Moving effects between chains is not supported yet.',true);
          if(target===null)return;
          try{await (swap?this.chain.swap(entry.id,target):this.chain.move(entry.id,target||null));this.cards.get(entry.id)?.photo.focus();}catch(error){this.report(error.message,true);}
        });
        photo.addEventListener('pointercancel',()=>{clearDrag();this.suppressClick=false;});
        photo.addEventListener('keydown',async event=>{
          if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();
          const entries=this.chain.entries,index=entries.indexOf(entry),left=event.key==='ArrowLeft';
          if(left?index===0:index===entries.length-1)return;
          try{await this.chain.move(entry.id,left?entries[index-1].id:entries[index+2]?.id||null);this.cards.get(entry.id)?.photo.focus();}catch(error){this.report(error.message,true);}
        });
        this.dropTarget(card,entry.id);
        image.onerror=()=>{image.onerror=null;image.src=fallbackThumbnail({id:entry.id,name:entry.record?.name||entry.kind});};
        card.append(toolbar,photo);const captures=entry.plugin?.getCaptureChoices?this.createCaptureSelector(entry):null;if(captures)card.append(captures.root);this.container.append(card);this.cards.set(entry.id,{card,bypass,image,photo,caption,inputMeter,outputMeter,captures});
      }add(null);
      const output=element('span','fx-output-link');
      const arrow=element('span','','→');arrow.setAttribute('aria-hidden','true');
      output.append(arrow,element('span','','Output'));this.container.append(output);
      const map=this.options.secondary?null:document.querySelector('.chain-map');
      if(map){map.replaceChildren(element('span','','INPUT'));for(const entry of this.chain.entries)map.append(element('i'),element('strong','',entry.record?.name||entry.kind.toUpperCase()));map.append(element('i'),element('span','','OUTPUT'));}
    }
    this.options.onLayout?.();
    this.refresh().catch(error=>this.report(error.message,true));
  }
  async refresh() {
    if(this.refreshing)return;this.refreshing=true;
    try { for(const e of this.chain.entries){
      const card=this.cards.get(e.id);if(!card)continue;
      let name=e.record?.name||e.kind,image=e.record?.thumbnailUrl;
      if(e.plugin&&e.kind==='nam'){const m=e.plugin.audioNode.getModelSnapshot();name=m?.provenance?.title||m?.name||'NeuralWAMp';image=m?.provenance?.imageUrl;}
      if(e.plugin&&e.kind==='cabinet'){const ir=e.plugin.audioNode.getIrSnapshot();name=ir?.metadata?.title||ir?.name||'Cabinet';image=ir?.metadata?.imageUrl;}
      if(e.plugin&&e.kind!=='effect'){const params=await e.plugin.audioNode.getParameterValues(false,'bypass');e.bypass=Number(params.bypass?.value)>=.5;}
      image ||= fallbackThumbnail({id:e.id,name});
      if(card.image.dataset.source!==image){card.image.dataset.source=image;card.image.src=image;}
      card.image.alt=name;card.photo.title=e.error?`${name}: ${e.error}`:name;card.photo.setAttribute('aria-label',`Open ${name}`);
      card.caption.textContent=name;
      if(card.captures)await this.refreshCaptureSelector(e,card.captures);
      card.card.classList.toggle('is-bypassed',e.bypass||!e.plugin);card.bypass.setAttribute('aria-pressed',String(e.bypass));card.bypass.textContent=e.bypass?'Bypassed':'Active';card.bypass.title=e.routingStatus||'Toggle bypass';
    } this.syncEditorGains(); } finally {this.refreshing=false;}
  }
  createCaptureSelector(entry) {
    const root=element('div','fx-capture-selector'),previous=element('button','','‹'),select=element('select'),next=element('button','','›');
    previous.type=next.type='button';previous.setAttribute('aria-label','Previous amp capture');next.setAttribute('aria-label','Next amp capture');select.setAttribute('aria-label','Amp capture');
    root.append(previous,select,next);const ui={root,previous,select,next,items:[],index:-1,busy:false};
    const choose=async index=>{const item=ui.items[index];if(ui.busy||!item)return;ui.busy=true;previous.disabled=next.disabled=select.disabled=true;
      try{await entry.plugin.selectCapture(item.id);}catch(error){this.report(error.message,true);}finally{ui.busy=false;await this.refreshCaptureSelector(entry,ui);}};
    select.onchange=()=>choose(select.selectedIndex);previous.onclick=()=>choose(ui.index-1);next.onclick=()=>choose(ui.index+1);return ui;
  }
  async refreshCaptureSelector(entry,ui) {
    if(ui.busy)return;
    const choices=await entry.plugin.getCaptureChoices();
    const key=JSON.stringify(choices.items);
    if(ui.key!==key){ui.key=key;ui.select.replaceChildren(...choices.items.map(item=>{const option=element('option','',item.name);option.value=item.id;return option;}));}
    ui.items=choices.items;ui.index=choices.index;ui.select.selectedIndex=choices.index;
    ui.select.title=choices.items[choices.index]?.name||'No capture loaded';
    ui.select.disabled=!!choices.busy||choices.items.length<2;
    ui.previous.disabled=!!choices.busy||choices.index<=0;ui.next.disabled=!!choices.busy||choices.index<0||choices.index>=choices.items.length-1;
  }
  close() {
    this.openSerial++;this.activeId=null;
    for(const gui of [...this.mount.children]){gui.setEditorVisible?.(false);this.parking.append(gui);}
    this.dialog.close();this.returnFocus?.focus();
  }
  async open(id,trigger) {
    this.options.onOpen?.();
    if(this.dialog.open)this.close();const serial=++this.openSerial;this.activeId=id;this.returnFocus=trigger;
    const e=this.chain.find(id);this.title.textContent=e.record?.name||(e.kind==='nam'?'NeuralWAMp':'NeuralWAMp Cabinet');this.remove.hidden=false;
    for(const ui of Object.values(this.editorSides)){ui.panel.hidden=true;ui.button.setAttribute('aria-expanded','false');}
    this.syncEditorGains();this.dialog.showModal();this.mount.textContent='Loading editor…';
    try {
      const gui=await this.chain.getGui(id);
      if(serial!==this.openSerial){if(!gui.isConnected)this.parking.append(gui);return;}
      this.mount.replaceChildren(gui);gui.setEditorVisible?.(true);
      if(e.kind==='cabinet')gui.setRoutingStatus(e.plugin.audioNode.routingMode,e.routingStatus||'');
      await this.refresh();
    }catch(error){if(serial===this.openSerial)this.mount.textContent=`Editor unavailable: ${error.message}`;this.report(error.message,true);}
  }
  showMenu(beforeId,trigger,replaceId=null) {
    this.menu.replaceChildren();const close=element('button','','Close');close.onclick=()=>{this.menu.close();trigger.focus();};
    const title=element('h3','',replaceId?'Replace current WAM':'Insert a WAM'),status=element('p');status.setAttribute('aria-live','polite');this.menu.append(close,title,status);
    let side=null;
    const index=beforeId?this.chain.entries.indexOf(this.chain.find(beforeId)):this.chain.entries.length;
    if(!replaceId&&this.chain.junction?.index===index){side=element('select');side.setAttribute('aria-label','Position relative to split');side.append(new Option('After split — A only','after'),new Option('Before split — A + B','before'));this.menu.append(side);}
    const amps=element('div','fx-menu-amps');this.menu.append(amps);
    const categories=['amplifier','cabinet',...PLUGIN_CATEGORIES.filter(c=>!['amplifier','cabinet'].includes(c))];
    for(const category of categories){
      const records=this.chain.registry.records.filter(r=>r.category===category&&r.role!=='tuner'&&!r.isInstrument);
      if(!records.length)continue;const section=element('section','fx-menu-category');section.dataset.category=category;
      (['amplifier','cabinet'].includes(category)?amps:this.menu).append(section);
      section.append(element('h4','',category==='amplifier'?'Amplifiers':category==='cabinet'?'Cabinets / Speakers':category.replaceAll('-',' / ')));
      const group=element('div','fx-menu-group');section.append(group);
      for(const record of records){
        const button=element('button','fx-menu-item'),image=element('img');image.src=record.thumbnailUrl||fallbackThumbnail(record);image.alt='';image.onerror=()=>{image.onerror=null;image.src=fallbackThumbnail(record);};button.append(image,element('span','',record.name));const item=element('div','fx-menu-entry'),copy=element('button','fx-copy-uri','WAM URI');copy.title=record.entryUrl;copy.setAttribute('aria-label',`Copy WAM URI for ${record.name}`);copy.onclick=async()=>{try{await navigator.clipboard.writeText(record.entryUrl);status.textContent=`WAM URI copied: ${record.entryUrl}`;}catch{status.textContent=`Copy this WAM URI: ${record.entryUrl}`;}};item.append(button,copy);group.append(item);
        button.onclick=async()=>{
          this.menu.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent=`Loading ${record.name}…`;
          try{
            if(replaceId){const entry=await this.chain.replace(replaceId,record);this.menu.close();await this.open(entry.id,this.cards.get(entry.id)?.photo);}
            else{await this.chain.insert(record,beforeId,side?.value||'after');this.menu.close();this.container.querySelector('button')?.focus();}
          }
          catch(error){status.textContent=error.message;this.report(error.message,true);}
          finally{this.menu.querySelectorAll('button').forEach(b=>b.disabled=false);}
        };
      }
    }this.menu.showModal();
  }
}
