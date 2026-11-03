// Pinned third-party final0 export. Model bytes are downloaded only on explicit request.
export const BEAT_THIS_REVISION = '25308706dda545c0d5950065bb0604ad71bcf1f5';
export function beatThisManifest(assetBase) {
  const base = assetBase || `https://huggingface.co/musetric/beat-this-onnx/resolve/${BEAT_THIS_REVISION}/`;
  return {id:'beat-this-final0', version:BEAT_THIS_REVISION, label:'Beat This! final0',
    license:{name:'MIT',url:'https://github.com/CPJKU/beat_this/blob/main/LICENSE'},
    files:[
      {url:new URL('beat_this.onnx',base).href,size:190649026,sha256:'1337dc6c21257ed6b803418efc320df42b5d8eb296ef16648ef60457cd4b9e55'},
      {url:new URL('mel-filterbank.bin',base).href,size:262656,sha256:'1ee975d96f44ccf2c3bfe37825c1c1f0b089f5703c7a12a84b1f0a3bce004533'},
    ]};
}
