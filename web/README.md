# NAM A2 WAM — Rails app (accounts)

Rails 8 + SQLite monolith that serves the rack on a single origin and adds
passwordless accounts: sign in with an emailed link, then
keep presets (the full WAM chain), NAM/IR favorites and preferences on every
device. Visitors who do not sign in keep using the rack exactly as before,
with their data in the browser.

## How it fits together

| Path | Served by | Notes |
| --- | --- | --- |
| `/rack/` (and `/rack/index.html`) | `RackController#show` | Port of `examples/wam/index.html` with `csrf_meta_tags` and the current user as JSON (`#currentUser`). `/` and `/rack` redirect here. |
| `/rack/**` (JS, WASM, models, IRs) | `public/rack/`, static | Generated copy of `dist/NAM_A2_WAM/` without `index.html`. No Propshaft, no importmap: relative imports and `new URL('./x.wasm', import.meta.url)` keep working. |
| `/sign_in…`, `/session` | `SignInsController`, `SessionsController` | Magic link, sign-out. |
| `/api/me`, `/api/presets`, `/api/favorites`, `/api/preferences`, `/api/import` | JSON controllers | Session cookie + `X-CSRF-Token`. Every query is scoped to the current user. |

The rack's account code lives in [`../examples/wam/account/`](../examples/wam/account/)
(`api.js`, account block, presets, favorites sync, guest import). It only
enables itself when the page carries a CSRF meta tag, so the static
distribution and `npm start` are unchanged.

## Requirements

- Ruby 4.0.1 (see `.ruby-version`), Bundler, SQLite 3.
- Node.js, CMake and Emscripten for the rack itself (see the root README):
  `public/rack/` is built from `examples/wam/` and `src/`.
- Chrome for the system tests (Selenium Manager downloads chromedriver).

## Install and run locally

```sh
# From the repository root: third-party checkouts + WASM build (once)
npm run setup

cd web
bin/setup --skip-server   # gems + databases
bin/rack-sync             # copies the rack into public/rack (see "Syncing the rack" below)
bin/rails server          # http://localhost:3000/rack/
```

In development, sign-in emails are opened by
[letter_opener](https://github.com/ryanb/letter_opener) (files under
`tmp/letter_opener/`) and jobs run in-process.

## Syncing the rack into `public/rack` (`bin/rack-sync`)

Rails does not serve the rack sources directly. `public/rack/` is a
**generated copy** of the static distribution; the sources stay in
[`../examples/wam/`](../examples/wam/) and [`../src/`](../src/). Never edit
files under `public/rack/`: the next sync overwrites them.

```sh
bin/rack-sync            # fast: rebuild dist/NAM_A2_WAM from sources, copy it to public/rack
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
   the page itself is rendered by `RackController#show`
   (`app/views/rack/show.html.erb`).

When to run it:

| You changed… | Run |
| --- | --- |
| `examples/wam/**` or `src/**` (JS, CSS, manifests) | `bin/rack-sync`, then reload the page |
| C++ in `src/nam-wasm/`, or Factory models/IRs | `bin/rack-sync --full` |
| `examples/wam/index.html` | port the change to `app/views/rack/show.html.erb` (`test/integration/rack_markup_test.rb` checks that every id still exists), then `bin/rack-sync` |
| Only Rails code (`app/`, `config/`) | nothing |

Notes:

- `public/rack/` is ignored by Git (`web/.gitignore`) and takes about 200 MB
  (models and IRs), plus the same again in `../dist/`.
- The server does not need a restart; in development the files are sent
  with `Cache-Control: no-cache`, so a reload picks up the new copy.
- Tests that need the rack tree (WASM MIME type, system tests) skip with a
  hint when `public/rack/` has not been synced.
- The Docker image copies `public/rack/` as it is on disk: sync before
  building (the Dockerfile fails fast when it is missing).

## Tests

```sh
bin/rails test          # models, auth flow, API scoping, isolation headers
bin/rails test:system   # headless Chrome: crossOriginIsolated, WAM startup,
                        # sign-in by link, preset save/alter/restore, cross-tab sign-in
```

Tests that need the real rack tree skip with a hint when `public/rack/` has
not been synced. The JavaScript modules are covered by `npm test` at the
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
