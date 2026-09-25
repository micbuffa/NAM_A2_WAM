import AccountApi from './api.js';
import Account from './Account.js';
import AccountFavorites, {encodeAsset} from './AccountFavorites.js';
import AccountPanel from './AccountPanel.js';
import LocalDataImport from './LocalDataImport.js';
import PresetsPanel from './PresetsPanel.js';
import {LocalPresetStore, RemotePresetStore} from './PresetStore.js';

const MODEL_VARIANT_KEY = 'nam-a2-wam.model-variant';
const AUTO_LEVEL_KEY = 'nam-a2-wam.auto-level';

// Preferences a guest set in this browser (same keys as src/nam-wam/gui.js).
function readLocalPreferences(storage = globalThis.localStorage) {
  const preferences = {};
  try {
    const variant = storage.getItem(MODEL_VARIANT_KEY);
    const autoLevel = storage.getItem(AUTO_LEVEL_KEY);
    if (variant === 'full' || variant === 'lite') preferences.modelVariant = variant;
    if (autoLevel === 'on' || autoLevel === 'off') preferences.autoLevel = autoLevel === 'on';
  } catch { /* Storage can be unavailable in privacy modes. */ }
  return preferences;
}

// Call before the plugin GUIs are created: they read their account stores
// from NamPlugin.account / CabinetPlugin.account at initialization. Without
// the Rails page (static distribution) only guest presets are enabled.
export function setupAccount({NamPlugin, CabinetPlugin, ModelFavorites, ImpulseResponseLibrary}) {
  const api = new AccountApi();
  const localPresets = new LocalPresetStore();
  if (!api.available) {
    return {account: null, attach: ({captureState, applyState, suggestName}) =>
      new PresetsPanel({localStore: localPresets, captureState, applyState, suggestName}).attach()};
  }

  const account = new Account({api});
  const library = new ImpulseResponseLibrary();
  const localFavorites = {
    nam_model: new ModelFavorites(),
    ir: {list: () => library.listFavorites(), save: (asset) => library.saveFavorite(asset), delete: (identity) => library.deleteFavorite(identity)},
  };
  NamPlugin.configureAccount({
    favorites: new AccountFavorites({account, kind: 'nam_model', local: localFavorites.nam_model}),
    preferences: {
      read: () => account.user?.preferences || null,
      write: (key, value) => account.updatePreference(key, value).catch((error) => console.warn('Preference not saved', error)),
    },
  });
  CabinetPlugin.configureAccount({favorites: new AccountFavorites({account, kind: 'ir', local: localFavorites.ir})});

  const attach = async ({namGui, cabinetGui, captureState, applyState, suggestName, report = () => {}}) => {
    const presets = new PresetsPanel({account, localStore: localPresets, remoteStore: new RemotePresetStore({api}),
      captureState, applyState, suggestName});
    const importer = new LocalDataImport({account, localPresets, localFavorites, readLocalPreferences, encodeAsset});
    const reloadGuis = () => Promise.all([namGui?.reloadAccountData?.(), cabinetGui?.reloadAccountData?.()]);
    const offerImport = async () => {
      const imported = await importer.offer();
      if (!imported) return;
      await account.refresh(); // merged preferences
      await Promise.all([reloadGuis(), presets.refresh()]);
      report(`Imported ${imported.presets} preset(s) and ${imported.favorites} favorite(s) into your account.`);
    };
    // PresetsPanel refreshes itself on change; the plugin GUIs need a nudge.
    account.addEventListener('change', () => reloadGuis().then(offerImport)
      .catch((error) => report(`Account sync failed: ${error.message}`, true)));
    new AccountPanel({account}).attach();
    await presets.attach();
    // Signed in by a page load (magic link, then "Open the rack").
    if (account.signedIn) offerImport().catch((error) => report(`Import failed: ${error.message}`, true));
  };
  return {account, attach};
}
