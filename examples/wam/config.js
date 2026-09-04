// Public runtime configuration for the example host.
// The same file works on localhost and on the Mainline deployment: the OAuth
// redirect is derived from the actual page URL, so index.html does not need
// to be edited when switching environments.
const pageUrl = new URL('./index.html', window.location.href);
pageUrl.search = '';
pageUrl.hash = '';

window.NAM_A2_WAM_CONFIG = {
  tone3000: {
    clientId: 't3k_pub_pWW-S9JqVvqbsnhKVpN08ekCgaLpWPY4',
    redirectUri: pageUrl.href,
  },
};
