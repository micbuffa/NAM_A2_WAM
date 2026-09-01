const STORAGE_PREFIX = 'nam-a2-wam.tone3000.';

export const TONE3000_AUTH_URL = 'https://www.tone3000.com/api/v1/oauth/authorize';
export const TONE3000_TOKEN_URL = 'https://www.tone3000.com/api/v1/oauth/token';
export const TONE3000_CALLBACK_CHANNEL = 'nam-a2-wam.tone3000.callback';
export const TONE3000_CALLBACK_STORAGE_KEY = 'nam-a2-wam.tone3000.callback';

const base64Url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
};

export const createCodeVerifier = (randomValues = crypto.getRandomValues.bind(crypto)) => {
  const bytes = new Uint8Array(32);
  randomValues(bytes);
  return base64Url(bytes);
};

export const createCodeChallenge = async (verifier, subtle = crypto.subtle) => {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
};

export const createState = (randomValues = crypto.getRandomValues.bind(crypto)) => createCodeVerifier(randomValues);

export const storageKeys = Object.freeze({
  verifier: `${STORAGE_PREFIX}code-verifier`, state: `${STORAGE_PREFIX}state`, pending: `${STORAGE_PREFIX}pending`,
});

export const defaultRedirectUri = (location = window.location) => {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/[^/]*$/u, '');
  return url.href;
};

export const createSelectUrl = async ({clientId, redirectUri, storage = sessionStorage, options = {},
  randomValues} = {}) => {
  if (!clientId) throw new Error('TONE3000 integration is not configured');
  if (!redirectUri) throw new Error('TONE3000 redirect URI is not configured');
  const verifier = createCodeVerifier(randomValues);
  const state = createState(randomValues);
  const challenge = await createCodeChallenge(verifier);
  storage.setItem(storageKeys.verifier, verifier);
  storage.setItem(storageKeys.state, state);
  storage.setItem(storageKeys.pending, 'select_tone');
  const params = new URLSearchParams({client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'select_tone',
    platform: 'nam', format: 'nam', architecture: '2', ...options});
  return `${TONE3000_AUTH_URL}?${params}`;
};

export const clearOAuthTransaction = (storage = sessionStorage) => {
  Object.values(storageKeys).forEach((key) => storage.removeItem(key));
};

export const exchangeAuthorizationCode = async ({clientId, redirectUri, code, storage = sessionStorage,
  fetchImpl = fetch} = {}) => {
  const verifier = storage.getItem(storageKeys.verifier);
  if (!verifier) throw new Error('TONE3000 OAuth transaction is missing or expired');
  const response = await fetchImpl(TONE3000_TOKEN_URL, {method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'authorization_code', code, code_verifier: verifier,
      redirect_uri: redirectUri, client_id: clientId})});
  if (!response.ok) throw new Error(`TONE3000 token exchange failed (${response.status})`);
  return response.json();
};

export const completeOAuthCallback = async ({clientId, redirectUri, location = window.location,
  storage = sessionStorage, fetchImpl = fetch} = {}) => {
  const params = new URL(location.href).searchParams;
  if (!params.has('code') && !params.has('error') && !params.has('canceled')) return {handled: false};
  if (params.get('canceled') === 'true') {
    clearOAuthTransaction(storage);
    return {handled: true, ok: false, canceled: true, error: 'TONE3000 selection cancelled'};
  }
  const expected = storage.getItem(storageKeys.state);
  const received = params.get('state');
  if (params.get('error')) {
    clearOAuthTransaction(storage);
    return {handled: true, ok: false, error: params.get('error_description') || params.get('error')};
  }
  if (!expected || !received || expected !== received) {
    clearOAuthTransaction(storage);
    return {handled: true, ok: false, error: 'TONE3000 OAuth state validation failed'};
  }
  try {
    const tokens = await exchangeAuthorizationCode({clientId, redirectUri, code: params.get('code'), storage, fetchImpl});
    const toneId = params.get('tone_id');
    clearOAuthTransaction(storage);
    return {handled: true, ok: true, tokens, toneId};
  } catch (error) {
    clearOAuthTransaction(storage);
    return {handled: true, ok: false, error: error.message};
  }
};
