// Contract of the pinned four-stem ONNX core. FFT/iFFT stay in the upstream
// JS DSP; the neural network itself runs via the selected ORT provider.
export class OnnxCoreModel {
  sources = ['drums','bass','other','vocals'];
  audioChannels = 2;
  samplerate = 44100;
  segment = 7.8;
  constructor(session, Tensor) {
    if(session.inputNames.length!==2 || session.outputNames.length!==2)throw Error('Contrat ONNX incompatible.');
    this.session=session;this.Tensor=Tensor;
  }
  validLength(length) {
    if(!Number.isSafeInteger(length)||length<=0||length>343980)throw Error('Fenêtre ONNX invalide.');
    return 343980;
  }
  async forward(mix,spec) {
    const inputs=[new this.Tensor('float32',mix.data,mix.shape),new this.Tensor('float32',spec.data,spec.shape)];
    let outputs;
    try {
      outputs=await this.session.run(Object.fromEntries(this.session.inputNames.map((name,i)=>[name,inputs[i]])));
      const copy=name=>{
        const tensor=outputs[name];
        if(!(tensor?.data instanceof Float32Array)||!tensor.data.every(Number.isFinite))throw Error('Sortie ONNX invalide.');
        return {data:tensor.data.slice(),shape:[...tensor.dims]};
      };
      return {outX:copy(this.session.outputNames[0]),outXt:copy(this.session.outputNames[1])};
    } finally {
      inputs.forEach(t=>t.dispose());Object.values(outputs||{}).forEach(t=>t.dispose());
    }
  }
}
