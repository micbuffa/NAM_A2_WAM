/* Pinned upstream encoder, unmodified; dynamic import keeps this a classic Worker. */
importScripts('../source-separation/vendor/lamejs/lame.min.js');
let encoder;
onmessage=async({data})=>{
  try {
    if(data.type==='init') {
      const {MixMp3Core}=await import('./MixMp3Core.js');encoder=new MixMp3Core(lamejs.Mp3Encoder,data.frames);postMessage({type:'ready'});
    } else if(data.type==='packet') {
      encoder.append(data.left,data.right);postMessage({type:'accepted'});
    } else if(data.type==='finish') {
      const result=encoder.finish(percent=>postMessage({type:'progress',percent}));
      postMessage({type:'done',...result},result.parts.map(part=>part.buffer));encoder=null;
    } else throw Error('Unknown encoding message');
  } catch(error) {postMessage({type:'error',message:error.message});}
};
