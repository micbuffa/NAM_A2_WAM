import {measureGuitar} from './GuitarCalibration.js';
self.onmessage=({data})=>{
  try {self.postMessage({result:measureGuitar(data)});}catch(error){self.postMessage({error:error.message});}
};
