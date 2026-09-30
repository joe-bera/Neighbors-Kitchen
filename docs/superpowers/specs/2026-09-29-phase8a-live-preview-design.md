# Phase 8a: Live preview at neighborskitchen.app (design)

Date: 2026-09-29. Approved in chat by the project owner (Master Joseph) the same day, section by section.
Phase 8 is split in two: 8a (this document, a show-and-tell preview on the internet) and 8b (the public launch, designed later, after payments).

## In plain words

- The app goes on the internet at **https://neighborskitchen.app** as a preview the owner can show to partners, chefs and investors. `www.neighborskitchen.app` forwards there.
- It runs on **Railway**, which the owner already uses. One service runs the whole app (web pages, API, background helper, a disk for uploaded photos), and a Railway Postgres database sits next to it. That's about $5-10 a month on Railway's Hobby plan, plus the domain (bought at Namecheap) and Resend for email (free plan).
- Every page shows a slim banner: "Preview: practice orders only. No food is made and no one is charged." Search engines are told not to list the site. Anyone with the link can look around and sign up.
- The sample chefs, meals, reviews and dish requests load automatically on the first start. On the live site the sample accounts use a private password the owner chooses. The public `Password123` only works on the owner's computer, and the demo login buttons do not appear.
- The sample meal photos are replaced with free-license stock photos that ship with the app. Today's photos are borrowed from TheMealDB, whose free use is for development only.
- Real emails go out through **Resend** from `Neighbors Kitchen <no-reply@neighborskitchen.app>`. Emails to the sample accounts' made-up `@neighborskitchen.test` addresses are never sent. Password-reset links carry their secret after a `#`.
- The preview updates itself when work is merged into `main` on GitHub. Work in progress on the work branch never touches it.
- Seven small problems a demo could run into are fixed (see "Leftovers fixed").
- Not in this phase: payments, legal pages, chef permit checks, database backups and the other public-launch items (see "Not in this phase").

## Decisions (owner, 2026-09-29)

| Question | Decision |
|---|---|
| Who is the first live version for? | A show-and-tell preview: sample data, clearly marked, no real orders or money, hidden from search engines, real emails |
| Web address | `neighborskitchen.app`, bought by the owner at Namecheap (where the owner's other domains are) |
| Hosting | Railway, Hobby plan: one app service, Railway Postgres, and a volume for uploaded photos |
| Email | Resend, free plan (100 a day, 3,000 a month), from `no-reply@neighborskitchen.app` |
| Site password | None: anyone with the link can look around and sign up |
| Sample photos | Replace the TheMealDB photos with free-license stock photos (Pexels or Unsplash license) stored in the repo |
| Pull request #2 (work branch into `main`) | Stays open, and is merged once 8a is built and tested. The merge starts the first Railway deploy |
| Vercel | Disconnect the old Vercel project from GitHub, and remove `vercel.json` and `netlify.toml` |
| Leftovers from earlier reviews | Fix the ones a demo could run into; the rest wait for 8b |

## How it runs

### Railway project `neighbors-kitchen`

- **Service `web`**
  - Built from the repo's `Dockerfile` on the `main` branch. Railway rebuilds on every push to `main`.
  - Settings live in `railway.json` (config as code):
    - builder `DOCKERFILE`
    - a pre-deploy command that applies migrations, then the preview sample data (see "Sample data")
    - health check `GET /health`, timeout 120 s
    - restart on failure, at most 5 retries
    - `drainingSeconds` 30, so a stopping version can finish what it is doing
- **Volume** mounted at `/data` on `web`
  - Uploaded meal photos go to `/data/uploads` (`UPLOAD_DIR`).
  - Because of the volume, Railway runs a single copy of the app, and each update pauses the site briefly (under a minute).
  - Hobby volumes hold up to 5 GB.
  - The container runs as root. Railway volumes are root-owned, and Railway's documented fix for non-root images (`RAILWAY_RUN_UID=0`) amounts to the same thing.
- **Postgres**: Railway's Postgres service in the same project. `web` reaches it over Railway's private network through `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
- **Domains** on `web`
  - `neighborskitchen.app` uses an ALIAS record at Namecheap, and `www.neighborskitchen.app` uses a CNAME. Each also needs Railway's TXT verification record.
  - Railway issues and renews the certificates. The Hobby plan allows exactly these two custom domains per service.
- PR environments stay off.

### Service variables (`web`)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8080`, set explicitly so the domains point at a known port (added while planning) |
| `PREVIEW_MODE` | `true` |
| `FRONTEND_URL` | `https://neighborskitchen.app` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | 64+ random characters, generated when the service is created and never shown in chat |
| `UPLOAD_DIR` | `/data/uploads` |
| `TRUST_PROXY_HOPS` | `1` |
| `EMAIL_TRANSPORT` | `resend` |
| `RESEND_API_KEY` | the key from Resend, typed into Railway by the owner |
| `EMAIL_FROM` | `Neighbors Kitchen <no-reply@neighborskitchen.app>` |
| `DEMO_PASSWORD` | chosen by the owner (at least 12 characters) and typed into Railway by the owner |

Everything else keeps its default (`GEOCODER=census`, `RATE_REMINDER_DELAY_MINUTES=120`, `JOBS_INTERVAL_MS=5000`, `PLATFORM_FEE_PERCENT=10`). Secrets live only in Railway, never in the repo or in chat.

### Packaging (`Dockerfile`, `.dockerignore`)

- **Base image:** multi-stage, `node:24-bookworm-slim`. That's Node 24, as on the development Mac, on Debian (for sharp, bcrypt and Prisma's engine), with `openssl` and `ca-certificates` installed.
- **Build stage**
  1. `npm ci` in the root, `backend` and `frontend`.
  2. `npm run build`: backend `prisma generate` + `tsc`, frontend `tsc -b` + `vite build`.
  3. Remove the backend's development-only packages.
- **Runtime stage** holds only:
  - `backend/package.json`
  - the pruned `backend/node_modules`, including the generated Prisma client
  - `backend/dist`
  - `backend/src`: the seed runs from TypeScript with tsx and imports these sources (found in the dress rehearsal)
  - `backend/prisma`: schema, migrations, seed and sample photos
  - `backend/data`: the ZIP code list, which `zipCodes.ts` finds relative to the compiled code
  - `frontend/dist`
  - Working directory `/app/backend`, `ENV NODE_ENV=production`, command `node dist/index.js`.
- **Production dependencies:** the Prisma CLI (for `migrate deploy`) and whatever runs the seed must be production dependencies. The embedded Postgres used for local development must not end up in the runtime image.
- **`.dockerignore`** keeps out `node_modules`, `dist`, `.env*` files (except the examples), `backend/uploads`, `.git`, `.superpowers`, `.claude`, `docs` and `AGENTS.md`.

### Deploy flow

1. A merge into `main` makes Railway build the image.
2. Pre-deploy runs in the new image before it takes any traffic: `prisma migrate deploy`, then the preview seed (`--preview-if-empty`, see "Sample data"). If either fails, the deploy stops and the running version stays.
3. Because of the photo volume, Railway first stops the old version (SIGTERM), then starts the new one and sends traffic once `/health` answers. If `/health` never answers, the deploy is marked failed and the site stays down until a rollback. (Corrected after the final review: a volume can only be attached to one version at a time.)

## Backend

### Settings (`config/env.ts`)

New settings:

- `PREVIEW_MODE`: boolean string, default `false`.
- `TRUST_PROXY_HOPS`: integer from 0 to 5, default `0`.
  - When above 0, the app calls `app.set('trust proxy', n)`. Rate limits and login lockout then count each visitor, not Railway's proxy.
  - The live check confirms the app sees public addresses. If Railway turns out to add two hops, the value becomes 2.
- `WEB_DIST_DIR`: the built website, default `path.resolve('../frontend/dist')`.
- `EMAIL_TRANSPORT` gains `resend`, with a new `RESEND_API_KEY` that is required when the transport is `resend`.
- `DEMO_PASSWORD`: optional; see "Sample data".

Production checks at start-up (`NODE_ENV=production`) stop the server with a clear message when:

- `FRONTEND_URL` is not `https`, unless it points at `localhost` or `127.0.0.1` (for the dress rehearsal);
- `EMAIL_TRANSPORT` is not `resend`, or `RESEND_API_KEY` is missing;
- `JWT_SECRET` is the example value from `.env.example`;
- `WEB_DIST_DIR` has no `index.html`.

### Serving the website (production only)

- **Files and caching:** in production, `createApp` also serves `WEB_DIST_DIR`.
  - `/assets/*` gets `Cache-Control: public, max-age=31536000, immutable`, because file names change with every build.
  - `index.html` gets `Cache-Control: no-cache`.
- **The React app handles every other page.** Any other `GET`/`HEAD` that is not under `/api`, `/uploads` or `/health` gets `index.html`, including the React app's own "not found" page. Unknown `/api/...` paths keep the JSON 404.
- **Preview mode:**
  - The served `index.html` gets `<meta name="nk-preview" content="true">` added to its `<head>`. The file is read once at start-up.
  - `/robots.txt` answers `User-agent: *` with `Disallow: /`.
  - Every response carries `X-Robots-Tag: noindex, nofollow`.
  - Outside preview mode, `/robots.txt` answers `User-agent: *` with `Allow: /`.
- **www:** a request whose host is `www.` plus the `FRONTEND_URL` host gets a 301 to the same path and query on `FRONTEND_URL`.
- **Development:** unchanged. Vite serves the website on port 3000 and forwards `/api` and `/uploads`.

### Security headers

- **Content-Security-Policy:** helmet sends it on every response.
  - `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: https://tile.openstreetmap.org`
  - `connect-src 'self'`, `font-src 'self'`, `object-src 'none'`
  - `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`
  - plus helmet's remaining defaults, such as `upgrade-insecure-requests`
  - Styles allow inline values for Leaflet and React style attributes; scripts stay strict.
  - The website loads nothing from other sites except the OpenStreetMap tiles. Once the sample photos move into the repo, TheMealDB is gone.
- **HSTS:** helmet's default stays. `.app` addresses are HTTPS-only in browsers anyway.
- **Referrer-Policy:** `strict-origin-when-cross-origin` instead of helmet's `no-referrer`, because OpenStreetMap's tile policy asks websites to send a Referer. Other sites only ever see `https://neighborskitchen.app`, never a page path. Reset tokens sit after `#`, which browsers never send. (Added while planning, 2026-09-29.)

### Real email (Resend)

- **The Resend transport:** `resendTransport(apiKey, fetchImpl = fetch)` in `services/notifications/mailer.ts`.
  - Sends `POST https://api.resend.com/emails` with `Authorization: Bearer <key>` and a JSON body `{ from, to, subject, html, text }`.
  - Adds `Idempotency-Key: <email id>`, so a retry of the same email within Resend's 24-hour window is never delivered twice. The retry schedule spans about 2.6 hours.
  - Gives each send a 10-second limit (an abort signal).
  - A non-2xx answer throws `Resend <status>: <Resend's error name or message>`. The error text never includes the address or the contents.
  - `keepsCopies: false`. `transportFromEnv()` returns this transport when `EMAIL_TRANSPORT=resend`.
- **Subjects:** CR, LF and other control characters are replaced with spaces before sending, for every transport.
- **Made-up addresses are skipped.** `deliverDueEmails` checks this when the transport is a real service (`keepsCopies` is false) and the recipient's domain is reserved:
  - which domains count: top-level `test`, `example`, `invalid` or `localhost`, or `example.com`, `example.net` or `example.org` and their subdomains;
  - such an email is not sent: its status becomes the new `EmailStatus` value `SKIPPED` (one migration) with `lastError` "Not sent: example address", and a password-reset email's link is erased just as after sending;
  - with the practice mailbox nothing changes, so sample emails still appear there.
- **Failure logging:** a failed send is logged as one line with the email id, kind and error, never the address or contents, so problems show in Railway's logs.

### Password reset link

- The email button becomes `/reset-password#token=<token>`. The part after `#` is never sent to a server, so the token stays out of server logs and Referer headers.
- `POST /api/v1/auth/reset-password` also clears the refresh cookie, as logout does.

### Stopping cleanly

- On SIGTERM or SIGINT, `index.ts` stops the background helper (it finishes its current pass) and stops accepting new connections.
- It then waits up to 25 seconds for open requests, disconnects Prisma and exits with code 0.

### Sample data (`prisma/seed.ts`)

- **Guard:** the seed refuses to run (exit code 1) when `NODE_ENV=production`, unless `PREVIEW_MODE=true` and `DEMO_PASSWORD` (at least 12 characters) is set. A real launch (8b) can never get demo accounts.
- **Passwords:** demo accounts use `DEMO_PASSWORD` when it is set, otherwise `Password123` (development).
- **`--preview-if-empty` option**
  - With `PREVIEW_MODE` off, it exits 0 without touching anything, so the same pre-deploy command is harmless on the real launch.
  - With `PREVIEW_MODE` on, it applies the guard above, then seeds only when no user with an `@neighborskitchen.test` address exists yet. A missing or short `DEMO_PASSWORD` fails the pre-deploy step, so a preview can never go up without it.
  - Railway's pre-deploy runs it on every deploy, so the preview gets sample data on its first start and keeps everything that happens afterwards.
  - To reset the samples, run the full seed by hand: `railway ssh`, then `npm run db:seed`.
- **Meal photos**
  - 35 free-license photos (Pexels or Unsplash license: business use allowed, no attribution required, no people in the pictures), resized to at most 1200 px and saved as WebP.
  - Stored as `backend/prisma/sample-photos/<uuid>.webp`. `CREDITS.md` in the same folder lists each file's dish, source page, photographer and license.
  - The app serves this folder at `/uploads/meals/`, checked after `UPLOAD_DIR`, so sample photos need no copying. Each sample meal's photo has a fixed UUID file name written in the seed, so its `imageUrl` (`/uploads/meals/<uuid>.webp`) passes `isUploadedMealPhotoUrl`, and a chef can keep the photo when editing the meal.
  - Local development uses the same photos, and TheMealDB is no longer used anywhere.

## Frontend

### Preview banner

- `PreviewBanner` is rendered in `App.tsx` above the routes, so the home page (which has its own layout) gets it too. It appears when `<meta name="nk-preview" content="true">` is in the page.
- Text: "Preview: practice orders only. No food is made and no one is charged."
- It sits at the top of the page, is not sticky, covers nothing, and is marked as a note for screen readers.
- Unchanged: the demo login buttons, the forgot-password page's mailbox hint and the practice mailbox page stay development-only (`import.meta.env.DEV`).

### Reset password page

- The page reads the token from the fragment (`#token=`), falling back to `?token=` for links sent before this change.
- It then removes the token from the address bar with `history.replaceState`.

### Leftovers fixed

1. **Bell count after signing out.**
   - The unread count resets to 0 whenever the signed-in account changes or signs out, whether through logout, a password reset or a failed session refresh.
   - A password reset also empties the cart, as logout does.
2. **Links keep their place through the login page.**
   - `ProtectedRoute` keeps the `#hash` in its `?redirect=`, so "Turn these emails off" (`/account#email-settings`) lands on the email settings after login.
   - The dish-requests sign-in link keeps `#requests-heading` too.
3. **Dish-request links.**
   - The chef's "new dish request" bell item and email button go to `/chef/feedback?view=requests`. Today they open the Reviews tab.
   - The email button that tells voters "the chef said yes" gets `#requests-heading`, like its bell item.
   - Bell items already saved keep their old link; re-seeding refreshes the demo ones.
4. **Scrolling to the dish requests.** A link to `#requests-heading` scrolls there once the requests have loaded, following `AccountPage`'s pattern. Today it tries before the page loads and stays at the top.
5. **Delivery distance menu.** When a kitchen's distance is not one of the choices (2, 5, 10, 15, 25), it is added as an extra choice ("Within 8 miles"), so the menu shows the real value. Four sample chefs use 7, 8 or 12 miles.
6. **"Use my location".**
   - A 15-second backup timer ends "Finding you..." with the usual error if the browser never answers, for example when the permission prompt is ignored.
   - Answers that arrive late are ignored, and nothing runs after the visitor leaves the page.
7. **Distance kept when changing place.** Choosing a new ZIP code or "Use my location" keeps the chosen distance, including "Any distance". 25 miles is only the default for the first search.

## Repository and docs

- Add `Dockerfile`, `.dockerignore` and `railway.json`.
- Remove `vercel.json` and `netlify.toml`.
- Rewrite `DEPLOYMENT.md` as the Railway runbook: how updates go live, where the logs are, how to reset the sample data, the variables, the costs and the 8b list.
- Update `README.md`: status table, live address, how the preview works.
- Update `CLAUDE.md`: new conventions (preview mode, website served by the API in production, the Resend transport, `SKIPPED`, sample photos, Docker/Railway).
- Update `backend/.env.example`: the new settings.

## Owner checklist

Done after the plan is approved; click-by-click steps come with the plan.

1. Buy `neighborskitchen.app` at Namecheap.
2. Sign up at Resend (free) and add the domain `neighborskitchen.app`. Resend lists the DNS records it needs.
3. In Namecheap's Advanced DNS, add Resend's records (the MX record for the `send` subdomain needs "Custom MX" mail settings). Then verify the domain in Resend and create an API key with sending access only.
4. Disconnect the old `neighbors-kitchen` Vercel project from GitHub, or allow Claude to do it through the Vercel connection.
5. Railway (Hobby plan): allow Claude to create the project with the Railway command-line tool (already signed in on the Mac), or click through the steps yourself. Type `DEMO_PASSWORD` and `RESEND_API_KEY` into Railway's Variables page yourself.
6. Approve merging pull request #2 into `main`. This starts the first deploy.
7. Add Railway's domain records at Namecheap: an ALIAS for the bare address, a CNAME for `www`, and two TXT records.
8. Do the live sign-in checks (see "Testing").

## Testing

Everything is built test-first, as in earlier phases, and expected values in tests are literals.

**Backend** (Vitest + Supertest):

- the production settings checks;
- website serving: asset caching, `index.html` no-cache, the fallback to `index.html`, the JSON 404 for unknown `/api` paths, `/uploads` not swallowed by the fallback;
- the preview meta tag, `robots.txt` and `X-Robots-Tag`, both on and off;
- the `www` redirect and the Content-Security-Policy header;
- trust proxy: with one hop, `req.ip` comes from `X-Forwarded-For`;
- the Resend transport, with a fake `fetch`: URL, headers including `Idempotency-Key`, body, time limit, and error text without the address;
- control characters stripped from subjects;
- skipping reserved addresses: `SKIPPED` status and erased reset links, with the mailbox transport unaffected;
- the reset link fragment, and the reset clearing the cookie;
- the dish-request links;
- the seed guard and the `--preview-if-empty` decision, as unit tests of the decision function;
- sample photos served from `/uploads/meals/`;
- the shutdown helper.

**Frontend** (Vitest):

- the banner on and off according to the meta tag;
- the reset page: reads the fragment, falls back to the query, clears the address bar;
- the bell count reset on sign-out or account change, and the cart emptied after a reset;
- `ProtectedRoute` keeping the hash;
- the dish-requests scroll after loading;
- the extra option in the distance menu;
- the `NearMeForm` backup timer and late answers;
- `ChefsPage` keeping the distance.

**Dress rehearsal on the Mac:**

- Build the Docker image and run it with `NODE_ENV=production`, `PREVIEW_MODE=true`, a throwaway `DEMO_PASSWORD` and a dummy `RESEND_API_KEY`, against a separate scratch database on the local Postgres (never the development database), with a mounted folder standing in for the volume. Run the pre-deploy command first, as Railway does.
- Check in the browser: the banner, the sample kitchens and photos, sign-up, a practice order, the chef side, the map tiles (the Content-Security-Policy allows them), `robots.txt` and the headers, and that a restart keeps uploaded photos.
- Emails use the Resend transport with a dummy key. They are expected to fail with 401 and wait for a retry, so nothing is sent. Emails to sample addresses must show `SKIPPED`.

**Live check after the first deploy:**

- Claude checks the public pages and headers (https, the `www` redirect, the banner, `robots.txt`, photos, map, `/health`) and Railway's logs.
- The owner checks the signed-in flow:
  1. Sign up with a real email address.
  2. Place a practice order at a sample kitchen and receive the receipt.
  3. Sign in as the sample chef with `DEMO_PASSWORD` and confirm the order.
  4. Receive the confirmation email.
  5. Try "Forgot password".

## Costs

| Item | Cost |
|---|---|
| Railway Hobby | $5/month, including $5 of usage; this app should need about $5-10/month in total |
| Domain | Namecheap's price for `.app` (about $10-15 a year) |
| Resend | Free |
| Vercel | Nothing (disconnected) |

## Not in this phase (Phase 8b, the public launch)

- Payments (Phase 5, waiting for the Stripe test keys).
- Terms of Service and Privacy Policy pages, and an age confirmation.
- Chef permits: ask for and show each chef's county permit. Riverside County has a MEHKO program; as of May 2026, San Bernardino County has none.
- Database backups: Railway Pro at $20/month, or a nightly backup job.
- A faster first load on phones by splitting the website's code (the main file is 587 kB, 180 kB compressed).
- Error alerts (for example Sentry) and uptime checks.
- A map tile provider for real traffic. OpenStreetMap's free tiles are meant for light use.
- A support inbox, since replies to `no-reply@` go nowhere.
- Email verification for new accounts, and a sign-up page that honors `?redirect=`.
- The remaining review leftovers:
  - the 409 wording when a confirm loses the race to automatic cancellation;
  - a double notification when a dish request is answered from two tabs;
  - the bell's read-all race;
  - voter notices inserted one by one;
  - the forgot-password timing;
  - the development API being reachable on the local network;
  - test gaps;
  - the 7a URL and geocoder nits.
