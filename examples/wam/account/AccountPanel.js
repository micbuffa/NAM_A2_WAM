import {actionsRow, button, createDialog} from './dialogs.js';

// Topbar account control (#accountPanel): "Sign in" for guests, an avatar
// chip once signed in, and the Account section of the settings dialog
// (identity, what is synced, import of this browser's guest data, sign out),
// which the chip opens. Sign-in and sign-up are one flow: email -> link by
// mail. The link, opened on this computer, signs in another tab which
// notifies this one via BroadcastChannel.
export const initials = (email = '') => {
  const words = email.split('@')[0].split(/[._+-]+/u).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
};

const SYNCED = [['Presets', 'Every rack you save, with both chains and their pedals.'],
  ['Favorites', 'NAM models and impulse responses marked with a star.'],
  ['Amp preferences', 'A2 rendering mode and automatic level.']];

const element = (tag, className = '', text = '') => Object.assign(document.createElement(tag), {className, textContent: text});

// {favorites, preferences} from LocalDataImport -> one sentence.
export function importSummary(result) {
  if (!result) return '';
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const parts = [result.favorites && plural(result.favorites, 'favorite'), result.preferences && 'your amp preferences'].filter(Boolean);
  return parts.length ? `Imported ${parts.join(', ')}.` : 'This browser has no guest data to import.';
}

export default class AccountPanel {
  // importLocalData({force}) resolves with LocalDataImport#offer's result.
  constructor({account, settings, importLocalData = async () => null, root = document}) {
    this.account = account;
    this.api = account.api;
    this.settings = settings;
    this.importLocalData = importLocalData;
    this.$ = (id) => root.getElementById(id);
    this.panel = this.$('accountPanel');
  }

  attach() {
    this.panel.hidden = false;
    this.$('accountSignIn').onclick = () => this.openSignIn();
    this.$('accountChip').onclick = () => this.settings.open('account');
    this.settings.addSection({id: 'account', label: 'Account', icon: 'user', order: 3, render: (container) => this.renderSection(container)});
    this.account.addEventListener('change', () => {
      this.render();
      if (this.account.signedIn) this.signInDialog?.close();
      this.settings.refresh('account');
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

  // After the sign-in dialog closes, focus the visible topbar control, unless
  // the settings dialog is still open underneath.
  restoreFocus() {
    if (document.querySelector('dialog[open]')) return;
    this.$(this.account.signedIn ? 'accountChip' : 'accountSignIn').focus();
  }

  renderSection(container) {
    const user = this.account.user;
    const heading = element('h3', '', 'Account');
    const intro = element('p', 'host-help', user
      ? 'Your rack follows you: what is listed below is saved to your account and available on every device.'
      : 'Sign in to keep presets, favorites and preferences on every device. No password: we email you a link.');

    const identity = element('div', 'account-identity');
    const avatar = element('span', 'account-avatar', user ? initials(user.email) : '');
    avatar.setAttribute('aria-hidden', 'true');
    if (!user) {
      const icon = document.createElement('tl-icon');
      icon.setAttribute('name', 'user');
      avatar.append(icon);
    }
    const text = document.createElement('span');
    const sync = element('span', `account-sync${user ? '' : ' local'}`);
    sync.append(document.createElement('i'), user ? 'Synced' : 'Stored in this browser only');
    text.append(element('strong', '', user ? user.email : 'Guest'), sync);
    const error = element('p', 'host-help error');
    error.setAttribute('role', 'alert');
    const action = document.createElement('tl-button');
    action.setAttribute('size', 'sm');
    if (user) {
      action.textContent = 'Sign out';
      action.onclick = async () => {
        action.disabled = true; error.textContent = '';
        try { await this.signOut(); } catch (failure) { error.textContent = failure.message; action.disabled = false; }
      };
    } else {
      action.textContent = 'Sign in';
      action.setAttribute('variant', 'primary');
      action.setAttribute('icon', 'user');
      action.onclick = () => this.openSignIn();
    }
    identity.append(avatar, text, action);
    container.append(heading, intro, identity, error);
    if (!user) return;

    const list = element('ul', 'account-synced');
    list.setAttribute('aria-label', 'Saved to your account');
    list.append(...SYNCED.map(([title, detail]) => {
      const item = document.createElement('li');
      item.append(element('strong', '', title), element('span', '', detail));
      return item;
    }));

    const browser = element('div', 'account-browser-data');
    const browserText = document.createElement('div');
    browserText.append(element('strong', '', 'This browser’s data'),
      element('span', '', 'Copy the favorites and preferences saved here before you signed in. Local copies are kept.'));
    const importButton = document.createElement('tl-button');
    importButton.setAttribute('size', 'sm');
    importButton.setAttribute('icon', 'copy');
    importButton.textContent = 'Import…';
    const status = element('p', 'host-help');
    status.setAttribute('role', 'status');
    importButton.onclick = async () => {
      importButton.disabled = true; status.textContent = ''; status.classList.remove('error');
      try { status.textContent = importSummary(await this.importLocalData({force: true})); }
      catch (failure) { status.textContent = `Import failed: ${failure.message}`; status.classList.add('error'); }
      finally { importButton.disabled = false; }
    };
    browser.append(browserText, importButton);
    container.append(element('h4', 'settings-subheading', 'Saved to your account'), list, browser, status);
  }

  // reason: why the rack asks (e.g. saving a preset), shown above the form.
  // Resolves when the dialog closes: true once signed in, false if cancelled.
  openSignIn({reason = ''} = {}) {
    const {dialog, body, id} = createDialog({title: 'Sign in or create an account', eyebrow: 'Account', className: 'sign-in-dialog'});
    this.signInDialog = dialog;
    const closed = new Promise((resolve) => dialog.addEventListener('close', () => {
      if (this.signInDialog === dialog) this.signInDialog = null;
      this.restoreFocus();
      resolve(this.account.signedIn);
    }, {once: true}));
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
    intro.textContent = `${reason ? `${reason} ` : ''}No password: we email you a sign-in link. New addresses get an account automatically.`;
    body.append(intro, emailForm, waiting, message, error);
    dialog.showModal();
    email.focus();
    return closed;
  }

  // The rack itself reports the sign-out (index.js resets it to the guest state).
  async signOut() {
    await this.api.signOut();
    this.account.setUser(null, {announce: true});
  }
}
