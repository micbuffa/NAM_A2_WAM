import {confirmDialog} from './dialogs.js';

// After sign-in, offer once per account to copy what this browser stored as a
// guest (NAM/IR favorites, preferences). Local copies are kept. Presets are
// not part of it: on the online rack, saving one needs an account.
const FAVORITES_PER_REQUEST = 10; // NAM favorites embed the model (~300 KB)

const chunks = (items, size) => Array.from({length: Math.ceil(items.length / size)}, (_, index) => items.slice(index * size, (index + 1) * size));
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export default class LocalDataImport {
  constructor({account, localFavorites, readLocalPreferences, encodeAsset, storage = globalThis.localStorage, confirm = confirmDialog}) {
    Object.assign(this, {account, localFavorites, readLocalPreferences, encodeAsset, storage, confirm});
  }

  flagKey(user) { return `nam-a2-wam.account.import-offered.${user.id}`; }

  offered(user) { try { return Boolean(this.storage?.getItem(this.flagKey(user))); } catch { return true; } }

  markOffered(user) { try { this.storage?.setItem(this.flagKey(user), new Date().toISOString()); } catch { /* Offer again next time. */ } }

  async collect() {
    const favorites = [];
    for (const [kind, store] of Object.entries(this.localFavorites)) {
      for (const record of await store.list()) favorites.push({kind, assetRef: record.identity, metadata: this.encodeAsset(record.asset)});
    }
    return {favorites, preferences: this.readLocalPreferences()};
  }

  // Resolves with {favorites, preferences} (a count and a boolean),
  // or null when declined or, for the automatic offer, when there is nothing
  // to import. force: asked from Settings > Account, even if offered before;
  // an empty browser then resolves with zero counts.
  async offer({force = false} = {}) {
    const user = this.account.user;
    if (!user || (!force && this.offered(user))) return null;
    const data = await this.collect();
    const hasPreferences = Object.keys(data.preferences).length > 0;
    if (!data.favorites.length && !hasPreferences) {
      this.markOffered(user);
      return force ? {favorites: 0, preferences: false} : null;
    }

    const parts = [data.favorites.length && plural(data.favorites.length, 'favorite'), hasPreferences && 'your level preferences'].filter(Boolean);
    const confirmed = await this.confirm({title: 'Import this browser’s data?',
      message: `This browser has ${parts.join(', ')} saved without an account. Copy them to ${user.email}?`,
      confirmLabel: 'Import', cancelLabel: 'Not now'});
    this.markOffered(user);
    if (!confirmed) return null;

    const api = this.account.api;
    await api.importLocalData({preferences: data.preferences});
    for (const batch of chunks(data.favorites, FAVORITES_PER_REQUEST)) await api.importLocalData({favorites: batch});
    return {favorites: data.favorites.length, preferences: hasPreferences};
  }
}
