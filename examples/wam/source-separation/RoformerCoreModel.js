import {ROFORMER_FRAMES,ROFORMER_ROLES,roformerStft,roformerIstft} from './RoformerDSP.js';
export class RoformerCoreModel {
 constructor(session,Tensor){this.session=session;this.Tensor=Tensor;this.roles=ROFORMER_ROLES;}
 async separate(channels){
  if(channels.length!==2||!channels[0]?.length||channels[0].length>ROFORMER_FRAMES||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length||!c.every(Number.isFinite)))throw Error('Fenêtre Roformer invalide.');
  const length=channels[0].length,padded=channels.map(c=>{const a=new Float32Array(ROFORMER_FRAMES);a.set(c);return a;});
  this.onPhase?.('stft','start');
  const {real,imag}=roformerStft(padded);this.onPhase?.('stft','end');
  const inputs={spec_real:new this.Tensor('float32',real,[1,2,1025,345]),spec_imag:new this.Tensor('float32',imag,[1,2,1025,345])};let output;
  try{
   this.onPhase?.('network','start');
   try{output=await this.session.run(inputs);}finally{this.onPhase?.('network','end');}
   for(const name of ['out_spec_real','out_spec_imag'])if(output[name]?.type!=='float32'||String(output[name]?.dims)!=='1,6,2,1025,345')throw Error('Sortie Roformer incompatible.');
   this.onPhase?.('istft','start');
   try{return roformerIstft(output.out_spec_real.data,output.out_spec_imag.data,{length});}finally{this.onPhase?.('istft','end');}
  }finally{for(const t of Object.values(inputs))t.dispose?.();for(const t of Object.values(output||{}))t.dispose?.();}
 }
}
