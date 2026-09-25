import {actionsRow, button, confirmDialog, createDialog} from './dialogs.js';

// Sidebar account block (#accountPanel) and the sign-in dialog. Sign-in and
// sign-up are one flow: email -> link + 6-digit code by mail. The code can be
// typed here (mail read on a phone); the link, opened on this computer,
// signs in another tab which notifies this one via BroadcastChannel.
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
    this.$('accountSignOut').onclick = () => this.signOut();
    this.$('accountSignOutOthers').onclick = () => this.signOutOthers();
    this.account.addEventListener('change', () => { this.render(); if (this.account.signedIn) this.signInDialog?.close(); });
    this.render();
  }

  status(text, error = false) {
    const element = this.$('accountStatus');
    element.textContent = text;
    element.classList.toggle('error', error);
  }

  render() {
    const user = this.account.user;
    this.$('accountSignedOut').hidden = Boolean(user);
    this.$('accountSignedIn').hidden = !user;
    this.$('accountEmail').textContent = user?.email || '';
    this.status(user ? 'Presets, favorites and preferences are saved to your account.' : '');
  }

  openSignIn() {
    const {dialog, body, id} = createDialog({title: 'Sign in or create an account', className: 'sign-in-dialog'});
    this.signInDialog = dialog;
    dialog.addEventListener('close', () => { if (this.signInDialog === dialog) this.signInDialog = null; this.$(this.account.signedIn ? 'accountSignOut' : 'accountSignIn').focus(); }, {once: true});
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
    const send = button('Send link and code', {type: 'submit', primary: true});
    emailForm.append(...field('Email', email), actionsRow(cancel(), send));

    const codeForm = document.createElement('form');
    codeForm.hidden = true;
    const code = Object.assign(document.createElement('input'), {id: `${id}-code`, required: true, inputMode: 'numeric',
      autocomplete: 'one-time-code', pattern: '[0-9 ]{6,7}', maxLength: 7});
    const verify = button('Sign in', {type: 'submit', primary: true});
    const back = button('Use another email');
    back.onclick = () => { codeForm.hidden = true; emailForm.hidden = false; message.textContent = ''; error.textContent = ''; email.focus(); };
    codeForm.append(...field('6-digit code', code), actionsRow(back, verify));

    emailForm.onsubmit = async (event) => {
      event.preventDefault();
      send.disabled = true; error.textContent = '';
      try {
        const result = await this.api.requestSignIn(email.value.trim());
        message.textContent = `${result.message} Type the code below, or open the link on this computer.`;
        emailForm.hidden = true; codeForm.hidden = false; code.value = ''; code.focus();
      } catch (failure) { error.textContent = failure.message; }
      finally { send.disabled = false; }
    };
    codeForm.onsubmit = async (event) => {
      event.preventDefault();
      verify.disabled = true; error.textContent = '';
      try {
        const {user} = await this.api.verifyCode(email.value.trim(), code.value.replace(/\s/gu, ''));
        this.account.setUser(user, {announce: true});
        dialog.close();
      } catch (failure) { error.textContent = failure.message; code.select(); }
      finally { verify.disabled = false; }
    };

    const intro = document.createElement('p');
    intro.className = 'host-help';
    intro.textContent = 'No password: we email you a sign-in link and a 6-digit code. New addresses get an account automatically.';
    body.append(intro, emailForm, codeForm, message, error);
    dialog.showModal();
    email.focus();
  }

  async signOut() {
    try {
      await this.api.signOut();
      this.account.setUser(null, {announce: true});
      this.status('Signed out. Presets and favorites are now stored in this browser.');
    } catch (error) { this.status(error.message, true); }
  }

  async signOutOthers() {
    const confirmed = await confirmDialog({title: 'Sign out other devices',
      message: 'Every other browser signed in to this account will be signed out. This one stays signed in.',
      confirmLabel: 'Sign out others'});
    if (!confirmed) return;
    try {
      const {signedOut} = await this.api.signOutOthers();
      this.status(signedOut ? `Signed out ${signedOut} other device${signedOut === 1 ? '' : 's'}.` : 'No other device was signed in.');
    } catch (error) { this.status(error.message, true); }
  }
}
