# Modern Metal Machine

Upload this entire folder to a static HTTP(S) server. The WAM v2 entry URI is the URL of index.js. All runtime modules, fonts, images and impulses are inside this folder. Preserve its directory structure. No npm install or build is needed on the server.

For a host on another origin, configure CORS for the plugin files (Access-Control-Allow-Origin), and serve JavaScript with a JavaScript MIME type. Use HTTPS or localhost for AudioWorklet. The host must initialize the WAM environment before calling createInstance(groupId, audioContext).

Shared runtime sources are duplicated deliberately for independent deployment. See SOURCE_MANIFEST.json for imported source hashes.
