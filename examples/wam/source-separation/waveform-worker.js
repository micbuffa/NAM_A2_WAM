import {computeWaveformBlock} from './WaveformWorkerCore.js';
onmessage=({data})=>{
 try{const result=computeWaveformBlock(data.block);postMessage({id:data.id,...result},[result.peaks.buffer]);}
 catch(error){postMessage({id:data.id,error:error.message});}
};
