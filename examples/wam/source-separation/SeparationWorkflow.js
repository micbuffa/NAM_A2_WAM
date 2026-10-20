// Keeps the original available while a disconnected candidate is calculated.
// Only one output is connected; every deck shares the host AudioContext.
export class SeparationWorkflow {
  constructor({onActivate=()=>{},onChange=()=>{},canAutoSwitch=()=>true,destination=null}={}) {this.destination=destination;this.onActivate=onActivate;this.onChange=onChange;this.canAutoSwitch=canAutoSwitch;this.follow=false;}
  dispose(deck){if(deck){deck.cleanup?.();deck.engine.destroy();}}
  setOriginal(deck) {
    for(const old of new Set([this.original,this.result,this.active]))if(old)this.dispose(old);
    this.original=deck;this.result=null;this.active=null;this.follow=false;
    deck.engine.outputNode.connect((this.destination||deck.engine.context.destination));this.active=deck;this.onActivate(deck);this.onChange();
  }
  async begin(candidate) {
    if(!this.original)throw Error('Chargez d’abord une piste originale.');
    if(candidate.engine.context!==this.original.engine.context)throw Error('Un AudioContext commun est nécessaire.');
    if(this.active!==this.original)await this.activate(this.original);
    if(this.result)this.dispose(this.result);
    this.result=candidate;this.follow=true;this.onChange();
  }
  available(deck=this.result){return deck?.engine.progressive?deck.engine.availableDuration:deck?.engine.duration||0;}
  async activate(deck,{restart=false}={}) {
    if(!deck||deck===this.active)return;
    const previous=this.active,from=previous.engine;
    const position=restart?0:from.position,resume=!!(from.playing||from.waiting||from.starting);
    if(position>this.available(deck))return false;
    // Pause/disconnect before connecting a second route: no doubled original/stems.
    from.pause();from.outputNode.disconnect();
    deck.session.zoom=previous.session.zoom;deck.engine.setLoop(from.loop);
    if(from.loopRegion&&from.loopRegion.end<=deck.engine.duration)deck.engine.setLoopRegion(from.loopRegion.start,from.loopRegion.end);
    deck.engine.outputNode.gain.value=from.outputNode.gain.value;
    if(deck===this.result&&!deck.inheritedMix) {
      const source=this.original.session.tracks[0];
      for(const track of deck.session.tracks)Object.assign(track,{volume:source.volume,pan:source.pan,muted:source.muted});
      deck.inheritedMix=true;
    }
    deck.engine.sync(deck.session.tracks);deck.engine.seek(position);
    this.active=deck;deck.engine.outputNode.connect((this.destination||deck.engine.context.destination));
    this.onActivate(deck);this.onChange();
    if(resume)await deck.engine.play();
    return true;
  }
  async tryActivate() {
    if(!this.follow||!this.result||this.active===this.result||!this.canAutoSwitch())return false;
    const position=this.active.engine.position,available=this.available();
    if(!available||position>=available||(!this.result.engine.complete&&this.result.engine.progressive&&available-position<.15))return false;
    return this.activate(this.result);
  }
  async showOriginal(){this.follow=false;await this.activate(this.original);this.onChange();}
  async showResult(){this.follow=false;if(this.available())await this.activate(this.result,{restart:this.active.engine.position>=this.available()});this.onChange();}
  async fail() {
    this.follow=false;
    if(this.active===this.result)await this.activate(this.original);
    if(!this.available()){this.dispose(this.result);this.result=null;}
    this.onChange();
  }
  destroy(){for(const deck of new Set([this.original,this.result,this.active]))this.dispose(deck);this.original=this.result=this.active=null;}
}
