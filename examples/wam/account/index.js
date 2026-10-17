import AccountApi from './api.js';
import Account from './Account.js';
import AccountFavorites, {encodeAsset} from './AccountFavorites.js';
import AccountPanel from './AccountPanel.js';
import LocalDataImport from './LocalDataImport.js';
import {FactoryPresetStore} from './FactoryPresets.js';
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
  // The rack as it starts, before any preset (captured by attach): Factory
  // presets build on it, "New preset > Default rack" restores it.
  let guestRack = null;
  const defaultState = () => structuredClone(guestRack);
  const factoryStore = new FactoryPresetStore({manifestUrl: NamPlugin.factoryManifestUrl, baseState: defaultState});
  if (!api.available) {
    return {account: null, attach: async ({settings, captureState, applyState, suggestName, report}) => {
      guestRack = await captureState();
      settings?.addSection({id: 'account', label: 'Account', icon: 'user', order: 3, render: (container) => {
        const note = Object.assign(document.createElement('p'), {className: 'host-help',
          textContent: 'Accounts are available on the online rack. Here, presets and favorites are stored in this browser.'});
        container.append(Object.assign(document.createElement('h3'), {textContent: 'Account'}), note);
      }});
      return new PresetsPanel({localStore: localPresets, factoryStore, captureState, applyState, defaultState, suggestName, report}).attach();
    }};
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

  // guis(): the plugin editors currently open (FxChain creates them on demand).
  // settings: the SettingsView that hosts the Account section.
  const attach = async ({settings, guis = () => [], captureState, applyState, suggestName, report = () => {}}) => {
    // What a guest gets. Signing out goes back to it (PresetsPanel).
    guestRack = await captureState();
    const presets = new PresetsPanel({account, localStore: localPresets, remoteStore: new RemotePresetStore({api}), factoryStore,
      captureState, applyState, defaultState, suggestName, report});
    const importer = new LocalDataImport({account, localPresets, localFavorites, readLocalPreferences, encodeAsset});
    const reloadGuis = () => Promise.all(guis().map((gui) => gui.reloadAccountData?.()));
    // force: asked from Settings > Account rather than offered after sign-in.
    const offerImport = async ({force = false} = {}) => {
      const imported = await importer.offer({force});
      if (!imported || !(imported.presets || imported.favorites || imported.preferences)) return imported;
      await account.refresh(); // merged preferences
      await Promise.all([reloadGuis(), presets.refresh()]);
      report(`Imported ${imported.presets} preset(s) and ${imported.favorites} favorite(s) into your account.`);
      return imported;
    };
    // PresetsPanel switches the rack on change (default when signing out, last
    // preset when signing in); the plugin GUIs need a nudge.
    account.addEventListener('change', () => {
      reloadGuis().then(() => offerImport()).catch((error) => report(`Account sync failed: ${error.message}`, true));
    });
    new AccountPanel({account, settings, importLocalData: offerImport}).attach();
    await presets.attach();
    // Signed in by a page load (magic link, then "Open the rack").
    if (account.signedIn) offerImport().catch((error) => report(`Import failed: ${error.message}`, true));
    return presets;
  };
  return {account, attach};
}
