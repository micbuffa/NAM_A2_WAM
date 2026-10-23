// Playback and buffering share a fixed time axis. A growing buffer must never
// change the denominator used to display the playhead or the range thumb.
export function transportTimeline(engine){
 const duration=Math.max(0,Number(engine?.duration)||0);
 const available=Math.max(0,Math.min(duration,Number(engine?.progressive?engine.availableDuration:duration)||0));
 const position=Math.max(0,Math.min(duration,Number(engine?.position)||0));
 return {duration,available,position,playedFraction:duration?position/duration:0,availableFraction:duration?available/duration:0};
}
export function seekAvailable(engine,seconds){
 if(!Number.isFinite(Number(seconds)))throw Error('Position invalide.');
 return Math.max(0,Math.min(transportTimeline(engine).available,Number(seconds)));
}
// Separate waveform publication cadence from the audio transport and RAF cursor.
export class WaveformRefreshGate {
 constructor(intervalMs=250){this.intervalMs=intervalMs;this.dirty=false;this.last=-Infinity;}
 request(){this.dirty=true;}
 rendered(now){this.dirty=false;this.last=now;}
 due(now){return this.dirty&&now-this.last>=this.intervalMs;}
}
export class ProgressSlider {
 constructor(input){
  this.input=input;this.dragging=false;
  input.onpointerdown=event=>{this.dragging=true;input.setPointerCapture?.(event.pointerId);};
  input.onpointerup=input.onpointercancel=input.onlostpointercapture=()=>{this.dragging=false;};
  input.onblur=()=>{this.dragging=false;};
 }
 update(timeline){const max=String(timeline.duration);if(this.input.max!==max)this.input.max=max;if(!this.dragging)this.input.value=String(timeline.position);}
 destroy(){for(const name of ['onpointerdown','onpointerup','onpointercancel','onlostpointercapture','onblur'])this.input[name]=null;}
}
