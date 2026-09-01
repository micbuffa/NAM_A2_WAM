import {completeOAuthCallback, createSelectUrl, defaultRedirectUri, TONE3000_TOKEN_URL} from './Tone3000Auth.js';

export const TONE3000_API_URL = 'https://www.tone3000.com/api/v1';

export class Tone3000Error extends Error {
  constructor(message, status = 0) { super(message); this.name = 'Tone3000Error'; this.status = status; }
}

export default class Tone3000Client {
  constructor({clientId, redirectUri, storage = sessionStorage, fetchImpl, onAuthExpired} = {}) {
    this.clientId = clientId || '';
    this.redirectUri = redirectUri || (typeof window !== 'undefined' ? defaultRedirectUri() : '');
    this.storage = storage;
    this.fetchImpl = fetchImpl || (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);
    this.onAuthExpired = onAuthExpired;
    this.tokens = null;
  }

  get configured() { return Boolean(this.clientId && this.redirectUri); }
  setTokens(tokens) { this.tokens = {...tokens, expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000}; }
  clearTokens() { this.tokens = null; }

  async createAuthorizationUrl(options = {}) {
    return createSelectUrl({clientId: this.clientId, redirectUri: this.redirectUri, storage: this.storage, options});
  }

  async authorize(options = {}) {
    const url = await this.createAuthorizationUrl(options);
    if (typeof window === 'undefined') return url;
    window.location.assign(url);
    return url;
  }

  async completeAuthorization(location) {
    const result = await completeOAuthCallback({clientId: this.clientId, redirectUri: this.redirectUri,
      location, storage: this.storage, fetchImpl: this.fetchImpl});
    if (result.ok) this.setTokens(result.tokens);
    return result;
  }

  async refresh() {
    const refreshToken = this.tokens?.refresh_token;
    if (!refreshToken) throw new Tone3000Error('TONE3000 authorization expired; please browse again');
    const response = await this.fetchImpl(TONE3000_TOKEN_URL, {method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({grant_type: 'refresh_token', refresh_token: refreshToken, client_id: this.clientId})});
    if (!response.ok) { this.clearTokens(); throw new Tone3000Error(`TONE3000 token refresh failed (${response.status})`, response.status); }
    const tokens = await response.json();
    this.setTokens({...this.tokens, ...tokens});
    return this.tokens;
  }

  async request(pathOrUrl, options = {}, retried = false) {
    if (!this.tokens?.access_token) throw new Tone3000Error('TONE3000 authorization is required');
    if (this.tokens.expiresAt && Date.now() >= this.tokens.expiresAt - 30000) await this.refresh();
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${TONE3000_API_URL}${pathOrUrl}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.tokens.access_token}`);
    const response = await this.fetchImpl(url, {...options, headers});
    if (response.status === 401 && !retried) { await this.refresh(); return this.request(pathOrUrl, options, true); }
    if (!response.ok) throw new Tone3000Error(`TONE3000 request failed (${response.status})`, response.status);
    return response;
  }

  async getTone(toneId) { return (await this.request(`/tones/${encodeURIComponent(toneId)}?architecture=2`)).json(); }
  async getCompatibleModels(toneId) {
    const result = await (await this.request(`/models?tone_id=${encodeURIComponent(toneId)}&architecture=2&page_size=300`)).json();
    const models = Array.isArray(result) ? result : result.data || [];
    return models.filter((model) => String(model.architecture ?? 2) === '2');
  }
  async downloadModel(model) {
    if (!model?.model_url) throw new Tone3000Error('TONE3000 model has no download URL');
    const response = await this.request(model.model_url);
    return {text: await response.text(), name: model.name || `tone3000-${model.id}.nam`};
  }
}
