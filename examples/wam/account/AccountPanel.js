import {actionsRow, button, createDialog} from './dialogs.js';

// Topbar account control (#accountPanel): "Sign in" for guests, an avatar
// chip once signed in. The chip opens the account dialog (identity, what is
// synced, sign out). Sign-in and sign-up are one flow: email -> link by mail.
// The link, opened on this computer, signs in another tab which notifies this
// one via BroadcastChannel.
export const initials = (email = '') => {
  const words = email.split('@')[0].split(/[._+-]+/u).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
};

export default class AccountPanel {
  constructor({account, root = document}) {
    this.account = account;
    this.api = account.api;
    this.$ = (id) => root.getElementById(id);
    this.panel = this.$('accountPanel');
  }

  attach() {
    this.panel.hidden = false;
    this.$('accountSignIn').onclick = () => this.openSignIn();
    this.$('accountChip').onclick = () => this.openAccount();
    this.account.addEventListener('change', () => {
      this.render();
      if (this.account.signedIn) this.signInDialog?.close();
      else this.accountDialog?.close();
    });
    this.render();
  }

  render() {
    const user = this.account.user;
    this.$('accountSignIn').hidden = Boolean(user);
    this.$('accountChip').hidden = !user;
    this.$('accountEmail').textContent = user?.email || '';
    this.$('accountAvatar').textContent = user ? initials(user.email) : '';
    this.$('accountChip').title = user ? `Account: ${user.email}` : 'Account';
  }

  // Focus goes back to whichever topbar control is visible after a dialog closes.
  restoreFocus() { this.$(this.account.signedIn ? 'accountChip' : 'accountSignIn').focus(); }

  openAccount() {
    const user = this.account.user;
    if (!user) return;
    const {dialog, body} = createDialog({title: 'Account', eyebrow: 'Signed in', className: 'account-dialog'});
    this.accountDialog = dialog;
    dialog.addEventListener('close', () => { if (this.accountDialog === dialog) this.accountDialog = null; this.restoreFocus(); }, {once: true});

    const identity = document.createElement('div');
    identity.className = 'account-identity';
    const avatar = Object.assign(document.createElement('span'), {className: 'account-avatar', textContent: initials(user.email)});
    avatar.setAttribute('aria-hidden', 'true');
    const email = Object.assign(document.createElement('strong'), {textContent: user.email});
    const sync = Object.assign(document.createElement('span'), {className: 'account-sync'});
    sync.append(document.createElement('i'), 'Synced');
    const text = document.createElement('span');
    text.append(email, sync);
    identity.append(avatar, text);

    const synced = Object.assign(document.createElement('p'), {className: 'host-help',
      textContent: 'Presets, NAM and IR favorites and amp preferences are saved to your account and follow you on every device.'});
    const error = Object.assign(document.createElement('p'), {className: 'host-help error'});
    error.setAttribute('role', 'alert');
    const close = button('Close');
    close.onclick = () => dialog.close();
    const signOut = button('Sign out', {primary: true});
    signOut.onclick = async () => {
      signOut.disabled = true; error.textContent = '';
      // Closed by the account "change" listener once signed out.
      try { await this.signOut(); } catch (failure) { error.textContent = failure.message; signOut.disabled = false; }
    };
    body.append(identity, synced, error, actionsRow(close, signOut));
    dialog.showModal();
    close.focus();
  }

  openSignIn() {
    const {dialog, body, id} = createDialog({title: 'Sign in or create an account', eyebrow: 'Account', className: 'sign-in-dialog'});
    this.signInDialog = dialog;
    dialog.addEventListener('close', () => { if (this.signInDialog === dialog) this.signInDialog = null; this.restoreFocus(); }, {once: true});
    const message = document.createElement('p');
    message.className = 'host-help';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    const error = document.createElement('p');
    error.className = 'host-help error';
    error.setAttribute('role', 'alert');

    const field = (label, input) => {
      const element = document.createElement('label');
      element.htmlFor = input.id;
      element.textContent = label;
      return [element, input];
    };
    const cancel = () => { const close = button('Cancel'); close.onclick = () => dialog.close(); return close; };

    const emailForm = document.createElement('form');
    const email = Object.assign(document.createElement('input'), {id: `${id}-email`, type: 'email', required: true, autocomplete: 'email', maxLength: 254});
    const send = button('Send link', {type: 'submit', primary: true});
    emailForm.append(...field('Email', email), actionsRow(cancel(), send));

    // After sending, the dialog waits: the link opened in another tab signs
    // in over BroadcastChannel, and the 'change' listener closes it.
    const waiting = document.createElement('div');
    waiting.hidden = true;
    const back = button('Use another email');
    back.onclick = () => { waiting.hidden = true; emailForm.hidden = false; message.textContent = ''; error.textContent = ''; email.focus(); };
    waiting.append(actionsRow(back, cancel()));

    emailForm.onsubmit = async (event) => {
      event.preventDefault();
      send.disabled = true; error.textContent = '';
      try {
        const result = await this.api.requestSignIn(email.value.trim());
        message.textContent = `${result.message} Open it on this computer: this window closes once you are signed in.`;
        emailForm.hidden = true; waiting.hidden = false; back.focus();
      } catch (failure) { error.textContent = failure.message; }
      finally { send.disabled = false; }
    };

    const intro = document.createElement('p');
    intro.className = 'host-help';
    intro.textContent = 'No password: we email you a sign-in link. New addresses get an account automatically.';
    body.append(intro, emailForm, waiting, message, error);
    dialog.showModal();
    email.focus();
  }

  // The rack itself reports the sign-out (index.js resets it to the guest state).
  async signOut() {
    await this.api.signOut();
    this.account.setUser(null, {announce: true});
  }
}
