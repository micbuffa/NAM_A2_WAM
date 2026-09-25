// Same-origin JSON client for the Rails account API. Authentication rides on
// the httpOnly session cookie; writes carry the CSRF token from the page's
// <meta name="csrf-token">, refreshed whenever the server rotates it.
export class ApiError extends Error {
  constructor(message, status, body = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export default class AccountApi {
  constructor({document = globalThis.document, fetchImpl = globalThis.fetch?.bind(globalThis)} = {}) {
    this.document = document;
    this.fetch = fetchImpl;
  }

  // Only a Rails-rendered page has a CSRF meta tag; the static distribution
  // and the Node dev server run without accounts.
  get available() { return Boolean(this.csrfMeta); }
  get csrfMeta() { return this.document?.querySelector?.('meta[name="csrf-token"]') || null; }
  get csrfToken() { return this.csrfMeta?.getAttribute('content') || ''; }
  set csrfToken(value) { if (value) this.csrfMeta?.setAttribute('content', value); }

  initialUser() {
    try { return JSON.parse(this.document?.getElementById?.('currentUser')?.textContent || 'null'); }
    catch { return null; }
  }

  async request(method, path, body) {
    const headers = {'Accept': 'application/json'};
    if (method !== 'GET') headers['X-CSRF-Token'] = this.csrfToken;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await this.fetch(path, {method, headers, credentials: 'same-origin', cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body)});
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (data?.csrfToken) this.csrfToken = data.csrfToken;
    if (!response.ok) {
      const message = data?.error || (response.status === 401 ? 'Sign in to continue.' : `Request failed (${response.status})`);
      throw new ApiError(message, response.status, data);
    }
    return data;
  }

  me() { return this.request('GET', '/api/me'); }
  requestSignIn(email) { return this.request('POST', '/sign_in', {email}); }
  verifyCode(email, code) { return this.request('POST', '/sign_in/code', {email, code}); }
  signOut() { return this.request('DELETE', '/session'); }
  signOutOthers() { return this.request('DELETE', '/sessions/others'); }

  listPresets() { return this.request('GET', '/api/presets'); }
  getPreset(id) { return this.request('GET', `/api/presets/${encodeURIComponent(id)}`); }
  createPreset(name, state) { return this.request('POST', '/api/presets', {name, state}); }
  updatePreset(id, attributes) { return this.request('PATCH', `/api/presets/${encodeURIComponent(id)}`, attributes); }
  deletePreset(id) { return this.request('DELETE', `/api/presets/${encodeURIComponent(id)}`); }

  listFavorites(kind) { return this.request('GET', `/api/favorites?kind=${encodeURIComponent(kind)}`); }
  saveFavorite(kind, assetRef, metadata) { return this.request('POST', '/api/favorites', {kind, assetRef, metadata}); }
  deleteFavorite(kind, assetRef) {
    return this.request('DELETE', `/api/favorites?kind=${encodeURIComponent(kind)}&assetRef=${encodeURIComponent(assetRef)}`);
  }

  updatePreferences(values) { return this.request('PATCH', '/api/preferences', values); }
  importLocalData(data) { return this.request('POST', '/api/import', data); }
}
