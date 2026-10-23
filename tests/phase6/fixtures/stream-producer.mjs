import {parentPort} from 'node:worker_threads';
import {StreamPublisher} from '../../../examples/wam/source-separation/StreamTransport.js';
parentPort.on('message',async message=>{
 const n=message.left.length,stems=Array.from({length:12},(_,c)=>Float32Array.from({length:n},(_,i)=>(i%100-c)/100));
 const publisher=new StreamPublisher(message.streamTransport,{totalFrames:n,post:(m,transfers)=>parentPort.postMessage(m,transfers)});
 try{await publisher.publish({startFrame:0,stems,sampleRate:44100});parentPort.postMessage({type:'done'});}catch(error){parentPort.postMessage({type:'error',message:error.message});}
});
