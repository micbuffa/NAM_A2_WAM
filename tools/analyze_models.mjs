import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {extname, relative, resolve, dirname, basename} from 'node:path';

const workspace = resolve(import.meta.dirname, '..');
const modelsRoot = resolve(workspace, 'src/nam-wam/models');
const irRoot = resolve(workspace, 'src/cabinet-wam/IRs');
const outputPath = resolve(workspace, 'examples/wam/model-analysis.json');
const hash = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex').slice(0, 16);
const posix = (value) => value.replaceAll('\\', '/');

async function filesUnder(root) {
  const output = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, {withFileTypes:true})) {
      if (entry.name.startsWith('.')) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path); else if (entry.isFile()) output.push(path);
    }
  }
  await visit(root);
  return output.sort((a,b) => a.localeCompare(b));
}

function arrayShape(value) {
  const shape = [];
  let cursor = value;
  while (Array.isArray(cursor)) { shape.push(cursor.length); cursor = cursor[0]; }
  return shape;
}

function summarize(value, depth = 0) {
  if (Array.isArray(value)) {
    const flatSample = value.length && !Array.isArray(value[0]) && typeof value[0] !== 'object' ? value.slice(0, 5) : undefined;
    const numeric = value.length > 0 && value.every((item) => typeof item === 'number');
    return {type:'array', count:value.length, dimensions:arrayShape(value), elementType:numeric ? 'number' : value.length ? typeof value[0] : 'unknown',
      ...(flatSample && value.length <= 16 ? {values:flatSample} : {})};
  }
  if (value && typeof value === 'object') {
    if (depth > 8) return {type:'object', keys:Object.keys(value)};
    return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, summarize(item, depth + 1)]));
  }
  return value;
}

function collectPaths(value, path, found) {
  if (Array.isArray(value)) {
    found.set(path, {type:'array', summary:summarize(value)});
    if (value.length && value[0] && typeof value[0] === 'object' && !Array.isArray(value[0])) collectPaths(value[0], `${path}[]`, found);
    return;
  }
  if (value && typeof value === 'object') {
    if (path) found.set(path, {type:'object', summary:{keys:Object.keys(value)}});
    for (const [key,item] of Object.entries(value)) collectPaths(item, path ? `${path}.${key}` : key, found);
    return;
  }
  found.set(path, {type:value === null ? 'null' : typeof value, summary:value});
}

function findFields(value, matcher, path = '', output = []) {
  if (Array.isArray(value)) {
    if (matcher(path.split('.').at(-1) || '', path, value)) output.push({path, value:summarize(value)});
    if (value.length && value[0] && typeof value[0] === 'object') findFields(value[0], matcher, `${path}[]`, output);
  } else if (value && typeof value === 'object') {
    for (const [key,item] of Object.entries(value)) {
      const child = path ? `${path}.${key}` : key;
      if (matcher(key, child, item)) output.push({path:child, value:summarize(item)});
      if (item && typeof item === 'object') findFields(item, matcher, child, output);
    }
  }
  return output;
}

function findWeightArrays(value, path = '', output = []) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; ++i) if (value[i] && typeof value[i] === 'object') findWeightArrays(value[i], `${path}[${i}]`, output);
    return output;
  }
  for (const [key,item] of Object.entries(value)) {
    const child = path ? `${path}.${key}` : key;
    if (key === 'weights' && Array.isArray(item)) output.push({path:child,count:item.length,dimensions:arrayShape(item),elementType:item.every((entry)=>typeof entry === 'number')?'number':'mixed',sha256:hash(JSON.stringify(item))});
    else if (item && typeof item === 'object') findWeightArrays(item,child,output);
  }
  return output;
}

function structuralConfig(value, key = '') {
  if (key === 'metadata') return '<metadata omitted>';
  if (key === 'weights' && Array.isArray(value)) return {weightsCount:value.length};
  if (Array.isArray(value)) return value.map((item)=>structuralConfig(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([child,item])=>[child,structuralConfig(item,child)]));
  return value;
}

function detectA2(json) {
  const candidates = json.architecture === 'SlimmableContainer' ? json.config?.submodels?.map((item) => item.model) || [] : [json];
  const subtypes = candidates.map((model) => {
    if (model?.architecture !== 'WaveNet') return null;
    const channels = model.config?.layers?.[0]?.channels;
    return channels === 3 ? 'A2 Lite' : channels === 8 ? 'A2 Full' : null;
  }).filter(Boolean);
  return {isA2:subtypes.length > 0, subtypes};
}

function parseWav(buffer) {
  if (buffer.toString('ascii',0,4) !== 'RIFF' || buffer.toString('ascii',8,12) !== 'WAVE') return null;
  let offset = 12;
  let format = null;
  let dataBytes = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii',offset,offset+4);
    const size = buffer.readUInt32LE(offset+4);
    const start = offset + 8;
    if (id === 'fmt ' && size >= 16) format = {encodingCode:buffer.readUInt16LE(start), channels:buffer.readUInt16LE(start+2),
      sampleRate:buffer.readUInt32LE(start+4), byteRate:buffer.readUInt32LE(start+8), blockAlign:buffer.readUInt16LE(start+12), bitDepth:buffer.readUInt16LE(start+14)};
    if (id === 'data') dataBytes = size;
    offset = start + size + (size & 1);
  }
  if (!format) return null;
  const sampleFrames = dataBytes == null ? null : Math.floor(dataBytes / format.blockAlign);
  return {...format, dataBytes, sampleFrames, durationSeconds:sampleFrames == null ? null : sampleFrames / format.sampleRate};
}

const modelPaths = (await filesUnder(modelsRoot)).filter((path) => extname(path).toLowerCase() === '.nam');
const pathStats = new Map();
const models = [];
for (const path of modelPaths) {
  const info = await stat(path);
  const relativePath = posix(relative(modelsRoot,path));
  const record = {relativePath, filename:basename(path), parentFolder:posix(relative(modelsRoot,dirname(path))) || '.', fileSizeBytes:info.size};
  try {
    const source = await readFile(path,'utf8');
    const json = JSON.parse(source);
    const paths = new Map();
    collectPaths(json,'',paths);
    for (const [key,data] of paths) {
      if (!pathStats.has(key)) pathStats.set(key,{models:new Set(),types:new Set(),examples:[]});
      const item = pathStats.get(key);
      item.models.add(relativePath); item.types.add(data.type);
      const encoded = JSON.stringify(data.summary);
      if (item.examples.length < 4 && !item.examples.some((example) => JSON.stringify(example.value) === encoded)) item.examples.push({model:relativePath,value:data.summary});
    }
    const calibrationFields = findFields(json,(key,path) => /(?:input|output).*(?:level|gain|calibr)|(?:level|gain|calibr).*(?:input|output)|^(?:gain|loudness)$|d[bf]u|normaliz|amplitude/i.test(key));
    const cabinetFields = findFields(json,(key,path,item) => /\b(?:ir|fir|impulse|cab(?:inet)?|speaker|microphone|mic|full.?rig|load.?box)\b/i.test(key) || /(?:impulse.response|convolution)/i.test(path)
      || (typeof item === 'string' && /\b(?:cab(?:inet)?|speaker|microphone|mic|full.?rig|load.?box)\b/i.test(item)));
    const descriptiveFields = findFields(json,(key) => /^(?:name|description|tags?|gear|modeled_by|modeledBy|author|tone|channel|settings?|notes?|date)$/i.test(key));
    const a2 = detectA2(json);
    record.jsonParsed = true;
    record.architecture = json.architecture ?? null;
    record.version = json.version ?? null;
    record.sampleRate = json.sample_rate ?? null;
    record.isA2 = a2.isA2;
    record.a2Subtypes = a2.subtypes;
    record.metadata = summarize(json.metadata ?? null);
    record.calibrationFields = calibrationFields;
    record.cabinetIrFields = cabinetFields;
    record.descriptiveFields = descriptiveFields;
    record.topLevelKeys = Object.keys(json);
    record.configSummary = summarize(json.config ?? null);
    record.configSignature = hash(structuralConfig({architecture:json.architecture,config:json.config}));
    record.weightArrays = findWeightArrays(json);
    record.weightsSignature = hash(record.weightArrays.map((item)=>item.sha256));
    record.unclearTopLevelFields = Object.keys(json).filter((key) => !['version','architecture','config','weights','sample_rate','metadata'].includes(key));
  } catch (error) {
    record.jsonParsed = false;
    record.parseError = String(error.message || error);
  }
  models.push(record);
}

const total = models.length;
const schemaEntries = [...pathStats].map(([path,item]) => ({path,count:item.models.size,percent:Number((100*item.models.size/total).toFixed(1)),types:[...item.types],examples:item.examples})).sort((a,b)=>b.count-a.count||a.path.localeCompare(b.path));
const schema = {
  presentInAll:schemaEntries.filter((item)=>item.count===total),
  presentInMost:schemaEntries.filter((item)=>item.count<total&&item.count>=Math.ceil(total*.75)),
  optional:schemaEntries.filter((item)=>item.count<Math.ceil(total*.75)&&item.count>1),
  rare:schemaEntries.filter((item)=>item.count===1),
};

const folderGroups = Map.groupBy(models,(model)=>model.parentFolder);
const families = [...folderGroups].filter(([,items])=>items.length>1).map(([folder,items]) => ({folder,count:items.length,
  architectures:[...new Set(items.map((item)=>item.architecture))], versions:[...new Set(items.map((item)=>item.version))],
  sampleRates:[...new Set(items.map((item)=>item.sampleRate))], configSignatures:[...new Set(items.map((item)=>item.configSignature))],
  fileSizes:{minimum:Math.min(...items.map((item)=>item.fileSizeBytes)),maximum:Math.max(...items.map((item)=>item.fileSizeBytes))},
  members:items.map((item)=>({filename:item.filename,fileSizeBytes:item.fileSizeBytes,architecture:item.architecture,version:item.version,sampleRate:item.sampleRate,
    configSignature:item.configSignature,metadata:item.metadata,calibrationFields:item.calibrationFields,cabinetIrFields:item.cabinetIrFields}))}));

const irAssets = [];
for (const path of await filesUnder(irRoot)) {
  const info = await stat(path);
  const extension = extname(path).toLowerCase();
  const record = {relativePath:posix(relative(irRoot,path)),filename:basename(path),parentFolder:posix(relative(irRoot,dirname(path)))||'.',extension,fileSizeBytes:info.size};
  if (extension === '.wav') record.wav = parseWav(await readFile(path));
  irAssets.push(record);
}

const report = {generatedAt:new Date().toISOString(), sources:{modelsRoot:'src/nam-wam/models',irRoot:'src/cabinet-wam/IRs'}, summary:{
  modelFiles:models.length,jsonParsed:models.filter((item)=>item.jsonParsed).length,jsonFailed:models.filter((item)=>!item.jsonParsed).length,
  a2Models:models.filter((item)=>item.isA2).length,architectures:Object.fromEntries([...Map.groupBy(models,(item)=>item.architecture)].map(([key,value])=>[String(key),value.length])),
  versions:Object.fromEntries([...Map.groupBy(models,(item)=>String(item.version))].map(([key,value])=>[key,value.length])),
  sampleRates:Object.fromEntries([...Map.groupBy(models,(item)=>String(item.sampleRate))].map(([key,value])=>[key,value.length])),
  modelsWithCalibrationFields:models.filter((item)=>item.calibrationFields.length).length,
  modelsWithCabinetIrFields:models.filter((item)=>item.cabinetIrFields.length).length,
  irAssets:irAssets.length,irExtensions:Object.fromEntries([...Map.groupBy(irAssets,(item)=>item.extension)].map(([key,value])=>[key,value.length])),
},models,families,schema,irAssets};

await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary,null,2));
