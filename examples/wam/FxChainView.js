import {fallbackThumbnail, PLUGIN_CATEGORIES} from './WamPluginRegistry.js';
import {createModal} from './ui/modal.js';

const element=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text)e.textContent=text;return e;};
const attrs=(e,values)=>{for(const [name,value] of Object.entries(values))e.setAttribute(name,value);return e;};
const icon=(name,size=13)=>attrs(document.createElement('tl-icon'),{name,size});
const CATEGORY_LABELS={amplifier:'Amplifier',cabinet:'Cabinet / speaker'};
const categoryLabel=category=>CATEGORY_LABELS[category]||category.replaceAll('-',' / ');
const kindLabel=entry=>categoryLabel(entry.record?.category||(entry.kind==='nam'?'amplifier':entry.kind==='cabinet'?'cabinet':'effect'));
let editorSequence=0;
export class FxChainView {
  constructor(chain,container,report,options={}) {
    Object.assign(this,{chain,container,report,options});this.openSerial=0;this.activeId=null;
    this.cards=new Map();this.parking=element('div');this.parking.hidden=true;document.body.append(this.parking);
    this.dialog=element('dialog','fx-editor tl-modal');
    const bar=element('header','fx-editor-bar tl-modal-header'),titles=element('div','fx-editor-titles');
    this.kicker=element('p','tl-eyebrow');this.title=element('h2','tl-modal-title');this.title.id=`fx-editor-title-${++editorSequence}`;this.dialog.setAttribute('aria-labelledby',this.title.id);
    this.subtitle=element('p','fx-editor-subtitle');titles.append(this.kicker,this.title,this.subtitle);
    const close=attrs(element('tl-icon-button','fx-editor-close'),{icon:'close','aria-label':'Close editor'});
    this.state=attrs(element('tl-badge','fx-editor-state'),{tone:'warning',dot:'',role:'status'});this.state.hidden=true;
    const actions=element('div','fx-editor-actions');actions.append(this.state,close);
    bar.append(titles,actions);this.mount=element('div','fx-editor-mount');this.mount.id=`fx-editor-mount-${editorSequence}`;
    this.tabs=attrs(element('nav','fx-editor-tabs'),{role:'tablist','aria-label':'Editor sections'});this.tabs.hidden=true;
    const body=element('div','fx-editor-body');this.editorSides={input:this.createEditorSide('input'),output:this.createEditorSide('output')};
    body.append(this.editorSides.input.root,this.mount,this.editorSides.output.root);
    const footer=element('footer','fx-editor-footer'),done=attrs(element('tl-button','','Done'),{variant:'primary'});
    footer.append(element('span','fx-editor-status','Changes apply live to the rack'),done);done.onclick=()=>this.close();
    this.dialog.append(bar,this.tabs,body,footer);document.body.append(this.dialog);
    // The cabinet GUI asks the host to apply AUTO/ON/BYPASS (cancelable event):
    // the chain decides the bypass and sends the new routing status back.
    this.mount.addEventListener('cabinet-routing-mode',event=>{if(event.target!==this.gui)return;event.preventDefault();this.chain.enqueue(()=>this.chain.applyRouting()).catch(error=>this.report(error.message,true));});
    // A click anywhere else in the editor closes the open IN/OUT panel.
    this.dialog.addEventListener('pointerdown',event=>{for(const ui of Object.values(this.editorSides))if(!ui.panel.hidden&&!ui.root.contains(event.target))this.toggleSide(ui,false);});
    this.mount.addEventListener('editor-tab-change',event=>{if(event.target===this.gui)this.syncTabs();});
    close.onclick=()=>this.close();this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.confirmation=element('dialog','fx-confirm tl-modal');document.body.append(this.confirmation);
    chain.addEventListener('change',()=>this.render());chain.addEventListener('error',e=>report(e.detail.message,true));
    this.setupGainLabels();this.render();this.animateLevels();this.timer=setInterval(()=>this.refresh().catch(error=>report(error.message,true)),350);
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
  // IN / OUT: a button beside the plugin opens a floating panel with the
  // live level and the gain of this plugin's input or output.
  createEditorSide(side) {
    const name=side==='input'?'Input':'Output',root=element('aside','fx-editor-side fx-editor-'+side);
    const button=attrs(element('tl-icon-button','fx-plugin-gain-toggle'),{icon:'sliders',title:name+' gain','aria-label':name+' gain','aria-expanded':'false'});
    const panel=attrs(element('section','fx-plugin-gain-panel'),{role:'group','aria-label':name+' settings'});panel.hidden=true;
    const head=element('header','fx-gain-panel-head'),heading=element('div');heading.append(element('p','tl-eyebrow','Signal controls'),element('h3','',name));
    const hide=attrs(element('tl-icon-button'),{icon:'close',size:'sm',variant:'ghost','aria-label':`Close ${name.toLowerCase()} settings`});head.append(heading,hide);
    const readout=element('div','fx-gain-readout'),levelText=element('strong','','−∞ dBFS'),meter=this.createThinMeter(name+' level');meter.classList.add('is-horizontal');
    readout.append(element('span','',name+' level'),levelText,meter);
    const label=element('label','fx-gain-control'),row=element('div','fx-gain-row'),fader=element('tl-slider'),slider=element('input'),value=element('output'),reset=attrs(element('tl-button','','Reset'),{size:'sm',variant:'ghost'});
    slider.type='range';slider.min='-48';slider.max='12';slider.step='.5';slider.setAttribute('aria-label',name+' gain in dB');fader.append(slider);
    row.append(fader,value);label.append(element('span','',name+' gain'),row);
    const body=element('div','fx-gain-panel-body');body.append(readout,label,reset);panel.append(head,body);
    const set=db=>{try{this.chain.setEntryGain(this.activeId,side,db);this.syncEditorGains();}catch(error){this.report(error.message,true);}};
    slider.oninput=()=>set(slider.value);reset.onclick=()=>set(0);
    const ui={root,button,panel,slider,value,meter,levelText};
    button.onclick=()=>this.toggleSide(ui,panel.hidden);hide.onclick=()=>{this.toggleSide(ui,false);button.focus();};
    panel.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.toggleSide(ui,false);button.focus();}};
    root.append(button,element('span','fx-editor-side-label',side==='input'?'IN':'OUT'),panel);
    return ui;
  }
  // Plugins that list their sections (editorTabs) get the host tab bar and
  // hide their own navigation; others keep their GUI as is.
  buildTabs() {
    const gui=this.gui,tabs=gui?.editorTabs;this.tabs.replaceChildren();this.tabs.hidden=!tabs?.length;if(!tabs?.length)return;
    gui.setAttribute('host-tabs','');
    for(const {id,label} of tabs){
      const tab=attrs(element('button','fx-editor-tab',label),{type:'button',role:'tab','aria-controls':this.mount.id});tab.dataset.tab=id;
      tab.onclick=()=>{gui.showEditorTab(id);this.mount.scrollTop=0;};
      tab.onkeydown=event=>{const step={ArrowRight:1,ArrowLeft:-1}[event.key];if(!step)return;event.preventDefault();
        const all=[...this.tabs.children],next=all[(all.indexOf(tab)+step+all.length)%all.length];next.focus();next.click();};
      this.tabs.append(tab);
    }
    this.syncTabs();
  }
  syncTabs() {
    const active=this.gui?.activeEditorTab;
    const all=[...this.tabs.children],current=all.find(tab=>tab.dataset.tab===active);
    for(const tab of all){tab.setAttribute('aria-selected',String(tab===current));tab.tabIndex=tab===(current||all[0])?0:-1;}
  }
  toggleSide(ui,open) {
    for(const other of Object.values(this.editorSides))if(other!==ui||!open){other.panel.hidden=true;other.button.setAttribute('aria-expanded','false');other.button.classList.remove('is-active');}
    if(!open)return;ui.panel.hidden=false;ui.button.setAttribute('aria-expanded','true');ui.button.classList.add('is-active');ui.slider.focus();
  }
  syncEditorGains() {
    const entry=this.chain.entries.find(e=>e.id===this.activeId);if(!entry)return;
    for(const side of ['input','output']){const ui=this.editorSides[side],db=entry[side+'Db'];ui.slider.value=String(db);ui.value.textContent=`${db.toFixed(1)} dB`;ui.slider.setAttribute('aria-valuetext',ui.value.textContent);ui.button.title=`${side==='input'?'Input':'Output'} gain: ${ui.value.textContent}`;}
  }
  setupGainLabels() {
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
    const cancel=element('button','tl-btn','Cancel'),remove=element('button','tl-btn tl-btn-danger','Remove'),actions=element('div','tl-modal-actions');actions.append(cancel,remove);
    this.confirmation.setAttribute('aria-labelledby',title.id);this.confirmation.replaceChildren(title,message,actions);
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
          const value=meter.read(),id=`${this.options.meterPrefix||'chain'}${side}`;
          value.channels.forEach((channel,index)=>{
            const bar=document.getElementById(`${id}Meter${'LR'[index]}`),label=document.getElementById(`${id}Level${'LR'[index]}`);if(!bar)return;
            bar.style.setProperty('--meter-level',String(channel.level));bar.setAttribute('aria-valuenow',String(Math.max(-60,Math.min(0,channel.db)).toFixed(1)));
            if(channel.peak>=1)bar.dataset.clipUntil=String(now+1000);
            const clipping=Number(bar.dataset.clipUntil)>now;
            bar.classList.toggle('is-clipping',clipping);
            label.textContent=clipping?'CLIP':channel.db<=-60?'−∞':channel.db.toFixed(1);
          });
          document.getElementById(`${id}MeterL`)?.closest('.fx-endpoint').classList.toggle('has-signal',value.db>-60);
        }
        for(const entry of this.chain.entries){
          const value=entry.meter.read(),out=entry.outputMeter.read(),view=this.cards.get(entry.id),card=view?.card;if(!card)continue;
          this.updateThinMeter(view.inputMeter,value,now);this.updateThinMeter(view.outputMeter,out,now);
          if(this.activeId===entry.id&&this.dialog.open)for(const [ui,level] of [[this.editorSides.input,value],[this.editorSides.output,out]]){if(ui.panel.hidden)continue;this.updateThinMeter(ui.meter,level,now);ui.levelText.textContent=ui.meter.classList.contains('is-clipping')?'CLIP':level.db<=-60?'−∞ dBFS':`${level.db.toFixed(1)} dBFS`;}
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
      const add=before=>{const button=element('button','fx-add');button.append(icon('plus'));button.setAttribute('aria-label',before?'Insert effect before '+(before.record?.name||before.kind):'Insert effect at end');button.onclick=()=>this.showMenu(before?.id||null,button);this.dropTarget(button,before?.id||null);const slot=element('span','fx-slot');slot.append(element('i','fx-wire'),button);slot.dataset.index=String(before?this.chain.entries.indexOf(before):this.chain.entries.length);
        if(this.options.onRoute){const route=element('button','fx-route-action','↳');route.title='Route to B here';route.setAttribute('aria-label','Route to B at this position');route.onclick=()=>this.options.onRoute(Number(slot.dataset.index),route);slot.append(route);
          let hideTimer;
          const showRoute=()=>{clearTimeout(hideTimer);slot.classList.add('route-visible');};
          const delayHide=()=>{clearTimeout(hideTimer);hideTimer=setTimeout(()=>{if(!slot.matches(':hover,:focus-within'))slot.classList.remove('route-visible');},700);};
          slot.addEventListener('pointerenter',showRoute);slot.addEventListener('pointerleave',delayHide);
          slot.addEventListener('focusin',showRoute);slot.addEventListener('focusout',delayHide);}
        this.container.append(slot);};
      for(const entry of this.chain.entries){
        add(entry);const card=attrs(element('tl-module','fx-card'),{kicker:kindLabel(entry),heading:entry.record?.name||entry.kind});
        card.addEventListener('module-toggle',()=>this.toggle(entry.id));card.addEventListener('module-remove',()=>this.confirmRemove(entry.id));
        const photo=element('button','fx-photo'),image=element('img');const inputMeter=this.createThinMeter('Plugin input level'),outputMeter=this.createThinMeter('Plugin output level');inputMeter.classList.add('fx-card-input-meter');outputMeter.classList.add('fx-card-output-meter');photo.append(inputMeter,image,outputMeter);image.draggable=false;
        card.addEventListener('module-edit',()=>this.open(entry.id,photo));
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
        card.append(photo);const captures=entry.plugin?.getCaptureChoices?this.createCaptureSelector(entry):null;if(captures)card.append(captures.root);this.container.append(card);this.cards.set(entry.id,{card,image,photo,inputMeter,outputMeter,captures});
      }add(null);
      const output=element('span','fx-output-link');
      output.setAttribute('aria-hidden','true');output.append(element('i','fx-wire'));this.container.append(output);
    }
    this.options.onLayout?.();
    this.refresh().catch(error=>this.report(error.message,true));
  }
  async refresh() {
    if(this.refreshing)return;this.refreshing=true;
    try { for(const e of this.chain.entries){
      const card=this.cards.get(e.id);if(!card)continue;
      let {name,image}=this.describe(e);
      if(e.plugin&&e.kind!=='effect'){const params=await e.plugin.audioNode.getParameterValues(false,'bypass');e.bypass=Number(params.bypass?.value)>=.5;}
      image ||= fallbackThumbnail({id:e.id,name});
      if(card.image.dataset.source!==image){card.image.dataset.source=image;card.image.src=image;}
      card.image.alt=name;card.photo.title=e.error?`${name}: ${e.error}`:name;card.photo.setAttribute('aria-label',`Open ${name}`);
      card.card.setAttribute('heading',name);
      if(card.captures)await this.refreshCaptureSelector(e,card.captures);
      card.card.classList.toggle('is-bypassed',e.bypass||!e.plugin);card.card.active=!e.bypass&&!!e.plugin;if(e.routingStatus)card.photo.title+=` · ${e.routingStatus}`;
    } this.syncEditorGains();this.syncEditorHeader(); } finally {this.refreshing=false;}
  }
  // The loaded model or IR names the card; plain effects keep their plugin name.
  describe(e) {
    if(e.plugin&&e.kind==='nam'){const m=e.plugin.audioNode.getModelSnapshot();return {name:m?.provenance?.title||m?.name||'NeuralWAMp',image:m?.provenance?.imageUrl};}
    if(e.plugin&&e.kind==='cabinet'){const ir=e.plugin.audioNode.getIrSnapshot();return {name:ir?.metadata?.title||ir?.name||'Cabinet',image:ir?.metadata?.imageUrl};}
    return {name:e.record?.name||e.kind,image:e.record?.thumbnailUrl};
  }
  // Amp: the model is the title, as on the card. Cabinet: the plugin is the
  // title and the IR the subtitle (the IR name is usually a long file name).
  syncEditorHeader() {
    const e=this.activeId&&this.chain.find(this.activeId);if(!e||!this.dialog.open)return;
    const plugin=e.record?.name||(e.kind==='nam'?'NeuralWAMp':'NeuralWAMp Cabinet'),{name}=this.describe(e);
    const [title,subtitle]=e.kind==='nam'&&e.plugin?[name,`${plugin} · Active model`]:e.kind==='cabinet'&&e.plugin?[plugin,`${name} · Active impulse response`]:[plugin,''];
    if(this.title.textContent!==title)this.title.textContent=title;if(this.subtitle.textContent!==subtitle)this.subtitle.textContent=subtitle;
    this.subtitle.hidden=!subtitle;this.syncEditorState(e);
  }
  // Bypass is shown once, beside the close button: why the module is silent
  // (AUTO routing or a manual bypass), without colouring the editor content.
  syncEditorState(e) {
    let label='',title='';
    if(e.plugin&&e.bypass&&e.kind==='cabinet'){
      const auto=e.plugin.audioNode.routingMode==='auto',reason=(e.routingStatus||'').split(' — ')[1];
      label=auto?'Bypassed · Auto':'Bypassed';
      title=auto?`AUTO routing: the amp model already includes a cabinet${reason?` (${reason})`:''}`:'Cabinet bypassed manually';
    }else if(e.plugin&&e.bypass)title=`${e.kind==='nam'?'Amp':'Module'} bypassed: the signal passes through unprocessed`,label='Bypassed';
    if(this.state.textContent!==label)this.state.textContent=label;if(this.state.title!==title)this.state.title=title;this.state.hidden=!label;
  }
  createCaptureSelector(entry) {
    const root=element('div','fx-capture-selector'),previous=element('button','','‹'),select=element('select'),next=element('button','','›'),skin=attrs(element('tl-select'),{size:'sm'});skin.append(select);
    previous.type=next.type='button';previous.setAttribute('aria-label','Previous amp capture');next.setAttribute('aria-label','Next amp capture');select.setAttribute('aria-label','Amp capture');
    root.append(previous,skin,next);const ui={root,previous,select,next,items:[],index:-1,busy:false};
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
    const e=this.chain.find(id);this.kicker.textContent=`Chain ${this.options.secondary?'B':'A'} · ${kindLabel(e)}`;
    this.toggleSide(null,false);this.gui=null;this.tabs.hidden=true;this.tabs.replaceChildren();
    this.syncEditorGains();this.dialog.showModal();this.syncEditorHeader();this.mount.textContent='Loading editor…';
    try {
      const gui=await this.chain.getGui(id);
      if(serial!==this.openSerial){if(!gui.isConnected)this.parking.append(gui);return;}
      this.gui=gui;this.mount.replaceChildren(gui);gui.setEditorVisible?.(true);this.buildTabs();
      if(e.kind==='cabinet')gui.setRoutingStatus(e.plugin.audioNode.routingMode,e.routingStatus||'');
      await this.refresh();
    }catch(error){if(serial===this.openSerial)this.mount.textContent=`Editor unavailable: ${error.message}`;this.report(error.message,true);}
  }
  showMenu(beforeId,trigger,replaceId=null) {
    const index=beforeId?this.chain.entries.indexOf(this.chain.find(beforeId)):this.chain.entries.length,lane=this.options.secondary?'B':'A',replaced=replaceId&&this.chain.find(replaceId);
    const {dialog,body}=createModal({title:replaceId?'Replace module':'Insert a WAM',eyebrow:replaced?`Chain ${lane} · ${replaced.record?.name||kindLabel(replaced)}`:`Chain ${lane} · Position ${index+1}`,className:'fx-menu',wide:true});
    this.menu=dialog;
    const intro=element('div','fx-menu-intro'),copy=element('div'),count=element('span','fx-menu-count'),status=element('p','fx-menu-status');status.setAttribute('aria-live','polite');
    copy.append(element('strong','','Choose an audio module'),element('span','',replaceId?'It takes the place of the current module, with its gains.':'The module will be inserted exactly at the selected connector.'));
    intro.append(copy,count);body.append(intro,status);
    let side=null;
    if(!replaceId&&this.chain.junction?.index===index){
      side=element('select');side.append(new Option('After split — A only','after'),new Option('Before split — A + B','before'));
      const label=element('label','fx-menu-side'),skin=attrs(element('tl-select'),{size:'sm'});skin.append(side);label.append(element('span','','Position relative to split'),skin);body.append(label);
    }
    const catalog=element('div','fx-menu-catalog');body.append(catalog);
    const categories=['amplifier','cabinet',...PLUGIN_CATEGORIES.filter(c=>!['amplifier','cabinet'].includes(c))];let total=0;
    for(const category of categories){
      const records=this.chain.registry.records.filter(r=>r.category===category&&r.role!=='tuner'&&!r.isInstrument);
      if(!records.length)continue;total+=records.length;
      const section=element('section','fx-menu-category'),header=element('header'),heading=element('div');section.dataset.category=category;
      heading.append(icon(category==='cabinet'?'device':'audio',15),element('h3','',category==='amplifier'?'Amplifiers':category==='cabinet'?'Cabinets / Speakers':categoryLabel(category)));
      header.append(heading,element('span','fx-menu-count',String(records.length)));
      const group=element('div','fx-menu-group');section.append(header,group);catalog.append(section);
      for(const record of records){
        const item=element('article','fx-menu-entry'),preview=element('div','fx-menu-item'),image=element('img'),button=element('button','fx-menu-insert');
        image.src=record.thumbnailUrl||fallbackThumbnail(record);image.alt='';image.onerror=()=>{image.onerror=null;image.src=fallbackThumbnail(record);};
        preview.append(image,element('strong','',record.name));
        button.append(icon('plus',12),replaceId?'Replace':'Insert module');button.setAttribute('aria-label',`${replaceId?'Replace with':'Insert'} ${record.name}`);
        const uri=element('button','fx-copy-uri');uri.append(icon('copy',11),element('span','',record.entryUrl));uri.title=`Copy ${record.entryUrl}`;uri.setAttribute('aria-label',`Copy WAM URI for ${record.name}`);
        uri.onclick=async()=>{try{await navigator.clipboard.writeText(record.entryUrl);status.textContent=`WAM URI copied: ${record.entryUrl}`;}catch{status.textContent=`Copy this WAM URI: ${record.entryUrl}`;}};
        item.append(preview,button,uri);group.append(item);
        button.onclick=async()=>{
          dialog.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent=`Loading ${record.name}…`;
          try{
            if(replaceId){const entry=await this.chain.replace(replaceId,record);dialog.close();await this.open(entry.id,this.cards.get(entry.id)?.photo);}
            else{await this.chain.insert(record,beforeId,side?.value||'after');dialog.close();this.container.querySelector('button')?.focus();}
          }
          catch(error){status.textContent=error.message;this.report(error.message,true);}
          finally{dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
        };
      }
    }
    count.textContent=`${total} modules available`;
    dialog.addEventListener('close',()=>{if(this.menu===dialog)this.menu=null;if(document.activeElement===document.body&&trigger?.isConnected)trigger.focus();});
    dialog.showModal();
  }
}
