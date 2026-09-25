# NAM A2 WAM — Rails app (accounts)

Rails 8 + SQLite monolith that serves the rack on a single origin and adds
passwordless accounts: sign in with an emailed link or 6-digit code, then
keep presets (the full WAM chain), NAM/IR favorites and preferences on every
device. Visitors who do not sign in keep using the rack exactly as before,
with their data in the browser.

## How it fits together

| Path | Served by | Notes |
| --- | --- | --- |
| `/rack/` (and `/rack/index.html`) | `RackController#show` | Port of `examples/wam/index.html` with `csrf_meta_tags` and the current user as JSON (`#currentUser`). `/` and `/rack` redirect here. |
| `/rack/**` (JS, WASM, models, IRs) | `public/rack/`, static | Generated copy of `dist/NAM_A2_WAM/` without `index.html`. No Propshaft, no importmap: relative imports and `new URL('./x.wasm', import.meta.url)` keep working. |
| `/sign_in…`, `/session`, `/sessions/others` | `SignInsController`, `SessionsController` | Magic link + code, sign-out, sign-out of other devices. |
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
bin/rack-sync             # dist/NAM_A2_WAM -> public/rack (rerun after editing examples/wam or src)
bin/rails server          # http://localhost:3000/rack/
```

`bin/rack-sync --full` (or `RACK_FULL=1 bin/rails rack:sync`) also regenerates
the Factory manifests and rebuilds the WASM before copying.

In development, sign-in emails are opened by
[letter_opener](https://github.com/ryanb/letter_opener) (files under
`tmp/letter_opener/`) and jobs run in-process.

## Tests

```sh
bin/rails test          # models, auth flow, API scoping, isolation headers
bin/rails test:system   # headless Chrome: crossOriginIsolated, WAM startup,
                        # sign-in by code, preset save/alter/restore, cross-tab sign-in
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
- `sign_in_tokens` stores an HMAC of a random token and of a 6-digit code
  (key derived from `secret_key_base`), valid 15 minutes, single use; each new
  request revokes the previous ones for the address; a code dies after 5 wrong
  attempts.
- The emailed link (`GET /sign_in/confirm?token=…`, filtered from logs) only
  shows a confirmation button; the `POST` consumes the token, so mail scanners
  that prefetch links cannot burn it. The code can be typed in the rack's
  dialog, e.g. when the mail is read on a phone.
- Rate limits (Rails 8 `rate_limit`, Solid Cache in production): 5 link
  requests per email per 15 min, 20 per IP per hour; 10 code attempts per
  email per 15 min, 30 per IP per hour.
- Sessions are `Session` rows (user agent, IP, `last_seen_at`) behind a signed,
  httpOnly, `SameSite=Lax`, `Secure` (production), 20-year cookie. Sign-out
  destroys the row; "Sign out other devices" destroys the others.
- After a sign-in in another tab, the confirmation page posts on the
  `nam-a2-wam.account` BroadcastChannel and the rack updates without reloading.

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

Mail jobs carry the plaintext token and code: they are delivered by
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
