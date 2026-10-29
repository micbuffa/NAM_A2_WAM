import {LATENCY_PROTOCOL,ACOUSTIC_PROTOCOL} from './LatencyAnalysis.js';
const KEY='nam-studio-latency-v1';
export function latencyConfiguration(context,source,outputChannel=0,browser=globalThis.navigator?.userAgent??'unknown') {
  const settings=source.liveStream?.getAudioTracks()[0]?.getSettings?.()??source.captureDiagnostics?.settings??{};
  return {inputDevice:source.liveInput?.deviceId??'',inputChannel:source.liveInput?.channelIndex??0,
    outputDevice:typeof context.sinkId==='string'?context.sinkId:'default',outputChannel,sampleRate:context.sampleRate,
    baseLatencyFrames:Math.round((context.baseLatency??0)*context.sampleRate),browser,
    echoCancellation:settings.echoCancellation??null,noiseSuppression:settings.noiseSuppression??null,autoGainControl:settings.autoGainControl??null};
}
export const sameLatencyConfiguration=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validLatencyMeasurement(value,rate) {
  const acoustic=value?.protocol===ACOUSTIC_PROTOCOL;
  return (value?.protocol===LATENCY_PROTOCOL||acoustic)&&value.compensationKind===(acoustic?'acoustic-round-trip':'round-trip')&&value.sampleRate===rate
    &&Number.isSafeInteger(value.frames)&&value.frames>=0&&value.frames<=rate*.75
    &&Number.isSafeInteger(value.spreadFrames)&&value.spreadFrames>=0&&value.spreadFrames<=Math.max(3,Math.round(rate*(acoustic ? .002 : .001)))
    &&[4,5].includes(value.validProbes)&&value.totalProbes===6&&Number.isFinite(value.confidence)&&value.confidence>=(acoustic ? .3 : .65)&&value.confidence<=1
    &&Number.isSafeInteger(value.validationResidualFrames)&&Math.abs(value.validationResidualFrames)<=Math.max(2,Math.round(rate*(acoustic ? .001 : .0005)))
    &&Number.isFinite(Date.parse(value.measuredAt));
}
export class LatencyProfiles {
  constructor(storage=globalThis.localStorage){this.storage=storage;}
  read(){try{const records=JSON.parse(this.storage?.getItem(KEY)??'[]');return Array.isArray(records)?records.slice(0,12):[];}catch{return [];}}
  lookup(configuration){return this.read().find(p=>sameLatencyConfiguration(p.configuration,configuration)&&validLatencyMeasurement(p.measurement,configuration.sampleRate))?.measurement??null;}
  save(configuration,measurement){
    if(!validLatencyMeasurement(measurement,configuration.sampleRate))throw Error('Invalid calibration result.');
    const records=[{configuration,measurement},...this.read().filter(p=>!sameLatencyConfiguration(p.configuration,configuration))].slice(0,12);
    try{this.storage?.setItem(KEY,JSON.stringify(records));return !!this.storage;}catch{return false;}
  }
}
