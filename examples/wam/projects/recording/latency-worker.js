import {analyzeLatencyReturn, summarizeLatency} from './LatencyAnalysis.js';
let probe, settings, results;
onmessage = ({data}) => {
  try {
    if (data.type === 'init') { probe=data.probe; settings=data.settings; results=[]; postMessage({type:'ready'}); }
    else if (data.type === 'window') {
      if (data.index !== results.length) throw Error('Calibration windows arrived out of order.');
      const result=analyzeLatencyReturn(data.samples,probe,settings); results.push(result);
      postMessage({type:'progress',index:data.index,result});
      if (results.length === settings.count) postMessage({type:'complete',result:summarizeLatency(results,settings.sampleRate,settings)});
    }
  } catch (error) { postMessage({type:'error',message:error.message}); }
};
