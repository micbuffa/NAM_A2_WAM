import {ModelCache} from './ModelCache.js';
import {ModelDownloadManager} from './ModelDownloadManager.js';
import {detectCapabilities} from './Capabilities.js';
import {describeModelStatus} from './ModelStatus.js';

export async function initializeDownloads(root = document) {
  const $ = id => root.getElementById(id);
  const cache = new ModelCache();
  const manager = new ModelDownloadManager({cache, baseURL: new URL('./', import.meta.url).href, allowedOrigins: ['https://raw.githubusercontent.com','https://media.githubusercontent.com']});
  const bytes = size => `${(size / 1024).toFixed(1)} Kio`;
  const message = error => { $('downloadStatus').textContent = error.name === 'AbortError' ? 'Téléchargement annulé.' : error.message; };
  const capabilities = await detectCapabilities(); $('capabilities').textContent = capabilities.message;
  try {
    const response = await fetch(new URL('./fixtures/catalog.json', import.meta.url));
    if (!response.ok) throw Error('Catalogue de validation indisponible.');
    const catalog = await response.json();
    if (catalog.version !== 1 || !Array.isArray(catalog.models)) throw Error('Version du catalogue inconnue.');
    const musicalResponse = await fetch(new URL('./models.json', import.meta.url));
    if (!musicalResponse.ok) throw Error('Catalogue musical indisponible.');
    const musicalCatalog = await musicalResponse.json();
    if (musicalCatalog.version !== 1 || !Array.isArray(musicalCatalog.models)) throw Error('Catalogue musical invalide.');
    catalog.models = [...musicalCatalog.models, ...catalog.models];
    const controls = new Map();
    const update = async () => {
      const records = await cache.list();
      const size = records.reduce((sum, record) => sum + record.size, 0);
      const estimate = await navigator.storage?.estimate?.().catch(() => null);
      $('cacheUsage').textContent = `Cache modèles : ${bytes(size)} · ${records.length} installation(s).${estimate?.quota ? ` Quota estimé de cette origine : ${(estimate.quota / 1024 ** 2).toFixed(0)} Mio (partagé avec les autres données du site).` : ''}`;
    };
    for (const model of catalog.models) {
      manager.validate(model);
      const row = document.createElement('article'); row.className = 'download-model';
      const title = document.createElement('strong'); title.textContent = model.label;
      const detail = document.createElement('p'); detail.textContent = `v${model.version.slice(0,8)} · ${bytes(model.files.reduce((sum, file) => sum + file.size, 0))} · ${model.description}`;
      const license = document.createElement('a'); license.href = new URL(model.license.url, import.meta.url); license.target = '_blank'; license.rel = 'noopener'; license.textContent = model.license.name;
      const status = document.createElement('output'); status.setAttribute('aria-live', 'polite');
      const progress = document.createElement('progress'); progress.max = 1; progress.value = 0; progress.setAttribute('aria-label', `Téléchargement ${model.label}`);
      const download = document.createElement('button'); download.textContent = 'Télécharger';
      const cancel = document.createElement('button'); cancel.textContent = 'Annuler'; cancel.disabled = true;
      const verify = document.createElement('button'); verify.textContent = 'Vérifier';
      const remove = document.createElement('button'); remove.textContent = 'Supprimer du cache';
      const render = state => {
        const view = describeModelStatus(state, model);
        status.textContent = `${view.label}${view.detail ? ` · ${view.detail}` : ''}`;
        if(view.indeterminate)progress.removeAttribute('value');else progress.value=view.percent/100;
        download.disabled = !view.canDownload; cancel.disabled = !view.pending || !manager.tasks.has(model.id);
        verify.disabled = remove.disabled = !['installed','corrupt'].includes(state.state);
      };
      const refresh = async () => {
        render({state:'checking'});
        const state = await manager.getStatus(model);
        render(state);
        await update();
      };
      download.onclick = async () => {
        try { await manager.download(model); } catch (error) { message(error); }
      };
      cancel.onclick = () => manager.cancel(model.id);
      verify.onclick = () => refresh().catch(message);
      remove.onclick = async () => { try { await manager.remove(model); await refresh(); } catch (error) { message(error); } };
      controls.set(model.id, {render});
      row.append(title, detail, license, status, progress, download, cancel, verify, remove); $('downloadModels').append(row);
      await refresh();
    }
    manager.addEventListener('progress', event => {
      const {id, state, message: error} = event.detail; const view = controls.get(id);
      if (!view) return;
      view.render(event.detail);
      if(['installed','missing','cancelled','error'].includes(state))update().catch(message);
      if (error) $('downloadStatus').textContent = error;
    });
  } catch (error) { message(error); }
  return {cache, manager, capabilities};
}
