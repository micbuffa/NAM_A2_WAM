// Favorites store handed to the plugin GUIs (NamPlugin/CabinetPlugin
// .configureAccount). Signed in: the account's server favorites. Signed out:
// the browser's IndexedDB store, exactly as before. Exposes both the
// ModelFavorites (list/save/delete) and the IR library
// (listFavorites/saveFavorite/deleteFavorite) method names.
const BYTES_TAG = '$bytes';

const toBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (text) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));

// Asset snapshots may hold IR file bytes; JSON needs them as base64.
export const encodeAsset = (asset) => Object.fromEntries(Object.entries(asset || {}).filter(([, value]) => value !== undefined)
  .map(([key, value]) => [key, value instanceof Uint8Array || value instanceof ArrayBuffer
    ? {[BYTES_TAG]: toBase64(new Uint8Array(value))} : value]));
export const decodeAsset = (metadata) => Object.fromEntries(Object.entries(metadata || {})
  .map(([key, value]) => [key, typeof value?.[BYTES_TAG] === 'string' ? fromBase64(value[BYTES_TAG]) : value]));

export default class AccountFavorites {
  constructor({account, kind, local}) {
    this.account = account;
    this.kind = kind;
    this.local = local; // {list(), save(asset), delete(identity)}
  }

  get available() { return true; }

  async list() {
    if (!this.account.signedIn) return this.local.list();
    const favorites = await this.account.api.listFavorites(this.kind);
    return favorites.map((favorite) => ({identity: favorite.assetRef, savedAt: favorite.savedAt, asset: decodeAsset(favorite.metadata)}));
  }

  async save(asset) {
    if (!asset?.id) throw new Error('An asset identity is required');
    if (!this.account.signedIn) return this.local.save(asset);
    const favorite = await this.account.api.saveFavorite(this.kind, asset.id, encodeAsset(asset));
    return {identity: favorite.assetRef, savedAt: favorite.savedAt, asset};
  }

  async delete(identity) {
    if (!this.account.signedIn) return this.local.delete(identity);
    await this.account.api.deleteFavorite(this.kind, identity);
  }

  listFavorites() { return this.list(); }
  saveFavorite(asset) { return this.save(asset); }
  deleteFavorite(identity) { return this.delete(identity); }
}
