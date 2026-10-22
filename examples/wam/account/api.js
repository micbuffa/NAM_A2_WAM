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

  // body: a JSON value, or FormData (multipart, for audio uploads).
  async request(method, path, body) {
    const headers = {'Accept': 'application/json'};
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    if (method !== 'GET') headers['X-CSRF-Token'] = this.csrfToken;
    if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
    const response = await this.fetch(path, {method, headers, credentials: 'same-origin', cache: 'no-store',
      body: body === undefined || multipart ? body : JSON.stringify(body)});
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
  signOut() { return this.request('DELETE', '/session'); }

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

  // Projects: owned ones and those shared with the user (read-only).
  listProjects() { return this.request('GET', '/api/projects'); }
  getProject(id) { return this.request('GET', projectPath(id)); }
  createProject(attributes) { return this.request('POST', '/api/projects', attributes); }
  updateProject(id, attributes) { return this.request('PATCH', projectPath(id), attributes); }
  deleteProject(id) { return this.request('DELETE', projectPath(id)); }

  // attributes: camelCase track fields; audio: a File, sent as multipart.
  createTrack(projectId, attributes, audio = null) {
    return this.request('POST', `${projectPath(projectId)}/tracks`, trackBody(attributes, audio));
  }
  updateTrack(projectId, id, attributes, audio = null) {
    return this.request('PATCH', `${projectPath(projectId)}/tracks/${encodeURIComponent(id)}`, trackBody(attributes, audio));
  }
  deleteTrack(projectId, id) { return this.request('DELETE', `${projectPath(projectId)}/tracks/${encodeURIComponent(id)}`); }
  reorderTracks(projectId, ids) { return this.request('PATCH', `${projectPath(projectId)}/tracks/order`, {ids}); }
  // The account preset of a track, {id, name, state}: shared viewers can read it too.
  getTrackPreset(projectId, id) { return this.request('GET', `${projectPath(projectId)}/tracks/${encodeURIComponent(id)}/preset`); }

  listShares(projectId) { return this.request('GET', `${projectPath(projectId)}/shares`); }
  shareProject(projectId, email) { return this.request('POST', `${projectPath(projectId)}/shares`, {email}); }
  unshareProject(projectId, id) { return this.request('DELETE', `${projectPath(projectId)}/shares/${encodeURIComponent(id)}`); }
  // A shared viewer removes their own access.
  leaveProject(projectId) { return this.request('DELETE', `${projectPath(projectId)}/shares/mine`); }

  updatePreferences(values) { return this.request('PATCH', '/api/preferences', values); }
  importLocalData(data) { return this.request('POST', '/api/import', data); }
}

const projectPath = (id) => `/api/projects/${encodeURIComponent(id)}`;

// Multipart only when a file is sent; null values become empty fields, which
// Rails reads as nil.
function trackBody(attributes, audio) {
  if (!audio) return attributes;
  const form = new FormData();
  for (const [key, value] of Object.entries(attributes)) form.append(key, value ?? '');
  form.append('audio', audio, audio.name);
  return form;
}
