import {estimateTempo} from './TempoAnalysis.js';
self.onmessage=({data})=>{try{self.postMessage({result:estimateTempo(data.pcm,data.sampleRate)});}catch(error){self.postMessage({error:error.message});}};
