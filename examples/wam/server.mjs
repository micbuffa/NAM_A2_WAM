import http from 'node:http';
import {readdir, readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const audioDirectory = join(root, 'examples/wam/assets/audio');
const port = Number(process.env.PORT || 8765);
const supported = new Set(['.wav', '.mp3', '.aac', '.m4a', '.ogg', '.flac']);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.wasm':'application/wasm','.wav':'audio/wav','.mp3':'audio/mpeg',
  '.ogg':'audio/ogg','.flac':'audio/flac','.css':'text/css; charset=utf-8','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};

async function discoverAudio() {
  const entries = await readdir(audioDirectory, {withFileTypes: true});
  return entries.filter((entry) => entry.isFile() && supported.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/test-audio-files') {
      const files = await discoverAudio();
      response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'});
      response.end(JSON.stringify(files));
      return;
    }
    const pathname = url.pathname === '/' ? '/examples/wam/' : url.pathname;
    const relative = decodeURIComponent(pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    const path = normalize(join(root, relative));
    if (path !== root && !path.startsWith(root + sep)) throw new Error('Forbidden path');
    if (!(await stat(path)).isFile()) throw new Error('Not a file');
    response.writeHead(200, {'content-type': mime[extname(path).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'});
    response.end(await readFile(path));
  } catch (error) {
    response.writeHead(404, {'content-type': 'text/plain; charset=utf-8'});
    response.end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`NAM WAM host: http://127.0.0.1:${port}/examples/wam/`));
