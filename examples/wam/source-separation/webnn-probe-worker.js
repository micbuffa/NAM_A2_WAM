import {probeWebNN} from './WebNNProbe.js';
self.onmessage=async({data})=>{try{self.postMessage({result:await probeWebNN(data)});}catch(e){self.postMessage({error:e.message});}};
