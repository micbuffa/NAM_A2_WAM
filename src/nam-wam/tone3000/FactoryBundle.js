const encoder = new TextEncoder();

export const sanitizePathSegment = (value, fallback = 'untitled') => {
  const cleaned = String(value || '').normalize('NFKC').replace(/[\u0000-\u001f<>:"/\\|?*]/gu, ' ')
    .replace(/\s+/gu, ' ').replace(/^\.+|\.+$/gu, '').trim();
  return (cleaned || fallback).slice(0, 120);
};

const listNames = (values) => (Array.isArray(values) ? values : []).map((value) => value?.name || value?.title || value).filter(Boolean);
const creatorFromTone = (tone) => tone.user || tone.creator || {};
const extensionFor = (kind) => kind === 'ir' ? '.wav' : '.nam';
const toneCategory = (tone) => {
  const explicit=String(tone.category||'').trim().toLowerCase();
  if(['guitar','bass','pedal'].includes(explicit))return explicit;
  const tags=listNames(tone.tags).map((tag)=>String(tag).trim().toLowerCase());
  if(tags.includes('bass')||/\bbass\b/iu.test(String(tone.title||tone.name||'')))return 'bass';
  const gear=String(tone.gear||tone.gear_type||'').trim().toLowerCase().replaceAll('_','-');
  if(['pedal','pedal-only','effect','stompbox'].includes(gear))return 'pedal';
  return 'guitar';
};

const assetFilename = (model, kind) => {
  const requiredExtension = extensionFor(kind);
  const original = sanitizePathSegment(model.name || `model-${model.id}`);
  const dot = original.lastIndexOf('.');
  const hasExpectedExtension = original.toLowerCase().endsWith(requiredExtension);
  const stem = hasExpectedExtension ? original.slice(0, -requiredExtension.length) : (dot > 0 ? original.slice(0, dot) : original);
  return `${stem}--m${model.id}${requiredExtension}`;
};

const imageExtension = (contentType = '', sourceUrl = '') => {
  if (/png/iu.test(contentType)) return '.png';
  if (/webp/iu.test(contentType)) return '.webp';
  if (/jpe?g/iu.test(contentType)) return '.jpg';
  const match = new URL(sourceUrl, 'https://www.tone3000.com').pathname.match(/\.(png|webp|jpe?g)$/iu);
  return match ? `.${match[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
};

export const sha256Hex = async (bytes, subtle = crypto.subtle) => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await subtle.digest('SHA-256', view);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

export async function createFactoryBundle({tone, models, downloads, kind = 'nam', image = null, importedAt = new Date().toISOString()} = {}) {
  if (!tone?.id || !Array.isArray(models) || !models.length) throw new Error('A TONE3000 tone and at least one selected model are required');
  const creator = creatorFromTone(tone);
  const creatorName = creator.username || creator.display_name || creator.name || 'unknown-creator';
  const title = tone.title || tone.name || `Tone ${tone.id}`;
  const root = `tone3000/${sanitizePathSegment(creatorName)}/${sanitizePathSegment(title)}--t${tone.id}`;
  const entries = []; const assets = [];
  for (const model of models) {
    const download = downloads.find((candidate) => String(candidate.modelId) === String(model.id));
    if (!download?.bytes) throw new Error(`Downloaded data is missing for model ${model.id}`);
    const bytes = download.bytes instanceof Uint8Array ? download.bytes : new Uint8Array(download.bytes);
    const file = `captures/${assetFilename(model, kind)}`;
    entries.push({path: `${root}/${file}`, bytes});
    assets.push({id: model.id, file, name: model.name || `Model ${model.id}`,
      ...(kind === 'nam' ? {architecture: String(model.architecture_version ?? model.architecture ?? '2')} : {}),
      ...(model.size ? {size: model.size} : {}), ...(model.created_at ? {createdAt: model.created_at} : {}),
      sha256: await sha256Hex(bytes)});
  }
  let localImage = null;
  if (image?.bytes) {
    localImage = `cover${imageExtension(image.contentType, image.url)}`;
    entries.push({path: `${root}/${localImage}`, bytes: image.bytes instanceof Uint8Array ? image.bytes : new Uint8Array(image.bytes)});
  }
  const toneManifest = {schemaVersion: 1, source: 'TONE3000', importedAt,
    tone: {id: tone.id, title, description: tone.description || null, url: tone.url || null,
      format: kind === 'ir' ? 'ir' : 'nam', ...(kind === 'nam' ? {category:toneCategory(tone)} : {}), gear: tone.gear || null, license: tone.license || null,
      creator: {username: creator.username || creatorName, displayName: creator.display_name || creator.name || null,
        url: creator.url || null}, makes: listNames(tone.makes), tags: listNames(tone.tags),
      image: localImage, sourceImages: Array.isArray(tone.images) ? tone.images : []}, assets};
  entries.push({path: `${root}/tone.json`, bytes: encoder.encode(`${JSON.stringify(toneManifest, null, 2)}\n`)});
  return {root, filename: `${sanitizePathSegment(title)}--t${tone.id}-${kind}-factory.zip`, manifest: toneManifest, entries};
}

let crcTable;
const crc32 = (bytes) => {
  if (!crcTable) crcTable = Array.from({length: 256}, (_, index) => { let value = index; for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const zipDate = (date = new Date()) => ({time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1), date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()});
const concat = (chunks) => { const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0); const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; } return output; };

export function createZip(entries, date = new Date()) {
  const localChunks = []; const centralChunks = []; let offset = 0; const stamp = zipDate(date);
  for (const entry of entries) {
    const name = encoder.encode(entry.path); const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes);
    const crc = crc32(bytes); const local = new Uint8Array(30 + name.length); const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true);
    localView.setUint16(10, stamp.time, true); localView.setUint16(12, stamp.date, true); localView.setUint32(14, crc, true);
    localView.setUint32(18, bytes.length, true); localView.setUint32(22, bytes.length, true); localView.setUint16(26, name.length, true); local.set(name, 30);
    localChunks.push(local, bytes);
    const central = new Uint8Array(46 + name.length); const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(12, stamp.time, true); centralView.setUint16(14, stamp.date, true); centralView.setUint32(16, crc, true);
    centralView.setUint32(20, bytes.length, true); centralView.setUint32(24, bytes.length, true); centralView.setUint16(28, name.length, true); centralView.setUint32(42, offset, true); central.set(name, 46);
    centralChunks.push(central); offset += local.length + bytes.length;
  }
  const centralDirectory = concat(centralChunks); const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true); endView.setUint32(16, offset, true);
  return new Blob([...localChunks, centralDirectory, end], {type: 'application/zip'});
}

export function downloadBlob(blob, filename, {documentImpl = document, urlImpl = URL} = {}) {
  const objectUrl = urlImpl.createObjectURL(blob); const anchor = documentImpl.createElement('a');
  anchor.href = objectUrl; anchor.download = filename; anchor.hidden = true; documentImpl.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => urlImpl.revokeObjectURL(objectUrl), 1000);
}
