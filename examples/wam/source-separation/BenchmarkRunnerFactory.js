import {DemucsRunner} from './DemucsRunner.js';
import {ProgressiveDemucsRunner} from './ProgressiveDemucsRunner.js';
import {OnnxDemucsRunner} from './OnnxDemucsRunner.js';
import {PreparedDemucsRunner} from './PreparedDemucsRunner.js';
export function createBenchmarkRunner(model,manager,{Classic=DemucsRunner,Progressive=ProgressiveDemucsRunner,Onnx=OnnxDemucsRunner,Prepared=PreparedDemucsRunner}={}){
 if(model.profile==='preview'||model.runtime==='bs-roformer-onnx')return new Prepared({manager,timeoutMs:300000,workerFactory:m=>new Worker(new URL(m.runtime==='bs-roformer-onnx'?'./roformer-worker.js':'./preview-worker.js',import.meta.url),{type:'module'})});
 if(model.runtime==='demucs-onnx-core')return new Onnx({manager,timeoutMs:300000});
 if(model.id==='htdemucs_6s')return new Progressive({manager});
 const classic=new Classic({manager});
 // The legacy FT adapter takes the progress callback as its third positional argument.
 return {separate:(m,channels,options)=>classic.separate(m,channels,options.onProgress,{segmentSeconds:0}),cancel:()=>classic.cancel()};
}
