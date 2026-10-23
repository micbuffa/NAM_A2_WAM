// Contract of the pinned four-stem ONNX core. FFT/iFFT stay in the upstream
// JS DSP; the neural network itself runs via the selected ORT provider.
export class OnnxCoreModel {
  sources = ['drums','bass','other','vocals'];
  audioChannels = 2;
  samplerate = 44100;
  segment = 7.8;
  constructor(session, Tensor, {frames=343980}={}) {
    if(![44100,88200,176400,343980].includes(frames))throw Error('Contrat de fenêtre ONNX invalide.');
    this.frames=frames;this.segment=frames/44100;
    if(session.inputNames.length!==2 || session.outputNames.length!==2)throw Error('Contrat ONNX incompatible.');
    this.session=session;this.Tensor=Tensor;
  }
  validLength(length) {
    if(!Number.isSafeInteger(length)||length<=0||length>this.frames)throw Error('Fenêtre ONNX invalide.');
    return this.frames;
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
