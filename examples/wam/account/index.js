import AccountApi from './api.js';
import Account from './Account.js';
import AccountFavorites, {encodeAsset} from './AccountFavorites.js';
import AccountPanel from './AccountPanel.js';
import LocalDataImport from './LocalDataImport.js';
import {FactoryPresetStore} from './FactoryPresets.js';
import PresetsPanel from './PresetsPanel.js';
import RackDraftStore from './RackDraft.js';
import {LocalPresetStore, RemotePresetStore, deleteLocalPresets} from './PresetStore.js';

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
// the Rails page (static distribution) there are no accounts and guests save
// presets in this browser; the online rack saves them to the account only.
export function setupAccount({NamPlugin, CabinetPlugin, ModelFavorites, ImpulseResponseLibrary}) {
  const api = new AccountApi();
  // The rack as it starts, before any preset (captured by attach): Factory
  // presets build on it, "New preset > Default rack" restores it.
  let guestRack = null;
  const defaultState = () => structuredClone(guestRack);
  const factoryStore = new FactoryPresetStore({manifestUrl: NamPlugin.factoryManifestUrl, baseState: defaultState});
  const draftStore = new RackDraftStore();
  if (!api.available) {
    return {account: null, factoryStore, attach: async ({settings, captureState, applyState, watchRack, suggestName, report}) => {
      guestRack = await captureState();
      settings?.addSection({id: 'account', label: 'Account', icon: 'user', order: 3, render: (container) => {
        const note = Object.assign(document.createElement('p'), {className: 'host-help',
          textContent: 'Accounts are available on the online rack. Here, presets and favorites are stored in this browser.'});
        container.append(Object.assign(document.createElement('h3'), {textContent: 'Account'}), note);
      }});
      return new PresetsPanel({localStore: new LocalPresetStore(), factoryStore, draftStore, watchRack, captureState, applyState, defaultState,
        suggestName, report}).attach();
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
  // watchRack(listener): calls listener whenever the rack changes (drafts).
  const attach = async ({settings, guis = () => [], captureState, applyState, watchRack, suggestName, report = () => {}}) => {
    // What a guest gets. Signing out goes back to it (PresetsPanel).
    guestRack = await captureState();
    let accountPanel = null;
    let accountSync = Promise.resolve(); // GUI reload and import offer after the last account change
    // Saving a preset needs an account. The New preset dialog waits for the
    // import offer, so the two dialogs do not stack.
    const requestSignIn = async (reason) => {
      const signedIn = await accountPanel.openSignIn({reason});
      if (signedIn) await accountSync;
      return signedIn;
    };
    const presets = new PresetsPanel({account, remoteStore: new RemotePresetStore({api}), factoryStore, draftStore, watchRack,
      captureState, applyState, defaultState, suggestName, requestSignIn, report});
    deleteLocalPresets();
    const importer = new LocalDataImport({account, localFavorites, readLocalPreferences, encodeAsset});
    const reloadGuis = () => Promise.all(guis().map((gui) => gui.reloadAccountData?.()));
    // force: asked from Settings > Account rather than offered after sign-in.
    const offerImport = async ({force = false} = {}) => {
      const imported = await importer.offer({force});
      if (!imported || !(imported.favorites || imported.preferences)) return imported;
      await account.refresh(); // merged preferences
      await reloadGuis();
      report(`Imported ${imported.favorites} favorite(s) into your account.`);
      return imported;
    };
    // PresetsPanel switches the rack on change (default when signing out, last
    // preset when signing in); the plugin GUIs need a nudge.
    account.addEventListener('change', () => {
      accountSync = reloadGuis().then(() => offerImport()).catch((error) => report(`Account sync failed: ${error.message}`, true));
    });
    accountPanel = new AccountPanel({account, settings, importLocalData: offerImport});
    accountPanel.attach();
    await presets.attach();
    // Signed in by a page load (magic link, then "Open the rack").
    if (account.signedIn) offerImport().catch((error) => report(`Import failed: ${error.message}`, true));
    return presets;
  };
  return {account, factoryStore, attach};
}
