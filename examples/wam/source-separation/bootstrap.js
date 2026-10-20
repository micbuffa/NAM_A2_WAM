// Classic script on purpose: module scripts cannot even start under file://
// in browsers such as Chromium, so this diagnostic must run before imports.
(() => {
  const notice = document.getElementById('runtimeNotice');
  if (location.protocol === 'file:') {
    notice.hidden = false;
    for (const section of document.querySelectorAll('main > section')) section.hidden = true;
    return;
  }
  for (const source of ['../ui/index.js', './main.js']) {
    const script = document.createElement('script');
    script.type = 'module'; script.src = source;
    script.onerror = () => {
      const error = document.getElementById('startupError');
      error.hidden = false;
      error.textContent = 'Impossible de charger l’application. Rechargez la page via le serveur HTTP et vérifiez que tous les fichiers de la distribution sont présents.';
    };
    document.body.append(script);
  }
})();
