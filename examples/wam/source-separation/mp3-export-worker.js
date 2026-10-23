/* Classic worker: keep the upstream lamejs build separate and unmodified. */
importScripts('./vendor/lamejs/lame.min.js');
onmessage=async({data})=>{try{const {encodeMixMp3}=await import('./Mp3ExportCore.js');const result=encodeMixMp3(data,lamejs.Mp3Encoder,progress=>postMessage({type:'progress',...progress}));postMessage({type:'done',...result},[result.bytes.buffer]);}catch(error){postMessage({type:'error',message:error.message});}};
