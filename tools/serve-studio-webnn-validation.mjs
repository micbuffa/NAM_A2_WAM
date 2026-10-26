import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
http.createServer((req,res)=>{
 try {
 const url=new URL(req.url,'http://127.0.0.1');
 const file=url.pathname==='/weights.onnx'?path.join(root,'third_party/nam-webgpu-probe/htdemucs-core.onnx'):path.resolve(root,'.'+decodeURIComponent(url.pathname));
 const allowed=file.startsWith(root+'/examples/wam/source-separation/')||['studio-webnn-validation.html','StudioWebNNProtocol.js','studio-webnn-oracle-worker.js'].some(name=>file===root+'/tests/phase7/fixtures/'+name)||file===root+'/third_party/nam-webgpu-probe/htdemucs-core.onnx';
 if(!allowed||!fs.existsSync(file)||!fs.statSync(file).isFile()||fs.realpathSync(file)!==file){res.writeHead(404);res.end();return;}
 const type={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.mp3':'audio/mpeg'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Content-Length':fs.statSync(file).size});fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end('Invalid request');}
}).listen(8779,'127.0.0.1',()=>console.log('WebNN validation: http://127.0.0.1:8779/tests/phase7/fixtures/studio-webnn-validation.html'));
