import {FxChainView} from './FxChainView.js';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
export class FxRackView {
  constructor(rack,report){
    Object.assign(this,{rack,report});this.root=document.querySelector('.fx-rack');this.root.setAttribute('aria-label','Processing chains');
    const input=this.root.querySelector('[aria-label="Chain A input"]'),output=this.root.querySelector('[aria-label="Chain A output"]'),strip=document.querySelector('#fxChain');
    const header=el('div','fx-rack-controls');this.toggle=el('button','','☷  1 / 2 chains');this.toggle.id='toggleChains';this.toggle.setAttribute('aria-expanded','false');
    header.append(this.toggle);
    for(const id of ['inputDevice','outputDevice']){const label=document.getElementById(id).closest('label');label.className='fx-device-label';header.append(label);}
    output.querySelector('.fx-endpoint-routing').append(output.querySelector('#chainOutputReset'));
    this.status=el('span','fx-rack-status');header.append(this.status);this.root.before(header);
    this.left=el('div','fx-endpoints');this.right=el('div','fx-endpoints');
    const cell=panel=>{const c=el('div','fx-endpoint-cell');c.append(panel);return c;};this.left.append(cell(input));this.right.append(cell(output));
    this.scroller=el('div','fx-scroll');this.track=el('div','fx-track');this.scroller.append(this.track);this.track.append(strip);
    this.gutter=el('div','fx-route-gutter');this.track.append(this.gutter);
    this.bStrip=el('section','fx-chain');this.bStrip.id='fxChainB';this.bStrip.setAttribute('aria-label','Chain B effects');this.track.append(this.bStrip);
    this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');this.svg.classList.add('fx-route-cable');this.svg.setAttribute('aria-hidden','true');this.track.append(this.svg);
    this.routeLabel=el('button','fx-route-label');this.gutter.append(this.routeLabel);
    this.routeLabel.onclick=()=>this.routeMenu(this.rack.route?.index||0,this.routeLabel,true);
    this.root.replaceChildren(this.left,this.scroller,this.right);
    this.inputB=input.cloneNode(true);this.outputB=output.cloneNode(true);
    const rename=(panel,side)=>{
      panel.setAttribute('aria-label',`Chain B ${side.toLowerCase()}`);panel.querySelector('strong').textContent=`${side.toUpperCase()} · B`;
      for(const node of panel.querySelectorAll('[id]')){
        const old=node.id;node.id=old==='inputChannelRow'?'inputChannelRowB':old==='inputChannel'?'inputChannelB':old.startsWith('sourceTrim')?old.replace('sourceTrim','sourceTrimB'):old.replace('chain','chainB');
        if(node.hasAttribute('aria-label'))node.setAttribute('aria-label',`Chain B ${node.getAttribute('aria-label')}`);
      }
    };rename(this.inputB,'Input');rename(this.outputB,'Output');
    this.bLeft=cell(this.inputB);this.bRight=cell(this.outputB);this.left.append(this.bLeft);this.right.append(this.bRight);
    this.muteA=el('button','fx-lane-enable','Mute');output.querySelector('.fx-endpoint-routing').append(this.muteA);
    this.enableB=el('button','fx-lane-enable','Mute');this.outputB.querySelector('.fx-endpoint-routing').append(this.enableB);
    this.dialog=el('dialog','fx-confirm fx-routing-dialog');document.body.append(this.dialog);
    this.aView=new FxChainView(rack.a,strip,report,{onRoute:(index,button)=>this.routeMenu(index,button),onLayout:()=>this.scheduleLayout(),onOpen:()=>this.bView?.close()});
    this.toggle.onclick=async()=>{
      this.toggle.disabled=true;this.toggle.textContent='Loading…';
      try{await this.act(()=>rack.setVisible(!rack.visible));}finally{this.toggle.disabled=false;this.toggle.textContent='☷  1 / 2 chains';}
    };
    this.enableB.onclick=()=>this.act(()=>rack.setEnabledB(!rack.enabledB));
    this.muteA.onclick=()=>this.act(()=>rack.setMutedA(!rack.mutedA));
    for(const [lane,id] of [['a','chainOutputPan'],['b','chainBOutputPan']]){
      const input=document.getElementById(id);input.setAttribute('aria-label',`Chain ${lane.toUpperCase()} pan`);
      input.oninput=()=>rack.setPan(lane,input.value);
      input.ondblclick=()=>rack.setPan(lane,0);
      input.onkeydown=event=>{if(event.key==='Home'){event.preventDefault();rack.setPan(lane,0);}};
    }
    this.inputB.querySelector('#inputChannelB').onchange=event=>this.act(()=>rack.setChannelB(Number(event.target.value)));
    this.inputB.querySelector('#sourceTrimB').oninput=event=>rack.setInputDbB(Number(event.target.value));
    this.inputB.querySelector('#chainBInputReset').onclick=()=>rack.setInputDbB(0);
    this.outputB.querySelector('#chainBOutputGain').oninput=event=>{rack.b.setOutputDb(Number(event.target.value));rack.changed();};
    this.outputB.querySelector('#chainBOutputReset').onclick=()=>{rack.b.setOutputDb(0);rack.changed();};
    rack.addEventListener('change',()=>this.render());rack.addEventListener('error',event=>report(event.detail.message,true));
    this.resize=new ResizeObserver(()=>this.scheduleLayout());this.resize.observe(this.root);this.scroller.addEventListener('scroll',()=>this.positionLabel());
    this.render();this.tick();
  }
  async act(operation){try{await operation();}catch(error){this.report(error.message,true);}}
  render(){
    const r=this.rack;
    if(r.b&&!this.bView)this.bView=new FxChainView(r.b,this.bStrip,this.report,{secondary:true,meterPrefix:'chainB',onLayout:()=>this.scheduleLayout(),onOpen:()=>this.aView.close()});
    this.toggle.setAttribute('aria-expanded',String(r.visible));this.toggle.title=r.visible?'Hide chain B':'Show chain B';
    this.bLeft.hidden=this.bRight.hidden=this.bStrip.hidden=this.gutter.hidden=!r.visible;
    this.inputB.style.visibility=r.route?'hidden':'visible';
    this.root.classList.toggle('has-chain-b',r.visible);
    this.muteA.textContent='Mute';this.muteA.setAttribute('aria-label','Mute chain A');this.muteA.setAttribute('aria-pressed',String(r.mutedA));
    this.enableB.textContent='Mute';this.enableB.setAttribute('aria-label','Mute chain B');this.enableB.setAttribute('aria-pressed',String(!r.enabledB));
    this.status.textContent=`${r.visible?(r.route?'A → B split':'Independent inputs'):'One chain'} · Mix ${r.mixDb} dB`;
    const selector=this.inputB.querySelector('#inputChannelB'),aOptions=document.querySelector('#inputChannel').options;
    const options=[...aOptions].filter(o=>/^\d+$/.test(o.value));
    const signature=options.map(o=>o.value+o.textContent).join('|');
    if(signature!==this.channelSignature){this.channelSignature=signature;selector.replaceChildren(new Option('Select input','-1'),...options.map(o=>new Option(o.textContent,o.value)));}
    selector.value=options.some(o=>Number(o.value)===r.channelB)?String(r.channelB):'-1';
    selector.title=r.channelB===r.source.liveInput?.channelIndex?'Shared physical input with A':'Chain B physical input';
    selector.disabled=r.source.mode==='file';this.inputB.querySelector('#inputChannelRowB').hidden=false;
    for(const [id,db] of [['sourceTrimB',r.inputDbB],['chainBOutputGain',r.b?.outputDb||0]]){
      const node=document.getElementById(id);node.value=db;node.setAttribute('aria-valuetext',`${db.toFixed(1)} dB`);document.getElementById(id+'Value').textContent=`${db.toFixed(1)} dB`;
    }
    document.querySelector('#chainOutputGain').value=r.a.outputDb;document.querySelector('#chainOutputGainValue').textContent=`${r.a.outputDb.toFixed(1)} dB`;
    for(const [id,pan] of [['chainOutputPan',r.panA],['chainBOutputPan',r.panB]]){
      const input=document.getElementById(id),text=pan===0?'C':`${Math.round(Math.abs(pan)*100)}${pan<0?'L':'R'}`;
      input.value=pan;input.setAttribute('aria-valuetext',pan===0?'Center':`${Math.round(Math.abs(pan)*100)}% ${pan<0?'left':'right'}`);document.getElementById(id+'Value').textContent=text;
    }
    this.scheduleLayout();
  }
  scheduleLayout(){if(this.layoutQueued)return;this.layoutQueued=true;requestAnimationFrame(()=>{this.layoutQueued=false;this.layout();});}
  layout(){
    const route=this.preview||this.rack.route;
    this.inputB.style.visibility=route?'hidden':'visible';
    this.bStrip.style.paddingLeft='12px';this.svg.replaceChildren();this.routeLabel.hidden=!route||!this.rack.visible;
    if(!route||!this.rack.visible)return;
    const slots=this.aView.container.querySelectorAll('.fx-slot'),slot=slots[route.index];if(!slot)return;
    const offset=slot.offsetLeft-slots[0].offsetLeft;this.bStrip.style.paddingLeft=`${12+offset}px`;
    const x=slot.offsetLeft+slot.offsetWidth/2,y1=slot.offsetTop+slot.offsetHeight/2,y2=this.bStrip.offsetTop+this.bStrip.querySelector('.fx-slot').offsetTop+13;
    this.svg.setAttribute('width',String(this.track.scrollWidth));this.svg.setAttribute('height',String(this.track.scrollHeight));
    const path=document.createElementNS(this.svg.namespaceURI,'path');path.setAttribute('d',`M${x} ${y1+14} V${y2-20} l-5 -7 m5 7 l5 -7`);path.setAttribute('class',this.preview?'is-preview':'');this.svg.append(path);
    const previous=this.rack.a.entries[route.index-1];this.routeLabel.textContent=`A → B · ${previous?'after '+(previous.record?.name||previous.kind):'before first effect'} · ${this.preview?'Preview':'Edit'}`;
    this.labelAnchor=x;this.positionLabel();
  }
  positionLabel(){if(this.routeLabel.hidden)return;const min=this.scroller.scrollLeft+8,max=min+this.scroller.clientWidth-this.routeLabel.offsetWidth-16;this.routeLabel.style.left=`${Math.max(min,Math.min(this.labelAnchor||0,max))}px`;}
  routeMenu(index,trigger,existing=false){
    if(!this.rack.visible){this.report('Click 1 / 2 chains to show B first.');return;}
    const order=this.rack.a.entries.map(e=>e.id).join('|');
    this.preview={index};this.layout();this.dialog.replaceChildren();
    const title=el('h3','',existing?'A → B route':this.rack.route?'Replace A → B route':'Split A → B');
    const text=el('p','','A continues normally. B starts here; its physical input is disconnected. Existing B effects shift right.');
    const cancel=el('button','','Cancel'),connect=el('button','',existing?'Keep route':'Connect');
    const close=()=>{this.preview=null;this.dialog.close();this.layout();trigger?.focus();};
    cancel.onclick=close;this.dialog.oncancel=event=>{event.preventDefault();close();};
    connect.onclick=()=>{close();if(!existing){if(this.rack.a.entries.map(e=>e.id).join('|')!==order)return this.report('Chain changed; choose the junction again.',true);this.act(()=>this.rack.connectRoute(index));}};
    this.dialog.append(title,text,cancel,connect);
    if(this.rack.route){const remove=el('button','','Remove route');remove.onclick=()=>{close();this.act(()=>this.rack.removeRoute());};this.dialog.append(remove);}
    if(existing){const show=el('button','','Show junction');show.onclick=()=>{close();this.scroller.scrollTo({left:Math.max(0,(this.labelAnchor||0)-this.scroller.clientWidth/2),behavior:'smooth'});};this.dialog.append(show);}
    this.dialog.showModal();cancel.focus();
  }
  close(){this.aView.close();this.bView?.close();}
  tick(){
    if(!document.hidden){const value=this.rack.meter.read();if(value.peak>=1)this.clipUntil=performance.now()+1000;this.status.classList.toggle('is-clipping',performance.now()<(this.clipUntil||0));this.status.title=performance.now()<(this.clipUntil||0)?'Main output clipping':`Main output ${value.db.toFixed(1)} dBFS`;}
    this.timer=setTimeout(()=>this.tick(),100);
  }
}
