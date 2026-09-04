import {access, mkdtemp, readFile, readdir, rename, rm, stat, writeFile} from 'node:fs/promises';
import {basename, dirname, extname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const posix = (path) => path.split(sep).join('/');
const bundleCache = new Map();
const NAM_CATEGORIES = new Set(['guitar', 'bass', 'pedal']);

function normalizedCategory(value) {
  if (value == null || value === '') return null;
  const category = String(value).trim().toLowerCase();
  if (!NAM_CATEGORIES.has(category)) throw Error(`Invalid Factory NAM category: ${value}. Expected guitar, bass, or pedal`);
  return category;
}

async function filesUnder(directory) {
  const output = [];
  async function visit(current) {
    for (const entry of await readdir(current, {withFileTypes: true})) {
      if (entry.name.startsWith('.')) continue;
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) output.push(path);
    }
  }
  await visit(directory);
  return output.sort((a, b) => posix(relative(directory, a)).localeCompare(posix(relative(directory, b))));
}

function wavMetadata(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
  let offset = 12; let format = null; let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ' && size >= 16) format = {encodingCode: buffer.readUInt16LE(start), channels: buffer.readUInt16LE(start + 2), sampleRate: buffer.readUInt32LE(start + 4), bitDepth: buffer.readUInt16LE(start + 14), blockAlign: buffer.readUInt16LE(start + 12)};
    if (id === 'data') dataSize = size;
    offset = start + size + (size & 1);
  }
  return format ? {...format, frames: dataSize ? Math.floor(dataSize / format.blockAlign) : null} : null;
}

async function firstExisting(paths) {
  for (const path of paths) {
    try { await access(path); return path; } catch { /* Try the next conventional sidecar name. */ }
  }
  return null;
}

function pathInside(base, candidate) {
  const path = relative(base, candidate);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

async function readBundle(manifestPath, base) {
  if (bundleCache.has(manifestPath)) return bundleCache.get(manifestPath);
  let bundle;
  try { bundle = JSON.parse(await readFile(manifestPath, 'utf8')); }
  catch (error) { throw Error(`Invalid Factory bundle JSON: ${posix(relative(base, manifestPath))}: ${error.message}`); }
  if (bundle.schemaVersion !== 1 || !bundle.tone || !Array.isArray(bundle.assets)) throw Error(`Invalid Factory bundle schema: ${posix(relative(base, manifestPath))}`);
  const record = {path: manifestPath, directory: dirname(manifestPath), bundle};
  bundleCache.set(manifestPath, record);
  return record;
}

async function findBundle(assetPath, base) {
  let directory = dirname(assetPath);
  while (pathInside(base, directory)) {
    const manifestPath = resolve(directory, 'tone.json');
    try { await access(manifestPath); return readBundle(manifestPath, base); }
    catch (error) { if (error?.message?.startsWith('Invalid Factory bundle')) throw error; }
    if (directory === base) break;
    directory = dirname(directory);
  }
  return null;
}

function bundleData(bundleRecord, assetPath, base, contentHash) {
  if (!bundleRecord) return {};
  const {bundle, directory} = bundleRecord;
  const bundleRelativePath = posix(relative(directory, assetPath));
  const entry = bundle.assets.find((asset) => posix(asset.file || '') === bundleRelativePath);
  if (!entry) throw Error(`Factory bundle does not describe ${posix(relative(base, assetPath))}`);
  if (entry.sha256 && entry.sha256.toLowerCase() !== contentHash) throw Error(`Factory bundle hash mismatch: ${posix(relative(base, assetPath))}`);
  let image = null;
  if (bundle.tone.image) {
    image = resolve(directory, bundle.tone.image);
    if (!pathInside(base, image)) throw Error(`Factory bundle image escapes its library: ${bundle.tone.image}`);
  }
  const creator = bundle.tone.creator || {};
  const provenance = {
    provider: bundle.source || 'TONE3000', importedAt: bundle.importedAt,
    toneId: bundle.tone.id, modelId: entry.id, title: bundle.tone.title,
    description: bundle.tone.description, toneUrl: bundle.tone.url,
    format: bundle.tone.format, gear: bundle.tone.gear, license: bundle.tone.license,
    category: normalizedCategory(bundle.tone.category),
    creator: creator.displayName || creator.username, creatorUsername: creator.username,
    creatorUrl: creator.url, makes: bundle.tone.makes, tags: bundle.tone.tags,
  };
  return {entry, image, provenance};
}

function namCategory(relativePath, metadata, bundle) {
  if (bundle.provenance?.category) return bundle.provenance.category;
  const tags=(bundle.provenance?.tags||[]).map((tag)=>String(tag).trim().toLowerCase());
  if(tags.includes('bass'))return 'bass';
  const gear=[metadata.gear_type,bundle.provenance?.gear].map((value)=>String(value||'').trim().toLowerCase().replaceAll('_','-'));
  if(gear.some((value)=>['pedal','pedal-only','effect','stompbox'].includes(value)))return 'pedal';
  const filename=basename(relativePath);
  if(/^\[(?:OD|PEDAL|DIST|FUZZ)\](?:\s|$)/iu.test(filename))return 'pedal';
  if(relativePath.split('/').some((segment)=>segment.trim().toLowerCase()==='bass'))return 'bass';
  return 'guitar';
}

async function conventionalImage(path) {
  const stem = basename(path, extname(path)); const folder = dirname(path);
  return firstExisting(['.jpg', '.jpeg', '.png', '.webp'].map((extension) => resolve(folder, `${stem}${extension}`))
    .concat(['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'].map((name) => resolve(folder, name))));
}

function displayGroups(relativePath, bundle) {
  // Rich bundles keep their collision-safe provider/creator layout on disk, but
  // the browser only needs the tone name: creator attribution is shown on each
  // capture card from tone.json.
  if (bundle.provenance?.title) return [bundle.provenance.title];
  return relativePath.split('/').slice(0, -1);
}

async function namAsset(path, base) {
  const relativePath = posix(relative(base, path)); const source = await readFile(path, 'utf8');
  let json;
  try { json = JSON.parse(source); } catch (error) { throw Error(`Invalid NAM JSON: ${relativePath}: ${error.message}`); }
  const contentHash = createHash('sha256').update(source).digest('hex');
  const metadata = json.metadata || {}; const bundle = bundleData(await findBundle(path, base), path, base, contentHash);
  const image = bundle.image || await conventionalImage(path); const stem = basename(path, extname(path));
  if (image) await access(image);
  return {id: `factory:${relativePath}`, filename: basename(path), relativePath, contentHash,
    groups: displayGroups(relativePath, bundle), displayName: bundle.entry?.name || metadata.name || stem,
    type: 'nam', category: namCategory(relativePath, metadata, bundle), architecture: json.architecture ?? null, version: json.version ?? null, sampleRate: json.sample_rate ?? null,
    ...(image ? {imagePath: posix(relative(base, image))} : {}), ...(bundle.provenance ? {provenance: bundle.provenance} : {}),
    metadata: {name: metadata.name, gear_make: metadata.gear_make, gear_model: metadata.gear_model,
      gear_type: metadata.gear_type, tone_type: metadata.tone_type,
      modeled_by: metadata.modeled_by ?? metadata.modeledBy, trainer: metadata.trainer, date: metadata.date,
      gain: metadata.gain, loudness: metadata.loudness, input_level_dbu: metadata.input_level_dbu,
      output_level_dbu: metadata.output_level_dbu}};
}

async function irAsset(path, base) {
  const relativePath = posix(relative(base, path)); const bytes = await readFile(path);
  const info = await stat(path); const contentHash = createHash('sha256').update(bytes).digest('hex');
  const bundle = bundleData(await findBundle(path, base), path, base, contentHash);
  const image = bundle.image || await conventionalImage(path);
  if (image) await access(image);
  const audio = extname(path).toLowerCase() === '.wav' ? wavMetadata(bytes) : null;
  return {id: `factory:${relativePath}`, filename: basename(path), relativePath,
    groups: displayGroups(relativePath, bundle), displayName: bundle.entry?.name || basename(path, extname(path)),
    type: 'ir', contentHash, ...(audio ? {audio} : {}), fileSizeBytes: info.size,
    ...(image ? {imagePath: posix(relative(base, image))} : {}), ...(bundle.provenance ? {provenance: bundle.provenance} : {})};
}

async function writeManifest(base, extension, make, output) {
  bundleCache.clear();
  const paths = (await filesUnder(base)).filter((path) => extname(path).toLowerCase() === extension);
  const assets = [];
  for (const path of paths) assets.push(await make(path, base));
  const ids = new Set(); const providerIds = new Set();
  for (const asset of assets) {
    if (ids.has(asset.id)) throw Error(`Duplicate asset ID: ${asset.id}`); ids.add(asset.id);
    if (asset.provenance?.toneId != null && asset.provenance?.modelId != null) {
      const providerId = `${asset.provenance.provider}:${asset.provenance.toneId}:${asset.provenance.modelId}`;
      if (providerIds.has(providerId)) throw Error(`Duplicate provider asset ID: ${providerId}`); providerIds.add(providerId);
    }
  }
  const manifest = {version: 2, assets};
  const temporaryDirectory = await mkdtemp(resolve(dirname(output), '.manifest-'));
  const temporaryPath = resolve(temporaryDirectory, basename(output));
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporaryPath, output);
  await rm(temporaryDirectory, {recursive: true, force: true});
  return assets.length;
}

const modelsRoot = resolve(process.env.FACTORY_MODELS_ROOT || resolve(root, 'src/nam-wam/models'));
const irRoot = resolve(process.env.FACTORY_IR_ROOT || resolve(root, 'src/cabinet-wam/IRs'));
const modelsOutput = resolve(process.env.FACTORY_MODELS_MANIFEST || resolve(root, 'src/nam-wam/models-manifest.json'));
const irOutput = resolve(process.env.FACTORY_IR_MANIFEST || resolve(root, 'src/cabinet-wam/irs-manifest.json'));
const models = await writeManifest(modelsRoot, '.nam', namAsset, modelsOutput);
const impulseResponses = await writeManifest(irRoot, '.wav', irAsset, irOutput);
console.log(`NAM: ${models} models -> ${modelsOutput}`);
console.log(`Cabinet: ${impulseResponses} IRs -> ${irOutput}`);
