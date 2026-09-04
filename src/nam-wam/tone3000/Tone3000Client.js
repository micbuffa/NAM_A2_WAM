import {completeOAuthCallback, createLoginUrl, createSelectUrl, defaultRedirectUri, TONE3000_TOKEN_URL} from './Tone3000Auth.js';

export const TONE3000_API_URL = 'https://www.tone3000.com/api/v1';

export class Tone3000Error extends Error {
  constructor(message, status = 0) { super(message); this.name = 'Tone3000Error'; this.status = status; }
}

export default class Tone3000Client {
  constructor({clientId, redirectUri, storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : null), fetchImpl, onAuthExpired} = {}) {
    this.clientId = clientId || '';
    this.redirectUri = redirectUri || (typeof window !== 'undefined' ? defaultRedirectUri() : '');
    this.storage = storage;
    this.fetchImpl = fetchImpl || (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);
    this.onAuthExpired = onAuthExpired;
    this.tokens = this._readStoredTokens();
  }

  get configured() { return Boolean(this.clientId && this.redirectUri); }
  _readStoredTokens() {
    try { const value = typeof localStorage !== 'undefined' ? localStorage.getItem('nam-a2-wam.tone3000.tokens') : null; return value ? JSON.parse(value) : null; } catch { return null; }
  }
  setTokens(tokens) { this.tokens = {...tokens, expiresAt: Date.now() + Number(tokens.expires_in || 3600) * 1000}; try { if (typeof localStorage !== 'undefined') localStorage.setItem('nam-a2-wam.tone3000.tokens', JSON.stringify(this.tokens)); } catch { /* Storage can be unavailable in embedded contexts. */ } }
  clearTokens() { this.tokens = null; try { if (typeof localStorage !== 'undefined') localStorage.removeItem('nam-a2-wam.tone3000.tokens'); } catch { /* Ignore unavailable storage. */ } }

  async createAuthorizationUrl(options = {}) {
    return createSelectUrl({clientId: this.clientId, redirectUri: this.redirectUri, storage: this.storage, options});
  }

  async createLoginUrl(options = {}) {
    return createLoginUrl({clientId: this.clientId, redirectUri: this.redirectUri, storage: this.storage, options});
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

  async getTone(toneId, {architecture = '2'} = {}) { const query=architecture?`?architecture=${encodeURIComponent(architecture)}`:'';return (await this.request(`/tones/${encodeURIComponent(toneId)}${query}`)).json(); }
  async listTones(endpoint, {page = 1, pageSize = 12, gear = ''} = {}) {
    const query = new URLSearchParams({page: String(page), page_size: String(pageSize)});
    if (gear) query.set('gear', gear);
    return (await this.request(`/tones/${endpoint}?${query}`)).json();
  }
  async listTrendingTones(gear = '') {
    const query = gear ? `?gear=${encodeURIComponent(gear)}` : '';
    const response = this.tokens?.access_token
      ? await this.request(`/tones/trending${query}`)
      : await this.fetchImpl(`${TONE3000_API_URL}/tones/trending${query}`);
    if (!response.ok) throw new Tone3000Error(`TONE3000 request failed (${response.status})`, response.status);
    return response.json();
  }
  async listLatestTones() { return (await this.request('/tones/latest')).json(); }
  async listDownloadedTones(options) { return this.listTones('downloaded', options); }
  async listFavoritedTones(options) { return this.listTones('favorited', options); }
  async listCreatedTones(options) { return this.listTones('created', options); }
  async listModels(toneId, {architecture = '2'} = {}) {
    const query=new URLSearchParams({tone_id:String(toneId),page_size:'300'});if(architecture)query.set('architecture',architecture);
    const result = await (await this.request(`/models?${query}`)).json();
    const models = Array.isArray(result) ? result : result.data || [];
    return models;
  }
  async getCompatibleModels(toneId) {
    const models = await this.listModels(toneId, {architecture:'2'});
    return models.filter((model) => String(model.architecture_version ?? model.architecture ?? 2) === '2');
  }
  async downloadModel(model) {
    if (!model?.model_url) throw new Tone3000Error('TONE3000 model has no download URL');
    const response = await this.request(model.model_url);
    return {text: await response.text(), name: model.name || `tone3000-${model.id}.nam`};
  }
  async downloadModelBytes(model) {
    if (!model?.model_url) throw new Tone3000Error('TONE3000 model has no download URL');
    const response = await this.request(model.model_url);
    return {bytes:new Uint8Array(await response.arrayBuffer()),name:model.name || `tone3000-${model.id}`,contentType:response.headers.get('Content-Type') || ''};
  }
  async downloadPublicAsset(url) {
    const response = await this.fetchImpl(url);
    if (!response.ok) throw new Tone3000Error(`TONE3000 image download failed (${response.status})`, response.status);
    return {bytes:new Uint8Array(await response.arrayBuffer()),contentType:response.headers.get('Content-Type') || '',url};
  }
}
