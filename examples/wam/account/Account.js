// Current account state for the rack tab. Emits "change" when the user signs
// in or out here, or in another tab (BroadcastChannel from the sign-in page
// or from another rack tab), without reloading the page.
export const ACCOUNT_CHANNEL = 'nam-a2-wam.account';

export default class Account extends EventTarget {
  constructor({api, BroadcastChannelImpl = globalThis.BroadcastChannel} = {}) {
    super();
    this.api = api;
    this.user = api.initialUser();
    this.channel = typeof BroadcastChannelImpl === 'function' ? new BroadcastChannelImpl(ACCOUNT_CHANNEL) : null;
    if (this.channel) this.channel.onmessage = (event) => {
      if (event.data?.type === 'signed-in' || event.data?.type === 'signed-out') this.refresh().catch(() => {});
      // Lets the sign-in tab know a rack is open, so it closes instead of opening another one.
      if (event.data?.type === 'signed-in') this.channel.postMessage({type: 'rack-open'});
    };
  }

  get signedIn() { return Boolean(this.user); }

  setUser(user, {announce = false} = {}) {
    const previous = this.user;
    this.user = user || null;
    if (announce) this.channel?.postMessage({type: this.user ? 'signed-in' : 'signed-out'});
    if (previous?.id !== this.user?.id) this.dispatchEvent(new CustomEvent('change', {detail: {previous, user: this.user}}));
  }

  // Also refreshes the CSRF token (a sign-in elsewhere rotates the session).
  async refresh() {
    const {user} = await this.api.me();
    this.setUser(user);
    return user;
  }

  updatePreference(key, value) {
    if (!this.user) return Promise.resolve();
    this.user.preferences = {...this.user.preferences, [key]: value};
    return this.api.updatePreferences({[key]: value});
  }
}
