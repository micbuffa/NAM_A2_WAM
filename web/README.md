# NAM A2 WAM — Rails app (accounts)

Rails 8 + SQLite monolith that serves the rack on a single origin and adds
passwordless accounts: sign in with an emailed link, then
keep presets (the full WAM chain), NAM/IR favorites and preferences on every
device. Visitors who do not sign in can play with the whole rack and load
Factory presets, but saving a preset needs an account: Save and New preset
open the sign-in dialog, then save the sound on screen. Unsaved changes are
kept as a draft in the browser (one per account, plus one for guests), so a
reload does not lose them. Guest favorites and preferences stay in the
browser until imported after sign-in; presets are no longer stored there
(the rack deletes the old `nam-a2-wam-presets` database).

## How it fits together

| Path | Served by | Notes |
| --- | --- | --- |
| `/rack/` (and `/rack/index.html`) | `RackController#show` | Port of `examples/wam/index.html` with `csrf_meta_tags` and the current user as JSON (`#currentUser`). `/` and `/rack` redirect here. |
| `/rack/**`, `/src/**`, `/third_party/**`, `/build-wasm/**` (development, test) | `DevSources` middleware (`lib/dev_sources.rb`) | The sources themselves: `examples/wam/`, `src/`, `third_party/`, `build-wasm/`. The rack's `../../src/…` imports resolve from the URL root, so nothing is rewritten. Also answers `/api/test-audio-files`. |
| `/rack/**` (production image) | `public/rack/`, static | Generated copy of `dist/NAM_A2_WAM/` without `index.html` (`bin/rack-sync`). No Propshaft, no importmap: relative imports and `new URL('./x.wasm', import.meta.url)` keep working. |
| `/sign_in…`, `/session` | `SignInsController`, `SessionsController` | Magic link, sign-out. |
| `/api/me`, `/api/presets`, `/api/favorites`, `/api/preferences`, `/api/import` | JSON controllers | Session cookie + `X-CSRF-Token`. Every query is scoped to the current user. |

The rack's account code lives in [`../examples/wam/account/`](../examples/wam/account/)
(`api.js`, account block, presets, drafts, favorites sync, guest import). It only
enables itself when the page carries a CSRF meta tag, so the static
distribution and `npm start` are unchanged.

## Requirements

- Ruby 4.0.1 (see `.ruby-version`), Bundler, SQLite 3.
- Node.js, CMake and Emscripten for the rack itself (see the root README):
  the WASM engine is built into `../build-wasm/`.
- Chrome for the system tests (Selenium Manager downloads chromedriver).

## Install and run locally

```sh
# From the repository root: third-party checkouts + WASM build (once)
npm run setup

cd web
bin/setup --skip-server   # gems + databases
bin/rails server          # http://localhost:3000/rack/
```

Edit `../examples/wam/` or `../src/` and reload the page: development serves
the sources directly and builds the page from `../examples/wam/index.html` on
every request. No copy, no restart. Only C++ changes need a WASM rebuild
(`cmake --build ../build-wasm`).

In development, sign-in emails are opened by
[letter_opener](https://github.com/ryanb/letter_opener) (files under
`tmp/letter_opener/`) and jobs run in-process.

## Building the rack for a production image (`bin/rack-sync`)

Development and test never need it. A production image only contains `web/`,
so the rack must be copied into it before `docker build` / `kamal deploy`:

```sh
bin/rack-sync            # rebuild dist/NAM_A2_WAM from sources, copy it to public/rack
bin/rack-sync --full     # also regenerate the Factory manifests and rebuild the WASM
bin/rails rack:sync      # same as bin/rack-sync (RACK_FULL=1 for --full)
```

What it does:

1. Runs `node ../tools/build-static-dist.mjs --no-regenerate --no-build`,
   which assembles `../dist/NAM_A2_WAM/` and rewrites the imports that leave
   the served tree (`'../../src/nam-wam/index.js'` becomes
   `'./plugins/nam-wam/index.js'`, `nam-simd.wasm` is copied next to each
   plugin, the audio catalogue comes from `assets/audio/audioFiles.json`).
2. `rsync --delete`s that tree into `public/rack/`, **without `index.html`**:
   the page itself is rendered by `RackController#show`.
3. Writes `app/views/rack/show.html.erb` from `../examples/wam/index.html`
   (`lib/rack_view.rb`), adding only what Rails needs: the CSRF meta tags, the
   favicon and the `currentUser` JSON payload. Development and test render the
   same `RackView.generate` on the fly instead.

Both outputs are ignored by Git (`web/.gitignore`); never edit them. The
Dockerfile fails fast when they are missing. When Kamal is set up, run
`web/bin/rack-sync` from a `.kamal/hooks/pre-build` hook so every deploy ships
the rack of the deployed commit.

## Tests

```sh
bin/rails test          # models, auth flow, API scoping, isolation headers
bin/rails test:system   # headless Chrome: crossOriginIsolated, WAM startup,
                        # sign-in by link, preset save/alter/restore, cross-tab sign-in,
                        # sign-in to save as a guest, draft restore after a reload
```

Tests serve the rack from the sources, like development. Tests that need the
WASM engine skip with a hint when `../build-wasm/dist/nam-simd.wasm` has not
been built (`npm run setup`). The JavaScript modules are covered by `npm test` at the
repository root (`tests/phase5/`).

## Cross-origin isolation (required)

The WAM SDK uses `SharedArrayBuffer`, which browsers only expose on
cross-origin isolated pages. Every response — the Rails page **and** every
static file under `public/` — must carry:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

and `.wasm` files must be sent as `application/wasm`. The app does this itself
(`Web::CROSS_ORIGIN_ISOLATION_HEADERS` in `config/application.rb`, applied to
`action_dispatch.default_headers` and `public_file_server.headers` in every
environment). If a reverse proxy or CDN serves `public/` directly instead of
Puma/Thruster, configure the same headers there, e.g. with nginx:

```nginx
location /rack/ {
  add_header Cross-Origin-Opener-Policy same-origin always;
  add_header Cross-Origin-Embedder-Policy require-corp always;
  add_header Cross-Origin-Resource-Policy same-origin always;
  add_header Cache-Control "public, no-cache" always;
  types { application/wasm wasm; }
}
```

Rack assets have no digests, so they are sent with `Cache-Control: public,
no-cache` (cheap 304 revalidation; a deploy never mixes old and new modules).

Under `require-corp`, any cross-origin subresource needs CORS or CORP: the
TONE3000 artwork is loaded with `crossorigin="anonymous"`; keep doing so for
any new third-party image. Check with `window.crossOriginIsolated === true` in
the console, or run `bin/rails test:system`.

### TONE3000 OAuth

The TONE3000 client stays public and browser-side. Under COOP `same-origin` the
TONE3000 popup loses its `window.opener`; the callback page relays the result
through `BroadcastChannel` and a `localStorage` event, as it already did for
`noopener` pickers. Register the redirect URI of each environment in the
TONE3000 application settings:

```text
http://localhost:3000/rack/index.html
https://<APP_HOST>/rack/index.html
```

## Authentication

- One email form for sign-in and sign-up; the account is created on the first
  successful sign-in. The response is identical whether the address exists.
- `sign_in_tokens` stores an HMAC of a random token (key derived from
  `secret_key_base`), valid 15 minutes, single use; each new request revokes
  the previous ones for the address.
- The emailed link (`GET /sign_in/confirm?token=…`, filtered from logs) only
  shows a confirmation button; the `POST` consumes the token, so mail scanners
  that prefetch links cannot burn it. We assume the mail is read on the
  computer running the rack: the link signs in that browser only.
- Rate limits (Rails 8 `rate_limit`, Solid Cache in production): 5 link
  requests per email per 15 min, 20 per IP per hour.
- Sessions are `Session` rows (user agent, IP, `last_seen_at`) behind a signed,
  httpOnly, `SameSite=Lax`, `Secure` (production), 20-year cookie. Sign-out
  destroys the row. A session unused for 90 days is dropped on its next
  request and by a daily job (`config/recurring.yml`).
- The confirmation page confirms with `fetch` (the tab keeps a one-entry
  history, so it may close itself), then posts `signed-in` on the
  `nam-a2-wam.account` BroadcastChannel. An open rack refreshes its account
  without reloading and answers `rack-open`, and the sign-in tab closes; with
  no rack open, the tab goes to `/rack/`. A tab with other history cannot
  close itself (letter_opener in development opens the link in place): it
  then says the rack is signed in. A used link reopened while signed in
  redirects to `/rack/`.

## Environment variables (production)

| Variable | Purpose |
| --- | --- |
| `RAILS_MASTER_KEY` or `SECRET_KEY_BASE` | Signs cookies and keys the token digests. Rotating it signs everyone out and voids pending links. |
| `APP_HOST` | Public host name, used in email links and as the allowed `Host`. |
| `MAIL_FROM` | Sender, e.g. `NAM A2 WAM <no-reply@rack.example.com>`. |
| `SMTP_ADDRESS`, `SMTP_PORT` | SMTP relay (defaults: `localhost`, `587`, STARTTLS). |
| `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_AUTHENTICATION` | Relay credentials (`plain` by default; omitted when no username). |
| `SOLID_QUEUE_IN_PUMA` | Run the job worker (mail delivery) inside Puma. |
| `ASSUME_SSL`, `FORCE_SSL` | Default `true` (TLS terminated by kamal-proxy/Thruster/your proxy). |
| `LITESTREAM_REPLICA_BUCKET` | Enables continuous backups (see below). |
| `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | Bucket credentials. |
| `LITESTREAM_REPLICA_ENDPOINT`, `LITESTREAM_REPLICA_REGION` | For non-AWS S3-compatible storage. |

SMTP values for the two tested relays:

| Relay | `SMTP_ADDRESS` | `SMTP_PORT` | `SMTP_USERNAME` | `SMTP_PASSWORD` |
| --- | --- | --- | --- | --- |
| Brevo | `smtp-relay.brevo.com` | `587` | your Brevo SMTP login | an SMTP key |
| Postmark | `smtp.postmarkapp.com` | `587` | the server API token | the same server API token |

Mail jobs carry the plaintext token: they are delivered by
`SensitiveMailDeliveryJob`, which does not log its arguments, and finished
jobs are not kept (`solid_queue.preserve_finished_jobs = false`). A failed job
stays in `solid_queue_failed_executions` until discarded; its token has
expired after 15 minutes anyway.

## Deployment

SQLite holds everything in production (`config/database.yml`): the app
(`storage/production.sqlite3`), Solid Queue (`production_queue.sqlite3`) and
Solid Cache (`production_cache.sqlite3`). `storage/` **must be a persistent
volume** (`/rails/storage` in the container); a single server runs web and jobs.

With Kamal (`config/deploy.yml`, already set up with the `web_storage`
volume, the proxy and the variables above):

```sh
npm run setup && web/bin/rack-sync       # public/rack must exist before the image is built
cd web
export SMTP_USERNAME=… SMTP_PASSWORD=… LITESTREAM_ACCESS_KEY_ID=… LITESTREAM_SECRET_ACCESS_KEY=…
bin/kamal setup    # first time; then bin/kamal deploy
```

The build uses the working directory as context (`builder.context: .`)
because `public/rack/` is generated and not in Git; the Dockerfile refuses
to build without it. With plain Docker: `docker build -t nam-rack web` then
run with `-v nam_storage:/rails/storage -p 80:80` and the variables above.

## Backups with Litestream

[Litestream](https://litestream.io) streams SQLite WAL changes to
S3-compatible storage continuously. The `litestream` gem ships the binary
and a Puma plugin (`config/puma.rb`), enabled only when
`LITESTREAM_REPLICA_BUCKET` is set; `config/litestream.yml` replicates the
application and queue databases (the cache is disposable).

```sh
bin/rails litestream:databases         # replication status
bin/rails litestream:generations -- -database=storage/production.sqlite3
```

Restore onto an empty volume, before starting the app:

```sh
bin/rails litestream:restore -- -database=storage/production.sqlite3
bin/rails litestream:restore -- -database=storage/production_queue.sqlite3
```

Test a restore regularly on a scratch machine; a replica you never restored
is not a backup.

## Studio audio imports (26 October 2026)

The Rails rack is at `/rack/`. Studio **Import audio** offers a local file or a
YouTube video. Tone's expanded Play along player also has **Separate instruments**:
this creates a Studio original from the selected backing. An authorized saved
mix reuses its existing blob; bundled audio is resolved from the server manifest,
never from an arbitrary browser URL. Local files are uploaded once. This action
opens Studio; model selection and calculation remain explicit.

YouTube import is a Rails ActiveJob, not a browser proxy. The production Dockerfile
now installs FFmpeg, Python venv, Node 24 and `yt-dlp[default]==2026.10.21` in
`/opt/youtube`. It enables Solid Queue in Puma (`SOLID_QUEUE_IN_PUMA=true`).
Rebuild/redeploy the image after `bin/rack-sync`; `bin/rails db:prepare` must run
before serving the new release. Keep `/rails/storage` persistent (audio **and**
application/queue databases). If jobs run in a separate service, give that service
the same storage and dependencies, and run `bin/jobs` instead of a second embedded
supervisor. Do not run both workers unintentionally.

For an existing development container, install dependencies explicitly (the current
`nam-rails-main` already has them):

```sh
apt-get update && apt-get install -y python3-venv ffmpeg
python3 -m venv /opt/youtube
/opt/youtube/bin/pip install 'yt-dlp[default]==2026.10.21'
# Node 24 must also be installed / on PATH.
bin/rails db:prepare
```

Optional `YT_DLP_PATH` overrides the executable. `/api/audio_imports/capabilities`
reports availability to signed-in users. A static dist alone cannot import YouTube.
The development adapter is async: jobs survive page closure, but not a server
restart; stale jobs become errors after 20 minutes. Production Solid Queue persists
queued work. Running download processes interrupted by a crash are not transparently
resumable: retry a failed job. Temporary directories are cleaned on normal completion,
error and cancellation; an OS kill may leave temporary files for operational cleanup.

Limits: single HTTPS YouTube video, non-live, ≤30 min, ≤100 MiB MP3; one active job
per account, three admitted globally on the current SQLite deployment. Download
subprocesses have deadlines, bounded output/disk usage and process-group cancellation.
Account quota is checked before publication. Progress and cancel are private to the
initiator; ready audio becomes a normal private Studio project with source URL,
video ID, title, duration and import time. Reopening Import audio reconnects to the
latest job; terminal jobs are not polled. No cookies, browser credentials, arbitrary
URLs, external proxy service or CAPTCHA bypass are used. YouTube changes may require
a reviewed yt-dlp update; unavailable/restricted videos return an error.

WebNN stays under **Change model / settings**: CPU/GPU/NPU preferences, Demucs4 only,
isolated ORT1.30 Worker. Each audio block is compared with ORT1.30 WASM before
publication; this extra reference calculation is intentionally slower. Failed initial
admission falls back to production WASM; no backend switching after published audio.
The default remains WebGPU when available. Native WebNN qualification and hardware
performance measurements remain pending; an NPU preference is not proof of NPU use.
