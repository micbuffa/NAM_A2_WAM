import {wavPacket} from './StemWav.js';
onmessage = ({data}) => {
  try { const bytes = wavPacket(data.left, data.right); postMessage({bytes}, [bytes.buffer]); }
  catch (error) { postMessage({error: error.message}); }
};
