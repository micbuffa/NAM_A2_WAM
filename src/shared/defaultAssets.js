import {factoryAssetUrl} from './assetBrowser.js';

// Non-visual initialization, shared by standalone instances and the host.
export async function loadDefaultAsset(node, kind, manifestUrl, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const state = await node.getState();
  if (kind === 'nam' ? state.model?.data : state.ir?.samples) return;
  const revision = node.assetRevision || 0;
  const response = await fetchImpl(manifestUrl);
  if (!response.ok) throw new Error(`Factory manifest: HTTP ${response.status}`);
  const {assets = []} = await response.json();
  const asset = kind === 'nam'
    ? assets.find(a => a.category === 'guitar' && Number(a.provenance?.toneId) === 80705)
    : assets.find(a => a.filename === 'V30 LL 4FB 4x12 SM57 0.50in 0--m239290.wav');
  if (!asset) throw new Error(`Default ${kind} asset missing`);
  const folder = kind === 'nam' ? 'models' : 'IRs';
  const data = await fetchImpl(factoryAssetUrl(manifestUrl, folder, asset.relativePath));
  if (!data.ok) throw new Error(`Default asset: HTTP ${data.status}`);
  const provenance = {...asset.provenance, identity: asset.id, source: 'Factory',
    title: asset.provenance?.title || asset.displayName,
    gear: asset.provenance?.gear || asset.metadata?.gear_type,
    imageUrl: asset.imagePath ? factoryAssetUrl(manifestUrl, folder, asset.imagePath).href : ''};
  const payload = kind === 'nam' ? await data.text() : await node.context.decodeAudioData(await data.arrayBuffer());
  if ((node.assetRevision || 0) !== revision) return;
  if (kind === 'nam') await node.loadModelText(payload, asset.filename, provenance);
  else await node.loadImpulseResponse(payload.getChannelData(0), asset.filename, asset.id, provenance);
}
