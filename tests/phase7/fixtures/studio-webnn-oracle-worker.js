import {webnnAudioParity} from '../../../examples/wam/source-separation/WebNNParity.js';
// Numerical comparison is kept off the main thread, including quiet roles.
self.onmessage=({data:{id,reference,candidate}})=>{
 try{postMessage({id,parity:webnnAudioParity(reference,candidate)});}
 catch(error){postMessage({id,error:error.message});}
};
