import {actionsRow, button, createDialog} from './dialogs.js';

// Sidebar account block (#accountPanel) and the sign-in dialog. Sign-in and
// sign-up are one flow: email -> link by mail. The link, opened on this
// computer, signs in another tab which notifies this one via BroadcastChannel.
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

  async signOut() {
    try {
      await this.api.signOut();
      this.account.setUser(null, {announce: true});
      this.status('Signed out. Presets and favorites are now stored in this browser.');
    } catch (error) { this.status(error.message, true); }
  }
}
