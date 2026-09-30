# Phase 8a Live Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put Neighbors Kitchen on the internet as a show-and-tell preview at https://neighborskitchen.app on Railway: the API also serves the website, real emails go through Resend, the preview carries sample data and free-license photos, and the leftovers a demo could run into are fixed.

**Architecture:** In production, one Node process (a Docker image that Railway builds) serves the API, the built website (with a fallback to `index.html` for page addresses), uploaded photos (from a Railway volume) and the sample photos that ship in the repo, and runs the background helper. `createApp(options)` gains production options: the website folder, the preview flag, the public address and the number of trusted proxies. Emails go through a new Resend transport, and made-up addresses are skipped. The seed asks `sampleDataPlan()` whether sample data may load. Railway's pre-deploy command migrates the database and loads the preview's sample data once.

**Tech Stack:** Express 5, Prisma 6 + PostgreSQL, Zod 4, helmet 8, sharp, Vitest + Supertest (backend); React 19, React Router 7, Zustand, Vitest + Testing Library (frontend); Docker (`node:24-bookworm-slim`), Railway (config as code, CLI 4.29), the Resend HTTP API, Namecheap DNS.

**Spec:** `docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md` (read it first; this plan argues from it).

## Global Constraints

- The live address is `https://neighborskitchen.app`, and `www.neighborskitchen.app` answers 301 to the same path and query there.
- Preview banner text, exactly: `Preview: practice orders only. No food is made and no one is charged.`
- Preview marker: `<meta name="nk-preview" content="true" />`, added to the served `index.html` only when `PREVIEW_MODE=true`.
- Preview `robots.txt` is `User-agent: *\nDisallow: /\n`. Outside preview it is `User-agent: *\nAllow: /\n`. In preview every response carries `X-Robots-Tag: noindex, nofollow`.
- Caching:
  - `/assets/*`: `public, max-age=31536000, immutable`
  - other website files: `public, max-age=3600`
  - `index.html` and every page address: `no-cache`
  - photos keep `max-age=30d` + immutable, as today.
- The website fallback answers only `GET` and `HEAD` requests, never under `/api`, `/uploads` or `/health`. Those keep the JSON 404 `{ success: false, error: { code: 'NOT_FOUND', ... } }`.
- Content-Security-Policy directives:
  - `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: https://tile.openstreetmap.org`
  - `connect-src 'self'`, `font-src 'self'`, `object-src 'none'`
  - `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`
  - `upgrade-insecure-requests` only when the public address is https.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `TRUST_PROXY_HOPS`: 0 by default, 1 on Railway. When above 0, the app logs one line: `Proxy check: visitor addresses look public.` or `Proxy check: visitor addresses look private. Check TRUST_PROXY_HOPS.`
- Resend:
  - `POST https://api.resend.com/emails` with `Authorization: Bearer <key>`, `Content-Type: application/json` and `Idempotency-Key: <email id>`;
  - body `{ from, to, subject, html, text }`;
  - a 10-second limit;
  - errors read `Resend <status>: <name>: <message>`, with every email address replaced by `(address)`.
- Reserved recipients: top-level `test`, `example`, `invalid`, `localhost`, or `example.com`/`example.net`/`example.org` and their subdomains. With a real transport (`keepsCopies: false`) they get status `SKIPPED`, `lastError` `Not sent: example address`, and a password-reset email's token becomes `null`.
- Subjects: every control character (`\p{Cc}`) becomes a space; runs of spaces collapse; the ends are trimmed.
- Reset links: `/reset-password#token=<token>`. The page also accepts `?token=` and then clears the address bar.
- Sample data (`sampleDataPlan`):
  - refused in production unless `PREVIEW_MODE=true` and `DEMO_PASSWORD` has at least 12 characters;
  - `--preview-if-empty` skips outside preview, and skips when a `@neighborskitchen.test` user exists;
  - the development password stays `Password123`;
  - the preview password is never printed.
- Sample photos:
  - `backend/prisma/sample-photos/<samplePhotoId(meal name)>.webp`, at most 1200 px, WebP quality 80;
  - `samplePhotoId` = SHA-256 of `neighbors-kitchen sample photo: <meal name>`, hex, laid out 8-4-4-4-12;
  - Unsplash License (not Unsplash+) or Pexels License, food only, no people and no brand logos;
  - `CREDITS.md` lists each one;
  - TheMealDB is no longer used anywhere.
- Leftovers: 15-second "Use my location" backup timer; delivery distance choices 2, 5, 10, 15, 25 plus the kitchen's own value; 25 miles is only the default for the first search.
- Project conventions (repo `CLAUDE.md`):
  - backend relative imports end in `.js`, and settings are read from `env`;
  - expected values in tests are literals, never computed by the code under test;
  - never run `prisma format`;
  - create migrations with `prisma migrate diff` (Working Notes).
- Never use `\u` escape sequences in source written with the Write tool (it can turn them into real characters). Use `\p{...}` classes or real characters.
- Never print or paste secrets:
  - `JWT_SECRET` is generated by piping `openssl rand` into `railway variable set --stdin`;
  - `RESEND_API_KEY` and `DEMO_PASSWORD` are typed into Railway by the owner;
  - the rehearsal's throwaway values live only in the scratchpad.
- Actions that need the owner's explicit OK first:
  - downloads: the base Docker image, the sample photos;
  - creating Railway resources;
  - disconnecting or changing the Vercel project;
  - merging pull request #2.
- The owner does, and Claude never does: buying the domain, signing up for services, typing passwords on live sites, and editing Namecheap DNS.

## Review Focus

1. **Real addresses that only look like test addresses.** `jo@testing.com`, `sam@example.co` and `amy@mail.test.com` must still be emailed. Only the reserved endings are skipped. (Test in Task 6.)
2. **Line breaks and emoji in names that end up in subjects.** A kitchen named "Abuela's[CR LF]Table 🌮" gives the subject `Abuela's Table 🌮 confirmed your order NK-7QX4PD`: one space, emoji kept. (Test in Task 6.)
3. **A reset link opened while someone else is signed in on that browser.** Saving the new password must clear that browser's refresh cookie too, or a reload would sign the other account back in. (Test in Task 7.)
4. **A retry after the server stopped halfway through a send.** The retry must reach Resend with the same `Idempotency-Key`, so the person never gets the email twice. (Test in Task 6.)
5. **Page addresses opened fresh on the live site.** Links typed in, opened from an email, refreshed, or with a trailing slash (`/orders/abc`, `/chef/feedback?view=requests`, `/reset-password/`) must reach the app. Missing `/api`, `/uploads` and `/assets` files must stay real 404s. (Test in Task 2.)

Accepted for the preview, not tested: a tab left open across an update can ask for a map file that no longer exists. Reloading the page fixes it; 8b can add a reload-on-error.

## File Map

Backend (`backend/`):
- `src/config/env.ts` (new settings, `readEnv`, `productionProblems`), `.env.example`
- `src/app.ts` (`AppOptions`, `appOptionsFromEnv`), `src/index.ts` (clean stop)
- `src/web/website.ts` (website, fallback, robots, www, noindex), `src/web/security.ts` (CSP directives, proxy check)
- `src/lib/shutdown.ts`, `src/jobs/backgroundJobs.ts` (stoppable helper)
- `src/services/notifications/mailer.ts` (Resend), `addresses.ts` (reserved addresses), `emailDelivery.ts`, `emailTemplates.ts`, `bellText.ts`
- `src/controllers/authController.ts` (reset clears the cookie)
- `src/services/sampleData.ts` (`sampleDataPlan`), `src/services/samplePhotos.ts`
- `prisma/schema.prisma` + one migration (`SKIPPED`), `prisma/seed.ts`, `prisma/sample-photos/` (35 WebP + `CREDITS.md`)
- `scripts/prepare-sample-photos.ts`, `package.json` (scripts; `prisma` and `tsx` move to dependencies)
- Tests: new `settings.test.ts`, `website.test.ts`, `security.test.ts`, `shutdown.test.ts`, `resendTransport.test.ts`, `sampleData.test.ts`, `samplePhotos.test.ts`; changed `backgroundJobs.test.ts`, `emailDelivery.test.ts`, `emailTemplates.test.ts`, `passwordReset.test.ts`, `notificationText.test.ts`, `feedbackNotifications.test.ts`

Frontend (`frontend/src/`):
- `components/layout/PreviewBanner.tsx` + `.css` + test, `App.tsx`
- `pages/ResetPasswordPage.tsx` + test
- `store/notificationStore.ts` + new test, `services/authService.ts`
- `components/auth/RouteGuards.tsx` + new test
- `components/feedback/DishRequests.tsx` + test
- `utils/deliveryRadius.ts` + test, `components/chef/KitchenProfileForm.tsx`
- `components/location/NearMeForm.tsx` + test
- `utils/location.ts` + test, `pages/ChefsPage.tsx`

Repository: `Dockerfile`, `.dockerignore`, `railway.json` (new); `vercel.json` and `netlify.toml` (removed); `DEPLOYMENT.md`, `README.md`, `CLAUDE.md`.

## Working Notes

- **Tests.** Backend tests run from `backend/`: `npx vitest run tests/<file>.test.ts`, or `npm test` for all. Frontend: `cd frontend && npx vitest run src/<path>`, or `npm test`. Everything: `npm test` in the repo root.
- **Type checks.** `cd backend && npx tsc --noEmit -p .`; website: `cd frontend && npm run lint && npm run build`.
- **Database.** The local Postgres runs on port 5433 (`npm run db:start` in `backend/`). Tests migrate their own database.
- **Creating the migration** (Task 6), from `backend/`:
  ```bash
  STAMP=$(date -u +%Y%m%d%H%M%S)
  DIR="prisma/migrations/${STAMP}_email_skipped_status"
  mkdir -p "$DIR"
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > "$DIR/migration.sql"
  cat "$DIR/migration.sql"
  npx prisma migrate deploy
  npx prisma generate
  ```
  The SQL must be exactly `ALTER TYPE "EmailStatus" ADD VALUE 'SKIPPED';` (plus a comment line). If it shows anything else, stop and find out why.
- **Dev server.** Preview config `neighbors-kitchen` (`npm run dev`, website on port 3000). Restart it after `prisma generate` (preview_stop, then preview_start).
- **Browser checks.**
  - The login page's demo buttons sign in as Chris (customer) or Maria (chef).
  - Screenshots of scrolled content come out blank, so use a tall viewport (1000x1300) or JS DOM checks.
  - The Enter key does not submit forms: click the button.
  - Stop processes only by exact PID.
  - Re-run `npm run db:seed` in `backend/` afterwards.
- **Scratch files** (downloads, the rehearsal's settings and data) go in the session scratchpad, never in the repo: `/private/tmp/claude-501/-Users-josephlombera-Documents-claude-code-neighbors-kitchen/<session>/scratchpad` (the path is in the system prompt).
- **Commits.** Messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never add the untracked `AGENTS.md`.
- **Pushing.** Push to `claude/neighbors-kitchen-chat-dk4r07` at the end of each part (this updates pull request #2). Until the Vercel project is disconnected (Task 23), every push also makes a failing Vercel preview; that is expected.
- **Progress ledger.** Keep it in `.superpowers/sdd/2026-09-29-phase8a-live-preview/progress.md` (git-ignored).

---

# Part 1: Ready for the internet (backend)

At the end of Part 1 the API can serve the built website in production, asks search engines to stay away in preview mode, sends strict security headers, sees each visitor's own address behind Railway's proxy, and stops cleanly.

### Task 1: Settings for the live site

**Files:**
- Modify: `backend/src/config/env.ts`, `backend/.env.example`
- Test: `backend/tests/settings.test.ts` (new)

**Interfaces:**
- Produces: `env.PREVIEW_MODE: boolean`, `env.TRUST_PROXY_HOPS: number`, `env.WEB_DIST_DIR: string`, `env.EMAIL_TRANSPORT: 'mailbox' | 'resend'`, `env.RESEND_API_KEY?: string`, `env.DEMO_PASSWORD?: string`.
- Produces: `readEnv(source: Record<string, string | undefined>): Env` and `productionProblems(config: Env, fileExists?: (file: string) => boolean): string[]` in `src/config/env.ts`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Env, productionProblems, readEnv } from '../src/config/env.js';

const required = {
  DATABASE_URL: 'postgresql://postgres@localhost:5433/neighbors_kitchen_test',
  JWT_SECRET: 'a-test-secret-that-is-at-least-32-characters',
};

// A complete, safe configuration for the preview site on Railway.
const live: Env = {
  NODE_ENV: 'production',
  PORT: 8080,
  FRONTEND_URL: 'https://neighborskitchen.app',
  DATABASE_URL: 'postgresql://postgres:secret@postgres.railway.internal:5432/railway',
  JWT_SECRET: 'a-random-secret-that-is-long-enough-for-the-live-site-0123456789',
  JWT_EXPIRE: '15m',
  REFRESH_TOKEN_TTL_DAYS: 7,
  BCRYPT_ROUNDS: 12,
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 1000,
  UPLOAD_DIR: '/data/uploads',
  PLATFORM_FEE_PERCENT: 10,
  GEOCODER: 'census',
  EMAIL_TRANSPORT: 'resend',
  RESEND_API_KEY: 're_test_123',
  EMAIL_FROM: 'Neighbors Kitchen <no-reply@neighborskitchen.app>',
  JOBS_INTERVAL_MS: 5000,
  RATE_REMINDER_DELAY_MINUTES: 120,
  PREVIEW_MODE: true,
  TRUST_PROXY_HOPS: 1,
  WEB_DIST_DIR: '/app/frontend/dist',
  DEMO_PASSWORD: 'a-long-demo-password',
};
const websiteBuilt = () => true;

describe('readEnv', () => {
  it('reads the preview and proxy settings', () => {
    const config = readEnv({ ...required, PREVIEW_MODE: 'true', TRUST_PROXY_HOPS: '1' });

    expect(config.PREVIEW_MODE).toBe(true);
    expect(config.TRUST_PROXY_HOPS).toBe(1);
  });

  it('is not a preview and trusts no proxy unless told', () => {
    const config = readEnv(required);

    expect(config.PREVIEW_MODE).toBe(false);
    expect(config.TRUST_PROXY_HOPS).toBe(0);
    expect(config.EMAIL_TRANSPORT).toBe('mailbox');
    expect(config.DEMO_PASSWORD).toBeUndefined();
  });

  it('needs the Resend key when emails go through Resend', () => {
    expect(() => readEnv({ ...required, EMAIL_TRANSPORT: 'resend' })).toThrow(
      'RESEND_API_KEY: RESEND_API_KEY is required when EMAIL_TRANSPORT is resend',
    );
  });

  it('refuses to start a live site with unsafe settings', () => {
    expect(() =>
      readEnv({ ...required, NODE_ENV: 'production', FRONTEND_URL: 'http://neighborskitchen.app', WEB_DIST_DIR: '/nowhere' }),
    ).toThrow(
      'Unsafe production settings:\n  - FRONTEND_URL must start with https://\n  - EMAIL_TRANSPORT must be resend, so emails are really sent\n  - The website was not found in WEB_DIST_DIR (/nowhere)',
    );
  });
});

describe('productionProblems', () => {
  it('accepts a complete live configuration', () => {
    expect(productionProblems(live, websiteBuilt)).toEqual([]);
  });

  it('names every unsafe setting', () => {
    const unsafe = {
      ...live,
      FRONTEND_URL: 'http://neighborskitchen.app',
      EMAIL_TRANSPORT: 'mailbox' as const,
      JWT_SECRET: 'replace-with-a-long-random-string-at-least-32-characters',
    };

    expect(productionProblems(unsafe, () => false)).toEqual([
      'FRONTEND_URL must start with https://',
      'EMAIL_TRANSPORT must be resend, so emails are really sent',
      'JWT_SECRET is still the example value from .env.example',
      'The website was not found in WEB_DIST_DIR (/app/frontend/dist)',
    ]);
  });

  it('allows plain http on this computer, for the dress rehearsal', () => {
    expect(productionProblems({ ...live, FRONTEND_URL: 'http://localhost:4100' }, websiteBuilt)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run tests/settings.test.ts`
Expected: FAIL (`readEnv` and `productionProblems` are not exported).

- [ ] **Step 3: Write the settings**

Replace the whole of `backend/src/config/env.ts` with:

```ts
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    FRONTEND_URL: z.url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRE: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),
    // Where uploaded photos are stored and served from (/uploads/...)
    UPLOAD_DIR: z.string().min(1).default(path.resolve('uploads')),
    // Commission kept by Neighbors Kitchen, as a percent of each order's meal subtotal
    PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(10),
    // Address lookups for the map: "census" uses the free US Census Bureau geocoder, "off" skips them (tests)
    GEOCODER: z.enum(['census', 'off']).default('census'),
    // Where emails go: "mailbox" keeps them in the database for the practice mailbox page and sends
    // nothing; "resend" sends them through Resend (the live site).
    EMAIL_TRANSPORT: z.enum(['mailbox', 'resend']).default('mailbox'),
    // Resend's API key, needed when EMAIL_TRANSPORT is resend
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).default('Neighbors Kitchen <no-reply@neighborskitchen.test>'),
    // How often the background helper sends emails and runs timed tasks
    JOBS_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
    // Minutes after an order is completed before the rate-your-meal reminder
    RATE_REMINDER_DELAY_MINUTES: z.coerce.number().int().min(1).default(120),
    // The show-and-tell preview (Phase 8a): a banner on every page, search engines kept out, sample data allowed
    PREVIEW_MODE: z.stringbool().default(false),
    // Proxies in front of the app (1 on Railway), so rate limits see each visitor's own address
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    // The built website, which the API serves in production
    WEB_DIST_DIR: z.string().min(1).default(path.resolve('../frontend/dist')),
    // Password of the sample accounts on the preview site (the sample data uses Password123 when it is not set)
    DEMO_PASSWORD: z.string().min(1).optional(),
  })
  .refine((config) => config.EMAIL_TRANSPORT !== 'resend' || config.RESEND_API_KEY !== undefined, {
    path: ['RESEND_API_KEY'],
    message: 'RESEND_API_KEY is required when EMAIL_TRANSPORT is resend',
  });

export type Env = z.infer<typeof envSchema>;

// The example value from .env.example: a live site must never use it.
const EXAMPLE_JWT_SECRET = 'replace-with-a-long-random-string-at-least-32-characters';
// Plain http is fine on this computer (the dress rehearsal), never on the internet.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/** Settings that would make the live site unsafe or broken; empty when all is well. */
export function productionProblems(config: Env, fileExists: (file: string) => boolean = existsSync): string[] {
  const problems: string[] = [];
  const site = new URL(config.FRONTEND_URL);
  if (site.protocol !== 'https:' && !LOCAL_HOSTS.has(site.hostname)) problems.push('FRONTEND_URL must start with https://');
  if (config.EMAIL_TRANSPORT !== 'resend') problems.push('EMAIL_TRANSPORT must be resend, so emails are really sent');
  if (config.JWT_SECRET === EXAMPLE_JWT_SECRET) problems.push('JWT_SECRET is still the example value from .env.example');
  if (!fileExists(path.join(config.WEB_DIST_DIR, 'index.html'))) {
    problems.push(`The website was not found in WEB_DIST_DIR (${config.WEB_DIST_DIR})`);
  }
  return problems;
}

/** Reads and checks the settings. In production it also refuses unsafe ones. */
export function readEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  if (result.data.NODE_ENV === 'production') {
    const problems = productionProblems(result.data);
    if (problems.length > 0) {
      throw new Error(`Unsafe production settings:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    }
  }
  return result.data;
}

export const env = readEnv(process.env);
export const isProduction = env.NODE_ENV === 'production';
```

- [ ] **Step 4: Document the settings**

In `backend/.env.example`, replace the two email comment lines

```
# Email (Phase 7): "mailbox" keeps every email in the database for the practice mailbox page
# (http://localhost:3000/dev/mailbox) and sends nothing. A real email service comes at launch (Phase 8).
```

with

```
# Email (Phase 7): "mailbox" keeps every email in the database for the practice mailbox page
# (http://localhost:3000/dev/mailbox) and sends nothing. The live site uses EMAIL_TRANSPORT=resend,
# which needs Resend's API key:
# RESEND_API_KEY=re_...
```

Add before the `# Added in later phases (not used yet)` block:

```
# Live site (Phase 8a). Keep these values on this computer.
# PREVIEW_MODE=true shows the preview banner, keeps search engines out and allows the sample data.
PREVIEW_MODE=false
# Proxies in front of the app: 1 on Railway, 0 here
TRUST_PROXY_HOPS=0
# Password of the sample accounts on the preview site (Password123 when not set):
# DEMO_PASSWORD=...
```

Delete the now-wrong Cloudinary block at the end (photos live on a Railway volume):

```
# Image storage for meal photos in production (Phase 8)
# CLOUDINARY_CLOUD_NAME=...
# CLOUDINARY_API_KEY=...
# CLOUDINARY_API_SECRET=...
```

- [ ] **Step 5: Run the tests and type check**

Run: `cd backend && npx vitest run tests/settings.test.ts && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/env.ts backend/.env.example backend/tests/settings.test.ts
git commit -m "feat(api): settings for the live preview, refusing unsafe production values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: The API serves the website in production

**Files:**
- Create: `backend/src/web/website.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/website.test.ts` (new)

**Interfaces:**
- Consumes: `env.PREVIEW_MODE`, `env.FRONTEND_URL`, `env.WEB_DIST_DIR`, `isProduction` (Task 1).
- Produces: `AppOptions { preview: boolean; publicUrl: string; websiteDir?: string }`, `appOptionsFromEnv(): AppOptions`, `createApp(options?: AppOptions)` in `src/app.ts` (Task 3 adds `trustProxyHops?`).
- Produces: `websiteRoutes({ distDir, preview }): Router`, `wwwRedirect(publicUrl): RequestHandler`, `noIndex: RequestHandler`, `pageHtml(indexHtml, preview)`, `robotsTxt(preview)` in `src/web/website.ts`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/website.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppOptions, createApp } from '../src/app.js';

// A stand-in for frontend/dist.
let websiteDir: string;
beforeAll(() => {
  websiteDir = mkdtempSync(path.join(os.tmpdir(), 'nk-website-'));
  writeFileSync(
    path.join(websiteDir, 'index.html'),
    '<!doctype html>\n<html lang="en">\n  <head>\n    <title>Neighbors Kitchen</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n',
  );
  mkdirSync(path.join(websiteDir, 'assets'));
  writeFileSync(path.join(websiteDir, 'assets', 'index-abc123.js'), 'console.log("hello")');
  writeFileSync(path.join(websiteDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
});

const site = (options: Partial<AppOptions> = {}) =>
  createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', websiteDir, ...options });

describe('the website in production', () => {
  it('answers every page address with the app, never cached', async () => {
    for (const address of ['/', '/orders/order-1', '/chef/feedback?view=requests', '/reset-password/', '/index.html']) {
      const res = await request(site()).get(address);

      expect(res.status).toBe(200);
      expect(res.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(res.get('Cache-Control')).toBe('no-cache');
      expect(res.text).toContain('<div id="root"></div>');
    }
  });

  it('lets browsers keep built files for a year', async () => {
    const res = await request(site()).get('/assets/index-abc123.js');

    expect(res.status).toBe(200);
    expect(res.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('serves the other website files for an hour', async () => {
    const res = await request(site()).get('/favicon.svg');

    expect(res.status).toBe(200);
    expect(res.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('keeps real 404s for missing built files, the API and photos', async () => {
    for (const address of ['/assets/index-old999.js', '/api/v1/nothing-here', '/uploads/meals/00000000-0000-0000-0000-000000000000.webp']) {
      const res = await request(site()).get(address);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('leaves the health check alone', async () => {
    const res = await request(site()).get('/health');

    expect(res.body.message).toBe('Neighbors-Kitchen API is running');
  });

  it('does not answer other methods with the page', async () => {
    expect((await request(site()).post('/orders/order-1')).status).toBe(404);
  });

  it('sends www visitors to the site address, keeping the page', async () => {
    const res = await request(site()).get('/chefs?near=92373').set('Host', 'www.neighborskitchen.app');

    expect(res.status).toBe(301);
    expect(res.get('Location')).toBe('https://neighborskitchen.app/chefs?near=92373');
  });
});

describe('the preview site', () => {
  it('marks every page as the preview', async () => {
    const res = await request(site({ preview: true })).get('/meals');

    expect(res.text).toContain('<meta name="nk-preview" content="true" />');
  });

  it('asks search engines to stay away', async () => {
    const robots = await request(site({ preview: true })).get('/robots.txt');
    const api = await request(site({ preview: true })).get('/api/v1');

    expect(robots.text).toBe('User-agent: *\nDisallow: /\n');
    expect(api.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('is unmarked and open to search engines once it is the real site', async () => {
    const page = await request(site()).get('/meals');
    const robots = await request(site()).get('/robots.txt');

    expect(page.text).not.toContain('nk-preview');
    expect(page.get('X-Robots-Tag')).toBeUndefined();
    expect(robots.text).toBe('User-agent: *\nAllow: /\n');
  });
});

describe('development and tests', () => {
  it('serve no website from the API', async () => {
    expect((await request(createApp()).get('/meals')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run tests/website.test.ts`
Expected: FAIL (`createApp` takes no options; `AppOptions` does not exist).

- [ ] **Step 3: Write the website module**

Create `backend/src/web/website.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import express, { Request, RequestHandler, Response, Router } from 'express';
import { notFoundHandler } from '../middleware/errorHandler.js';

// In production the API also hands out the built website (frontend/dist), so the whole app lives at one address.
// Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

/** Paths the website never answers: the API, photos and the health check keep their own 404s. */
const NOT_WEBSITE = /^\/(api|uploads|health)(\/|$)/;
const PREVIEW_MARKER = '<meta name="nk-preview" content="true" />';

/** The page every website address gets. On the preview it carries the marker the banner looks for. */
export function pageHtml(indexHtml: string, preview: boolean): string {
  return preview ? indexHtml.replace('</head>', `  ${PREVIEW_MARKER}\n  </head>`) : indexHtml;
}

export function robotsTxt(preview: boolean): string {
  return preview ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n';
}

export function websiteRoutes({ distDir, preview }: { distDir: string; preview: boolean }): Router {
  const html = pageHtml(readFileSync(path.join(distDir, 'index.html'), 'utf8'), preview);
  const sendPage = (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  };

  const router = Router();
  router.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(robotsTxt(preview));
  });
  router.get('/index.html', sendPage);
  // Built files carry the build's fingerprint in their names, so browsers may keep them for a year.
  router.use('/assets', express.static(path.join(distDir, 'assets'), { index: false, immutable: true, maxAge: '1y' }));
  router.use('/assets', notFoundHandler);
  router.use(express.static(distDir, { index: false, maxAge: '1h' }));
  // Every other page address belongs to the React app, which shows its own "not found" page.
  router.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || NOT_WEBSITE.test(req.path)) return next();
    sendPage(req, res);
  });
  return router;
}

/** Sends www.<site> to the site's own address, keeping the path and query. */
export function wwwRedirect(publicUrl: string): RequestHandler {
  const site = new URL(publicUrl);
  const wwwHost = `www.${site.hostname}`;
  return (req, res, next) => {
    if (req.hostname !== wwwHost) return next();
    res.redirect(301, new URL(req.originalUrl, site).toString());
  };
}

/** The preview: every answer asks search engines not to list it. */
export const noIndex: RequestHandler = (_req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
};
```

- [ ] **Step 4: Give `createApp` its options**

In `backend/src/app.ts`:

1. Replace the imports block's last two lines

```ts
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRoutes } from './routes/index.js';
```

with

```ts
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRoutes } from './routes/index.js';
import { noIndex, websiteRoutes, wwwRedirect } from './web/website.js';
```

and change `import { env } from './config/env.js';` to `import { env, isProduction } from './config/env.js';`.

2. Replace

```ts
export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
```

with

```ts
export interface AppOptions {
  /** The show-and-tell preview: pages get the preview marker and search engines are asked to stay away. */
  preview: boolean;
  /** The site's public address (FRONTEND_URL). */
  publicUrl: string;
  /** The built website (frontend/dist). Set in production, where the API hands out the website too. */
  websiteDir?: string;
}

/** The options for the real server, from the settings. */
export function appOptionsFromEnv(): AppOptions {
  return {
    preview: env.PREVIEW_MODE,
    publicUrl: env.FRONTEND_URL,
    websiteDir: isProduction ? env.WEB_DIST_DIR : undefined,
  };
}

export function createApp(options: AppOptions = appOptionsFromEnv()): Express {
  const app = express();

  if (options.websiteDir) app.use(wwwRedirect(options.publicUrl));

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }));
  if (options.preview) app.use(noIndex);
```

3. Replace

```ts
  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);
```

with

```ts
  app.use('/api/v1', apiRoutes);

  // Production: the same server hands out the website, so the whole app lives at one address.
  if (options.websiteDir) app.use(websiteRoutes({ distDir: options.websiteDir, preview: options.preview }));

  app.use(notFoundHandler);
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx vitest run tests/website.test.ts && npm test && npx tsc --noEmit -p .`
Expected: PASS everywhere. The existing tests call `createApp()`, which still serves no website outside production.

- [ ] **Step 6: Commit**

```bash
git add backend/src/web/website.ts backend/src/app.ts backend/tests/website.test.ts
git commit -m "feat(api): serve the built website in production, with preview marker, robots and www redirect

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Security headers and each visitor's own address

**Files:**
- Create: `backend/src/web/security.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/security.test.ts` (new)

**Interfaces:**
- Consumes: `AppOptions`, `appOptionsFromEnv` (Task 2), `env.TRUST_PROXY_HOPS` (Task 1).
- Produces: `AppOptions.trustProxyHops?: number`; `contentSecurityDirectives(publicUrl): Record<string, string[] | null>`, `isPrivateAddress(ip): boolean`, `proxyCheck(log?): RequestHandler` in `src/web/security.ts`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/security.test.ts`:

```ts
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { isPrivateAddress } from '../src/web/security.js';

const directivesOf = (policy: string) => policy.split(';').map((part) => part.trim());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Content-Security-Policy', () => {
  it('lets pages load only our own files and the map tiles', async () => {
    const res = await request(createApp({ preview: false, publicUrl: 'https://neighborskitchen.app' })).get('/health');
    const directives = directivesOf(res.get('Content-Security-Policy')!);

    expect(directives).toContain("default-src 'self'");
    expect(directives).toContain("script-src 'self'");
    expect(directives).toContain("style-src 'self' 'unsafe-inline'");
    expect(directives).toContain("img-src 'self' data: https://tile.openstreetmap.org");
    expect(directives).toContain("connect-src 'self'");
    expect(directives).toContain("frame-ancestors 'none'");
    expect(directives).toContain('upgrade-insecure-requests');
  });

  it('does not ask a plain-http site (the dress rehearsal) to switch to https', async () => {
    const res = await request(createApp({ preview: false, publicUrl: 'http://localhost:4100' })).get('/health');

    expect(directivesOf(res.get('Content-Security-Policy')!)).not.toContain('upgrade-insecure-requests');
  });

  it("tells other sites only the site's address, as OpenStreetMap's tile policy asks", async () => {
    const res = await request(createApp({ preview: false, publicUrl: 'https://neighborskitchen.app' })).get('/health');

    expect(res.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});

describe("visitors' own addresses behind Railway's proxy", () => {
  it('uses the address the proxy passes on', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', trustProxyHops: 1 });

    await request(app).get('/api/v1').set('X-Forwarded-For', '203.0.113.9');

    expect(app.get('trust proxy')).toBe(1);
    expect(log).toHaveBeenCalledWith('Proxy check: visitor addresses look public.');
  });

  it('says so when addresses look private, which means the wrong number of proxies', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', trustProxyHops: 1 })).get('/api/v1');

    expect(log).toHaveBeenCalledWith('Proxy check: visitor addresses look private. Check TRUST_PROXY_HOPS.');
  });

  it('checks once, and not on the health check (it comes from inside Railway)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', trustProxyHops: 1 });

    await request(app).get('/health');
    expect(log).not.toHaveBeenCalled();
    await request(app).get('/api/v1').set('X-Forwarded-For', '203.0.113.9');
    await request(app).get('/api/v1').set('X-Forwarded-For', '198.51.100.7');

    expect(log).toHaveBeenCalledTimes(1);
  });

  it('trusts no proxy and checks nothing when there is none', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = createApp({ preview: false, publicUrl: 'http://localhost:3000' });

    await request(app).get('/api/v1').set('X-Forwarded-For', '203.0.113.9');

    expect(app.get('trust proxy')).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('isPrivateAddress', () => {
  it('knows private, shared, link-local and loopback addresses', () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '127.0.0.1', '169.254.1.1', '::1', '::ffff:10.0.0.1', 'fd12::1', 'fe80::1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it('treats everything else as a visitor on the internet', () => {
    for (const ip of ['203.0.113.9', '172.32.0.1', '100.128.0.1', '8.8.8.8', '2001:db8::1', '::ffff:203.0.113.9']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run tests/security.test.ts`
Expected: FAIL (`src/web/security.js` does not exist).

- [ ] **Step 3: Write the security module**

Create `backend/src/web/security.ts`:

```ts
import { RequestHandler } from 'express';

// Security settings for the live site. Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

/** What pages may load: our own files, plus map tiles from OpenStreetMap. */
export function contentSecurityDirectives(publicUrl: string): Record<string, string[] | null> {
  const httpsSite = new URL(publicUrl).protocol === 'https:';
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    // Leaflet and React set inline style values; scripts stay strict.
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    // A plain-http site (the dress rehearsal on this computer) must not ask browsers to switch to https.
    upgradeInsecureRequests: httpsSite ? [] : null,
  };
}

/** True for private, shared, link-local and loopback addresses: never a visitor's own address on the internet. */
export function isPrivateAddress(ip: string): boolean {
  const lower = ip.toLowerCase();
  const address = lower.startsWith('::ffff:') ? lower.slice('::ffff:'.length) : lower;
  if (address.includes(':')) return address === '::1' || /^f[cd]/.test(address) || address.startsWith('fe80:');
  const [a, b] = address.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * Logs once whether visitors' addresses look public, so a wrong TRUST_PROXY_HOPS shows up in the logs
 * without an address ever being logged. The health check comes from inside Railway, so it is not counted.
 */
export function proxyCheck(log: (message: string) => void = console.log): RequestHandler {
  let checked = false;
  return (req, _res, next) => {
    if (!checked && req.path !== '/health' && req.ip) {
      checked = true;
      log(
        isPrivateAddress(req.ip)
          ? 'Proxy check: visitor addresses look private. Check TRUST_PROXY_HOPS.'
          : 'Proxy check: visitor addresses look public.',
      );
    }
    next();
  };
}
```

- [ ] **Step 4: Use it in `createApp`**

In `backend/src/app.ts`:

1. Add the import `import { contentSecurityDirectives, proxyCheck } from './web/security.js';` after the `./routes/index.js` import.
2. In `AppOptions`, add after `websiteDir?: string;`:

```ts
  /** Proxies in front of the app (1 on Railway), so rate limits see each visitor's own address. */
  trustProxyHops?: number;
```

3. In `appOptionsFromEnv()`, add `trustProxyHops: env.TRUST_PROXY_HOPS,` after the `websiteDir` line.
4. Replace

```ts
  const app = express();

  if (options.websiteDir) app.use(wwwRedirect(options.publicUrl));

  // Security middleware
  app.use(helmet());
```

with

```ts
  const app = express();

  // Behind Railway's proxy the visitor's own address arrives in X-Forwarded-For.
  if (options.trustProxyHops) {
    app.set('trust proxy', options.trustProxyHops);
    app.use(proxyCheck());
  }
  if (options.websiteDir) app.use(wwwRedirect(options.publicUrl));

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: { directives: contentSecurityDirectives(options.publicUrl) },
      // OpenStreetMap's tile policy asks for a Referer; other sites only ever see our bare address.
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx vitest run tests/security.test.ts tests/website.test.ts && npm test && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/web/security.ts backend/src/app.ts backend/tests/security.test.ts
git commit -m "feat(api): strict security headers and visitor addresses behind the proxy, with a one-time check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Stopping cleanly

**Files:**
- Create: `backend/src/lib/shutdown.ts`
- Modify: `backend/src/jobs/backgroundJobs.ts`, `backend/src/index.ts`
- Test: `backend/tests/shutdown.test.ts` (new), `backend/tests/backgroundJobs.test.ts`

**Interfaces:**
- Produces: `startBackgroundJobs(options?: { tasks?: BackgroundTask[]; intervalMs?: number }): () => Promise<void>` (the stop function now waits for a pass in progress).
- Produces: `shutDown(steps: ShutdownSteps): Promise<void>` with `ShutdownSteps { stopJobs; server: Pick<Server, 'close' | 'closeIdleConnections' | 'closeAllConnections'>; disconnect; graceMs }`.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/backgroundJobs.test.ts`, change the import line to

```ts
import { runBackgroundTasks, startBackgroundJobs } from '../src/jobs/backgroundJobs.js';
```

and add at the end of the file:

```ts
describe('startBackgroundJobs', () => {
  it('stops after the pass in progress, and starts no new one', async () => {
    let started = 0;
    let finished = 0;
    const slow = {
      name: 'slow',
      run: async () => {
        started += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        finished += 1;
      },
    };

    const stop = startBackgroundJobs({ tasks: [slow], intervalMs: 5 });
    await vi.waitFor(() => expect(started).toBe(1));
    await stop();

    expect(finished).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(started).toBe(1);
  });
});
```

Create `backend/tests/shutdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shutDown, ShutdownSteps } from '../src/lib/shutdown.js';

type FakeServer = ShutdownSteps['server'];

describe('shutDown', () => {
  it('stops the helper, lets open requests finish, then closes the database', async () => {
    const steps: string[] = [];
    const server = {
      close: (done: () => void) => {
        steps.push('stop taking requests');
        setTimeout(done, 10);
      },
      closeIdleConnections: () => steps.push('close idle connections'),
      closeAllConnections: () => steps.push('close busy connections'),
    } as unknown as FakeServer;

    await shutDown({
      stopJobs: async () => {
        steps.push('stop helper');
      },
      server,
      disconnect: async () => {
        steps.push('close database');
      },
      graceMs: 1000,
    });

    expect(steps).toEqual(['stop helper', 'stop taking requests', 'close idle connections', 'close database']);
  });

  it('closes connections still busy after the grace period', async () => {
    const steps: string[] = [];
    let closed: () => void = () => {};
    const server = {
      close: (done: () => void) => {
        closed = done;
      },
      closeIdleConnections: () => {},
      closeAllConnections: () => {
        steps.push('close busy connections');
        closed();
      },
    } as unknown as FakeServer;

    await shutDown({ stopJobs: async () => {}, server, disconnect: async () => {}, graceMs: 20 });

    expect(steps).toEqual(['close busy connections']);
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run tests/shutdown.test.ts tests/backgroundJobs.test.ts`
Expected: FAIL (`shutdown.js` missing; `startBackgroundJobs` takes no options and does not wait).

- [ ] **Step 3: Make the helper stoppable**

In `backend/src/jobs/backgroundJobs.ts`, replace the whole `startBackgroundJobs` function (from its doc comment to the end of the file) with:

```ts
/** The timed tasks and the email sender, in the order each pass runs them. */
function defaultTasks(): BackgroundTask[] {
  const transport = transportFromEnv();
  return [
    // Cancel first, so an order that ran out of time gets no reminder in the same pass.
    { name: 'cancel unconfirmed orders', run: expireOverdueOrders },
    { name: 'chef reminders', run: sendChefReminders },
    { name: 'rate reminders', run: sendRateReminders },
    { name: 'send emails', run: (now) => deliverDueEmails(now, transport) },
  ];
}

/**
 * Starts the helper. The next pass is scheduled when the current one finishes, so passes never overlap.
 * Returns a stop function that resolves once a pass in progress has finished.
 */
export function startBackgroundJobs({
  tasks = defaultTasks(),
  intervalMs = env.JOBS_INTERVAL_MS,
}: { tasks?: BackgroundTask[]; intervalMs?: number } = {}): () => Promise<void> {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<void> = Promise.resolve();
  const pass = () => {
    running = runBackgroundTasks(tasks).then(() => {
      if (!stopped) timer = setTimeout(pass, intervalMs);
    });
  };
  timer = setTimeout(pass, intervalMs);

  return async () => {
    stopped = true;
    clearTimeout(timer);
    await running;
  };
}
```

- [ ] **Step 4: Write the shutdown helper**

Create `backend/src/lib/shutdown.ts`:

```ts
import type { Server } from 'node:http';

export interface ShutdownSteps {
  /** Stops the background helper; resolves once its pass in progress has finished. */
  stopJobs: () => Promise<void>;
  server: Pick<Server, 'close' | 'closeIdleConnections' | 'closeAllConnections'>;
  disconnect: () => Promise<void>;
  /** How long open requests may take before their connections are closed anyway. */
  graceMs: number;
}

/** Stops the app in order: no new timed work, no new requests (open ones may finish), then the database. */
export async function shutDown({ stopJobs, server, disconnect, graceMs }: ShutdownSteps): Promise<void> {
  await stopJobs();
  await new Promise<void>((resolve) => {
    const force = setTimeout(() => server.closeAllConnections(), graceMs);
    server.close(() => {
      clearTimeout(force);
      resolve();
    });
    server.closeIdleConnections();
  });
  await disconnect();
}
```

- [ ] **Step 5: Stop cleanly on SIGTERM**

Replace the whole of `backend/src/index.ts` with:

```ts
import 'dotenv/config';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { startBackgroundJobs } from './jobs/backgroundJobs.js';
import { prisma } from './lib/prisma.js';
import { shutDown } from './lib/shutdown.js';

const app = createApp();
let stopJobs: () => Promise<void> = async () => {};

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Neighbors-Kitchen API server running on port ${env.PORT}`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${env.PORT}/api/v1`);
  stopJobs = startBackgroundJobs();
});

// Railway sends SIGTERM before it replaces this version (Ctrl+C sends SIGINT): finish up, then leave.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    console.log(`${signal} received: finishing the current work`);
    shutDown({ stopJobs: () => stopJobs(), server, disconnect: () => prisma.$disconnect(), graceMs: 25_000 }).then(
      () => process.exit(0),
      (error: unknown) => {
        console.error('Shutdown failed:', error);
        process.exit(1);
      },
    );
  });
}
```

- [ ] **Step 6: Run the tests and try it**

Run: `cd backend && npx vitest run tests/shutdown.test.ts tests/backgroundJobs.test.ts && npm test && npx tsc --noEmit -p .`
Expected: PASS.

Then start the API alone and stop it:

```bash
S=<scratchpad>
cd backend && (npx tsx src/index.ts > "$S/nk-stop.log" 2>&1 &) && sleep 6 && kill -TERM $(lsof -ti tcp:4000 -sTCP:LISTEN) && sleep 2 && cat "$S/nk-stop.log"
```

Expected: the log ends with `SIGTERM received: finishing the current work`, and nothing listens on 4000 afterwards (`lsof -ti tcp:4000 -sTCP:LISTEN` prints nothing). If the dev server is already running on 4000, stop it first by its exact PID, or skip this check.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/shutdown.ts backend/src/jobs/backgroundJobs.ts backend/src/index.ts backend/tests/shutdown.test.ts backend/tests/backgroundJobs.test.ts
git commit -m "feat(api): stop cleanly on SIGTERM: finish the helper's pass and open requests first

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: End of Part 1**

Run everything: `npm test` in the repo root. Then push: `git push origin claude/neighbors-kitchen-chat-dk4r07`. Tell the owner in two plain sentences what Part 1 did.

---

# Part 2: Real email

At the end of Part 2 the live site can send through Resend with a time limit and no double sends. The sample accounts' made-up addresses are never handed to it, subjects can't carry line breaks, and reset links keep their secret after `#`.

### Task 5: The Resend transport

**Files:**
- Modify: `backend/src/services/notifications/mailer.ts`, `backend/src/services/notifications/emailDelivery.ts` (pass the id)
- Test: `backend/tests/resendTransport.test.ts` (new)

**Interfaces:**
- Consumes: `env.EMAIL_TRANSPORT`, `env.RESEND_API_KEY` (Task 1).
- Produces: `OutgoingEmail.id: string`; `resendTransport(apiKey: string, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): EmailTransport`; `transportFromEnv(config?: Pick<Env, 'EMAIL_TRANSPORT' | 'RESEND_API_KEY'>): EmailTransport`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/resendTransport.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mailboxTransport, OutgoingEmail, resendTransport, transportFromEnv } from '../src/services/notifications/mailer.js';

const email: OutgoingEmail = {
  id: 'email-1',
  to: 'dana@nk-sample.com',
  from: 'Neighbors Kitchen <no-reply@neighborskitchen.app>',
  subject: 'Your order NK-7QX4PD was sent',
  html: '<p>Hi</p>',
  text: 'Hi',
};

const answering = (status: number, body: string, statusText = '') =>
  vi.fn<typeof fetch>(async () => new Response(body, { status, statusText, headers: { 'Content-Type': 'application/json' } }));

describe('resendTransport', () => {
  it('posts the email to Resend, with our id as the idempotency key', async () => {
    const fetchImpl = answering(200, JSON.stringify({ id: 'resend-1' }));

    await resendTransport('re_test_123', { fetchImpl }).send(email);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer re_test_123',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'email-1',
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      from: 'Neighbors Kitchen <no-reply@neighborskitchen.app>',
      to: 'dana@nk-sample.com',
      subject: 'Your order NK-7QX4PD was sent',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('reports a refusal without any address in it', async () => {
    const fetchImpl = answering(422, JSON.stringify({ statusCode: 422, name: 'validation_error', message: 'Invalid `to` field: dana@nk-sample.com' }));

    await expect(resendTransport('re_test_123', { fetchImpl }).send(email)).rejects.toThrow(
      'Resend 422: validation_error: Invalid `to` field: (address)',
    );
  });

  it('reports an answer that is not JSON by its status', async () => {
    const fetchImpl = answering(502, '<html>oops</html>', 'Bad Gateway');

    await expect(resendTransport('re_test_123', { fetchImpl }).send(email)).rejects.toThrow('Resend 502: Bad Gateway');
  });

  it('gives up on a send that takes too long', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    await expect(resendTransport('re_test_123', { fetchImpl, timeoutMs: 20 }).send(email)).rejects.toThrow(
      'The operation was aborted due to timeout',
    );
  });

  it('is a real service: sent password links are not kept', () => {
    expect(resendTransport('re_test_123').keepsCopies).toBe(false);
  });
});

describe('transportFromEnv', () => {
  it('uses the setting', () => {
    expect(transportFromEnv({ EMAIL_TRANSPORT: 'mailbox', RESEND_API_KEY: undefined })).toBe(mailboxTransport);
    expect(transportFromEnv({ EMAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_test_123' }).keepsCopies).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run tests/resendTransport.test.ts`
Expected: FAIL (`resendTransport` is not exported).

- [ ] **Step 3: Write the transport**

In `backend/src/services/notifications/mailer.ts`:

1. Replace the `OutgoingEmail` interface with:

```ts
/** An email ready to hand to a sending service. */
export interface OutgoingEmail {
  /** Our id for the email. Resend uses it as the idempotency key, so a retry is never delivered twice. */
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}
```

2. Replace the doc comment of `EmailTransport` (`/** Something that sends emails. Phase 8 adds a real email service next to the practice mailbox. */`) with `/** Something that sends emails: the practice mailbox (development) or Resend (the live site). */`, and its `keepsCopies` comment with:

```ts
  /**
   * True when the emails table is the copy people read (the practice mailbox). A real service keeps its
   * own records, so sent password links are erased from the database and made-up addresses are skipped.
   */
```

3. Replace

```ts
/** The transport EMAIL_TRANSPORT asks for ("mailbox" is the only one until Phase 8). */
export function transportFromEnv(): EmailTransport {
  return mailboxTransport;
}
```

with

```ts
const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;
// Anything shaped like an email address, so refusal reasons never carry one into the logs or the database.
const ADDRESS = /[^\s<>"'@]+@[^\s<>"'@]+/g;

/** Resend's reason for refusing an email, without any email address in it. */
async function refusalReason(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { name?: string; message?: string } | null;
  const reason = [body?.name, body?.message].filter(Boolean).join(': ') || response.statusText || 'no details';
  return reason.replace(ADDRESS, '(address)').slice(0, 300);
}

export interface ResendOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** The live site: sends through Resend's API (https://resend.com/docs/api-reference/emails/send-email). */
export function resendTransport(apiKey: string, { fetchImpl = fetch, timeoutMs = SEND_TIMEOUT_MS }: ResendOptions = {}): EmailTransport {
  return {
    keepsCopies: false,
    send: async (email) => {
      const response = await fetchImpl(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': email.id },
        body: JSON.stringify({ from: email.from, to: email.to, subject: email.subject, html: email.html, text: email.text }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`Resend ${response.status}: ${await refusalReason(response)}`);
    },
  };
}

/** The transport EMAIL_TRANSPORT asks for. */
export function transportFromEnv(config: Pick<Env, 'EMAIL_TRANSPORT' | 'RESEND_API_KEY'> = env): EmailTransport {
  return config.EMAIL_TRANSPORT === 'resend' ? resendTransport(config.RESEND_API_KEY ?? '') : mailboxTransport;
}
```

4. In `backend/src/services/notifications/emailDelivery.ts`, change

```ts
      await transport.send({ to: email.toAddress, from: env.EMAIL_FROM, ...written });
```

to

```ts
      await transport.send({ id, to: email.toAddress, from: env.EMAIL_FROM, ...written });
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && npx vitest run tests/resendTransport.test.ts tests/emailDelivery.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/mailer.ts backend/src/services/notifications/emailDelivery.ts backend/tests/resendTransport.test.ts
git commit -m "feat(email): Resend transport with a 10-second limit and an idempotency key per email

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Delivery rules for a real email service

**Files:**
- Create: `backend/src/services/notifications/addresses.ts`
- Modify: `backend/prisma/schema.prisma`, new migration, `backend/src/services/notifications/emailDelivery.ts`
- Test: `backend/tests/emailDelivery.test.ts`

**Interfaces:**
- Consumes: `OutgoingEmail.id` (Task 5).
- Produces: `EmailStatus.SKIPPED`; `isReservedAddress(address: string): boolean`; `cleanSubject(subject: string): string` (exported from `emailDelivery.ts`).

- [ ] **Step 1: Write the failing tests**

In `backend/tests/emailDelivery.test.ts`:

1. Change the vitest import to `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';`, and add after the `sampleOrder` import:

```ts
import { isReservedAddress } from '../src/services/notifications/addresses.js';
```

2. Change `import { deliverDueEmails } from '../src/services/notifications/emailDelivery.js';` to `import { cleanSubject, deliverDueEmails } from '../src/services/notifications/emailDelivery.js';`.
3. Inside `describe('deliverDueEmails', () => {`, before the first `it`, add:

```ts
  // Failed sends are logged; keep the test output quiet.
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
```

4. In the test `erases a password link once a real email service has sent it`, change `const email = await queueEmail({ kind: 'PASSWORD_RESET', data: { firstName: 'Dana', token: 'secret-token-123' } });` to

```ts
    const email = await queueEmail({ toAddress: 'dana@nk-sample.com', kind: 'PASSWORD_RESET', data: { firstName: 'Dana', token: 'secret-token-123' } });
```

(`dana@example.com` is now a made-up address that a real service never receives.)

5. Add these tests inside `describe('deliverDueEmails', ...)`, after the last one:

```ts
  it("never hands the sample accounts' made-up addresses to a real email service", async () => {
    const email = await queueEmail({ toAddress: 'maria@neighborskitchen.test' });
    const { sent, transport } = recordingTransport(false);

    expect(await deliverDueEmails(NOW, transport)).toEqual({ sent: 0, failed: 0 });

    expect(sent).toEqual([]);
    expect(await reload(email.id)).toMatchObject({ status: 'SKIPPED', attempts: 1, lastError: 'Not sent: example address', sentAt: null });
  });

  it('erases the link of a skipped password email', async () => {
    const email = await queueEmail({ toAddress: 'maria@neighborskitchen.test', kind: 'PASSWORD_RESET', data: { firstName: 'Maria', token: 'secret-token-123' } });
    const { transport } = recordingTransport(false);

    await deliverDueEmails(NOW, transport);

    expect(await reload(email.id)).toMatchObject({ status: 'SKIPPED', data: { firstName: 'Maria', token: null } });
  });

  it('still emails real addresses that only look like test ones', async () => {
    for (const toAddress of ['jo@testing.com', 'sam@example.co', 'amy@mail.test.com']) await queueEmail({ toAddress });
    const { sent, transport } = recordingTransport(false);

    await deliverDueEmails(NOW, transport);

    expect(sent.map((email) => email.to).sort()).toEqual(['amy@mail.test.com', 'jo@testing.com', 'sam@example.co']);
  });

  it('keeps line breaks out of subjects, and keeps emoji', async () => {
    const email = await queueEmail({ toAddress: 'dana@nk-sample.com', data: { ...sampleOrder, kitchenName: "Abuela's\r\nTable 🌮" } as unknown as Prisma.InputJsonValue });
    const { sent, transport } = recordingTransport(false);

    await deliverDueEmails(NOW, transport);

    expect(sent[0].subject).toBe("Abuela's Table 🌮 confirmed your order NK-7QX4PD");
    expect((await reload(email.id)).subject).toBe("Abuela's Table 🌮 confirmed your order NK-7QX4PD");
  });

  it('sends a retry with the same id, so the email service never delivers it twice', async () => {
    const email = await queueEmail({ toAddress: 'dana@nk-sample.com' });
    const ids: string[] = [];
    const flaky: EmailTransport = {
      keepsCopies: false,
      send: async (outgoing) => {
        ids.push(outgoing.id);
        if (ids.length === 1) throw new Error('The operation was aborted due to timeout');
      },
    };

    await deliverDueEmails(NOW, flaky);
    await deliverDueEmails(new Date(NOW.getTime() + MINUTE), flaky);

    expect(ids).toEqual([email.id, email.id]);
    expect((await reload(email.id)).status).toBe('SENT');
  });

  it('logs a failed send without the address', async () => {
    const email = await queueEmail();

    await deliverDueEmails(NOW, brokenTransport);

    expect(vi.mocked(console.warn)).toHaveBeenCalledWith(`Email ${email.id} (ORDER_CONFIRMED) was not sent: service unavailable (will try again)`);
  });
```

6. Add at the end of the file:

```ts
describe('isReservedAddress', () => {
  it('knows addresses that can never receive mail', () => {
    for (const address of ['maria@neighborskitchen.test', 'dana@example.com', 'x@mail.example.org', 'DANA@EXAMPLE.NET', 'a@b.example', 'a@b.invalid', 'root@localhost']) {
      expect(isReservedAddress(address)).toBe(true);
    }
  });

  it('lets every other address through', () => {
    for (const address of ['jo@testing.com', 'sam@example.co', 'amy@mail.test.com', 'dana@notexample.com', 'kim@gmail.com']) {
      expect(isReservedAddress(address)).toBe(false);
    }
  });
});

describe('cleanSubject', () => {
  it('turns control characters into single spaces', () => {
    expect(cleanSubject('New order\r\nBcc: someone\t\tnow ')).toBe('New order Bcc: someone now');
  });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run tests/emailDelivery.test.ts`
Expected: FAIL (`addresses.js` missing, `cleanSubject` not exported).

- [ ] **Step 3: Add the `SKIPPED` status**

In `backend/prisma/schema.prisma`, replace

```prisma
  FAILED  // gave up
}
```

with

```prisma
  FAILED  // gave up
  SKIPPED // a made-up address (the sample accounts), never handed to a real email service
}
```

Then create the migration (Working Notes, name `email_skipped_status`). Expected SQL: `ALTER TYPE "EmailStatus" ADD VALUE 'SKIPPED';`

- [ ] **Step 4: Write the reserved-address check**

Create `backend/src/services/notifications/addresses.ts`:

```ts
// Addresses that can never receive mail (RFC 2606 and RFC 6761). The sample accounts use @neighborskitchen.test.
const RESERVED_TOP_LEVEL = new Set(['test', 'example', 'invalid', 'localhost']);
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

export function isReservedAddress(address: string): boolean {
  const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase().replace(/\.$/, '');
  const topLevel = domain.slice(domain.lastIndexOf('.') + 1);
  return RESERVED_TOP_LEVEL.has(topLevel) || RESERVED_DOMAINS.some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`));
}
```

- [ ] **Step 5: Apply the rules in delivery**

In `backend/src/services/notifications/emailDelivery.ts`:

1. Add the import `import { isReservedAddress } from './addresses.js';` after the `prisma` import.
2. Replace

```ts
const REMOVED = '(removed after sending)';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
```

with

```ts
const REMOVED = '(removed after sending)';
const SKIPPED_NOTE = 'Not sent: example address';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Line breaks and other control characters never go into a subject line. */
export function cleanSubject(subject: string): string {
  return subject.replace(/\p{Cc}+/gu, ' ').replace(/ {2,}/g, ' ').trim();
}

/** A password email's data without its working link. */
const withoutToken = (data: Prisma.JsonValue) => ({ ...(data as Prisma.JsonObject), token: null }) as Prisma.InputJsonObject;
```

3. Replace

```ts
    const email = await prisma.email.findUniqueOrThrow({ where: { id } });

    let written: RenderedEmail;
```

with

```ts
    const email = await prisma.email.findUniqueOrThrow({ where: { id } });

    // The sample accounts' made-up addresses never go to a real email service.
    if (!transport.keepsCopies && isReservedAddress(email.toAddress)) {
      await prisma.email.update({
        where: { id },
        data: { status: 'SKIPPED', lastError: SKIPPED_NOTE, ...(email.kind === 'PASSWORD_RESET' && { data: withoutToken(email.data) }) },
      });
      continue;
    }

    let written: RenderedEmail;
```

4. Replace

```ts
    const copy = { subject: written.subject, html: written.html, textBody: written.text };

    try {
      await transport.send({ id, to: email.toAddress, from: env.EMAIL_FROM, ...written });
    } catch (error) {
      const retry = email.attempts < MAX_ATTEMPTS;
```

with

```ts
    const subject = cleanSubject(written.subject);
    const copy = { subject, html: written.html, textBody: written.text };

    try {
      await transport.send({ id, to: email.toAddress, from: env.EMAIL_FROM, subject, html: written.html, text: written.text });
    } catch (error) {
      const retry = email.attempts < MAX_ATTEMPTS;
      console.warn(`Email ${id} (${email.kind}) was not sent: ${messageOf(error)}${retry ? ' (will try again)' : ' (gave up)'}`);
```

5. Replace

```ts
          data: { ...(email.data as Prisma.JsonObject), token: null } as Prisma.InputJsonObject,
```

with

```ts
          data: withoutToken(email.data),
```

- [ ] **Step 6: Run the tests**

Run: `cd backend && npx vitest run tests/emailDelivery.test.ts && npm test && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/services/notifications/addresses.ts backend/src/services/notifications/emailDelivery.ts backend/tests/emailDelivery.test.ts
git commit -m "feat(email): skip made-up addresses, clean subjects and log failed sends without addresses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Reset links keep their secret after `#`

**Files:**
- Modify: `backend/src/services/notifications/emailTemplates.ts`, `backend/src/controllers/authController.ts`, `frontend/src/pages/ResetPasswordPage.tsx`
- Test: `backend/tests/emailTemplates.test.ts`, `backend/tests/passwordReset.test.ts`, `frontend/src/pages/ResetPasswordPage.test.tsx`

**Interfaces:**
- Produces: reset emails link to `/reset-password#token=<token>`; `POST /api/v1/auth/reset-password` answers with a `Set-Cookie` that clears `nk_refresh`.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/emailTemplates.test.ts`, change

```ts
    expect(email.text).toContain('Choose a new password: http://localhost:3000/reset-password?token=abc-DEF_123');
```

to

```ts
    expect(email.text).toContain('Choose a new password: http://localhost:3000/reset-password#token=abc-DEF_123');
```

In `backend/tests/passwordReset.test.ts`, add inside `describe('POST /auth/reset-password', ...)`:

```ts
  it('signs out the browser it was saved in, even if another account was signed in there', async () => {
    const jane = await register();
    await forgot('jane@example.com');

    const res = await request(app)
      .post(`${API}/auth/reset-password`)
      .set('Cookie', jane.refreshCookie)
      .send({ token: await latestToken(jane.userId), password: 'NewTacos5' });

    expect(res.status).toBe(200);
    expect(res.get('Set-Cookie')).toEqual([expect.stringMatching(/^nk_refresh=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT/)]);
  });
```

In `frontend/src/pages/ResetPasswordPage.test.tsx`:

1. Add after `LoginStub`:

```tsx
function AddressBar() {
  const location = useLocation()
  return <p>Address: {location.pathname + location.search + location.hash}</p>
}
```

2. In `renderAt`, change `<Route path="/reset-password" element={<ResetPasswordPage />} />` to

```tsx
        <Route
          path="/reset-password"
          element={
            <>
              <ResetPasswordPage />
              <AddressBar />
            </>
          }
        />
```

3. Add inside `describe('ResetPasswordPage', ...)`:

```tsx
  it('reads the token after the # in new emails', async () => {
    reset.mockResolvedValue(undefined)
    renderAt('/reset-password#token=abc123')

    submit('Tacos5ever', 'Tacos5ever')

    await screen.findByText('Login page: Your password was changed. Log in with your new password.')
    expect(reset).toHaveBeenCalledWith('abc123', 'Tacos5ever')
  })

  it('takes the token out of the address bar', async () => {
    renderAt('/reset-password#token=abc123')

    await screen.findByText('Address: /reset-password')
    screen.getByLabelText('New password')
  })
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run tests/emailTemplates.test.ts tests/passwordReset.test.ts` and `cd frontend && npx vitest run src/pages/ResetPasswordPage.test.tsx`
Expected: FAIL (`?token=` link; no `Set-Cookie`; the page ignores `#token=`).

- [ ] **Step 3: Change the link and clear the cookie**

In `backend/src/services/notifications/emailTemplates.ts`, change

```ts
    button: { label: 'Choose a new password', path: `/reset-password?token=${encodeURIComponent(data.token ?? '')}` },
```

to

```ts
    // After #, so the token never reaches a server log or another site's Referer.
    button: { label: 'Choose a new password', path: `/reset-password#token=${encodeURIComponent(data.token ?? '')}` },
```

In `backend/src/controllers/authController.ts`, replace

```ts
export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password);
  res.status(200).json(
```

with

```ts
export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.token, req.body.password);
  // Every session was logged out; this browser forgets its cookie too, whoever it belonged to.
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  res.status(200).json(
```

- [ ] **Step 4: Read the token from the fragment**

In `frontend/src/pages/ResetPasswordPage.tsx`:

1. Change the first imports to

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
```

2. Add after the `INCOMPLETE_LINK` constant:

```tsx
/** The token from the email link: after the # (emails from 2026-09-29 on) or in ?token= (older emails). */
function tokenFromLink(hash: string, search: string): string {
  return new URLSearchParams(hash.slice(1)).get('token') ?? new URLSearchParams(search).get('token') ?? ''
}
```

3. Replace

```tsx
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
```

with

```tsx
  const navigate = useNavigate()
  const location = useLocation()
  const [token] = useState(() => tokenFromLink(location.hash, location.search))
```

4. Add after the `useForm` call (before `const onSubmit`):

```tsx
  // Take the token out of the address bar, so it is not left in the history or in a shared screenshot.
  useEffect(() => {
    if (location.hash || location.search) navigate(location.pathname, { replace: true })
  }, [location.hash, location.search, location.pathname, navigate])
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && npx vitest run tests/emailTemplates.test.ts tests/passwordReset.test.ts` and `cd frontend && npx vitest run src/pages/ResetPasswordPage.test.tsx && npm run lint`
Expected: PASS (the older `?token=` tests still pass).

- [ ] **Step 6: Commit and end Part 2**

```bash
git add backend/src/services/notifications/emailTemplates.ts backend/src/controllers/authController.ts backend/tests/emailTemplates.test.ts backend/tests/passwordReset.test.ts frontend/src/pages/ResetPasswordPage.tsx frontend/src/pages/ResetPasswordPage.test.tsx
git commit -m "feat(auth): reset links carry the token after #, and saving signs this browser out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Run `npm test` in the repo root, then push. Tell the owner what Part 2 did in two plain sentences.

---

# Part 3: The preview, its sample data and photos

At the end of Part 3 a preview site shows its banner, the sample data can only load where it is allowed (once, on the preview), and the sample meals show free-license photos that ship with the app.

### Task 8: The preview banner

**Files:**
- Create: `frontend/src/components/layout/PreviewBanner.tsx`, `PreviewBanner.css`, `PreviewBanner.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: the `<meta name="nk-preview" content="true" />` tag from `pageHtml` (Task 2).
- Produces: `PreviewBanner` (default export) and `isPreviewSite(doc?: Document): boolean`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/PreviewBanner.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PreviewBanner from './PreviewBanner'

/** What the server adds to the page on the preview site. */
function markAsPreview() {
  const meta = document.createElement('meta')
  meta.name = 'nk-preview'
  meta.content = 'true'
  document.head.append(meta)
}

afterEach(() => {
  cleanup()
  document.head.querySelector('meta[name="nk-preview"]')?.remove()
})

describe('PreviewBanner', () => {
  it('tells visitors the preview takes practice orders only', () => {
    markAsPreview()

    render(<PreviewBanner />)

    expect(screen.getByRole('note').textContent).toBe('Preview: practice orders only. No food is made and no one is charged.')
  })

  it('shows nothing on the real site or in development', () => {
    const { container } = render(<PreviewBanner />)

    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd frontend && npx vitest run src/components/layout/PreviewBanner.test.tsx`
Expected: FAIL (the module does not exist).

- [ ] **Step 3: Write the banner**

Create `frontend/src/components/layout/PreviewBanner.tsx`:

```tsx
import './PreviewBanner.css'

/** True when the server marked this page as the preview site (backend/src/web/website.ts). */
export function isPreviewSite(doc: Document = document): boolean {
  return doc.querySelector('meta[name="nk-preview"]')?.getAttribute('content') === 'true'
}

/** A slim note at the top of every page of the show-and-tell preview. */
export default function PreviewBanner() {
  if (!isPreviewSite()) return null
  return (
    <div className="preview-banner" role="note">
      <strong>Preview:</strong> practice orders only. No food is made and no one is charged.
    </div>
  )
}
```

Create `frontend/src/components/layout/PreviewBanner.css`:

```css
.preview-banner {
  background: #fffbeb;
  border-bottom: 1px solid #f6e05e;
  color: #744210;
  font-size: 0.875rem;
  line-height: 1.4;
  padding: 0.5rem 1rem;
  text-align: center;
}
```

In `frontend/src/App.tsx`, add `import PreviewBanner from './components/layout/PreviewBanner'` after the `AppLayout` import, and change

```tsx
      <ScrollToTop />
      <Routes>
```

to

```tsx
      <ScrollToTop />
      {/* Above the routes, so the home page (which has its own layout) shows it too. */}
      <PreviewBanner />
      <Routes>
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/components/layout/PreviewBanner.test.tsx && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/PreviewBanner.tsx frontend/src/components/layout/PreviewBanner.css frontend/src/components/layout/PreviewBanner.test.tsx frontend/src/App.tsx
git commit -m "feat(web): preview banner on every page of the preview site

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Sample data only where it belongs

**Files:**
- Create: `backend/src/services/sampleData.ts`
- Modify: `backend/prisma/seed.ts`, `backend/package.json` (script)
- Test: `backend/tests/sampleData.test.ts` (new)

**Interfaces:**
- Consumes: `env.NODE_ENV`, `env.PREVIEW_MODE`, `env.DEMO_PASSWORD` (Task 1).
- Produces: `sampleDataPlan(config: Pick<Env, 'NODE_ENV' | 'PREVIEW_MODE' | 'DEMO_PASSWORD'>, run: { previewIfEmpty: boolean; sampleDataExists: boolean }): SampleDataPlan`, `SampleDataPlan = { action: 'load'; password } | { action: 'skip'; reason } | { action: 'refuse'; reason }`, `DEVELOPMENT_DEMO_PASSWORD`; npm script `db:seed:preview`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/sampleData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sampleDataPlan } from '../src/services/sampleData.js';

const development = { NODE_ENV: 'development' as const, PREVIEW_MODE: false, DEMO_PASSWORD: undefined };
const preview = { NODE_ENV: 'production' as const, PREVIEW_MODE: true, DEMO_PASSWORD: 'twelve-chars' };
const fullSeed = { previewIfEmpty: false, sampleDataExists: true };
const deploy = (sampleDataExists: boolean) => ({ previewIfEmpty: true, sampleDataExists });

describe('sampleDataPlan', () => {
  it('loads the samples on this computer with the usual password', () => {
    expect(sampleDataPlan(development, fullSeed)).toEqual({ action: 'load', password: 'Password123' });
    expect(sampleDataPlan({ ...development, DEMO_PASSWORD: 'mine' }, fullSeed)).toEqual({ action: 'load', password: 'mine' });
  });

  it('never loads them on the real live site', () => {
    expect(sampleDataPlan({ ...preview, PREVIEW_MODE: false }, fullSeed)).toEqual({
      action: 'refuse',
      reason: 'Sample data is never loaded on the live site.',
    });
  });

  it('does nothing at deploy time on a site that is not the preview', () => {
    expect(sampleDataPlan({ ...preview, PREVIEW_MODE: false }, deploy(false))).toEqual({
      action: 'skip',
      reason: 'This is not the preview site, so no sample data is loaded.',
    });
    expect(sampleDataPlan(development, deploy(false))).toEqual({
      action: 'skip',
      reason: 'This is not the preview site, so no sample data is loaded.',
    });
  });

  it('needs a private password of at least 12 characters on the preview site', () => {
    const refusal = { action: 'refuse', reason: 'Set DEMO_PASSWORD (at least 12 characters) before loading sample data on the preview site.' };

    expect(sampleDataPlan({ ...preview, DEMO_PASSWORD: undefined }, deploy(false))).toEqual(refusal);
    expect(sampleDataPlan({ ...preview, DEMO_PASSWORD: 'eleven-char' }, deploy(false))).toEqual(refusal);
    expect(sampleDataPlan(preview, deploy(false))).toEqual({ action: 'load', password: 'twelve-chars' });
  });

  it('loads them once on the preview, then keeps what happened since', () => {
    expect(sampleDataPlan(preview, deploy(true))).toEqual({ action: 'skip', reason: 'The sample data is already there.' });
  });

  it('can reload them on the preview by hand', () => {
    expect(sampleDataPlan(preview, fullSeed)).toEqual({ action: 'load', password: 'twelve-chars' });
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run tests/sampleData.test.ts`
Expected: FAIL (the module does not exist).

- [ ] **Step 3: Write the decision**

Create `backend/src/services/sampleData.ts`:

```ts
import type { Env } from '../config/env.js';

// The sample chefs, customers and orders (prisma/seed.ts) belong on this computer and on the preview site only.
// Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

export const DEVELOPMENT_DEMO_PASSWORD = 'Password123';
const MIN_PREVIEW_PASSWORD_LENGTH = 12;

export type SampleDataPlan =
  | { action: 'load'; password: string }
  | { action: 'skip'; reason: string }
  | { action: 'refuse'; reason: string };

/**
 * Whether the seed may load the sample data, and with which password.
 * previewIfEmpty is the deploy-time run (Railway's pre-deploy command); sampleDataExists is true when
 * any @neighborskitchen.test account is already in the database.
 */
export function sampleDataPlan(
  config: Pick<Env, 'NODE_ENV' | 'PREVIEW_MODE' | 'DEMO_PASSWORD'>,
  run: { previewIfEmpty: boolean; sampleDataExists: boolean },
): SampleDataPlan {
  if (run.previewIfEmpty && !config.PREVIEW_MODE) {
    return { action: 'skip', reason: 'This is not the preview site, so no sample data is loaded.' };
  }
  if (config.NODE_ENV === 'production') {
    if (!config.PREVIEW_MODE) return { action: 'refuse', reason: 'Sample data is never loaded on the live site.' };
    if ((config.DEMO_PASSWORD ?? '').length < MIN_PREVIEW_PASSWORD_LENGTH) {
      return {
        action: 'refuse',
        reason: `Set DEMO_PASSWORD (at least ${MIN_PREVIEW_PASSWORD_LENGTH} characters) before loading sample data on the preview site.`,
      };
    }
  }
  if (run.previewIfEmpty && run.sampleDataExists) return { action: 'skip', reason: 'The sample data is already there.' };
  return { action: 'load', password: config.DEMO_PASSWORD ?? DEVELOPMENT_DEMO_PASSWORD };
}
```

- [ ] **Step 4: Use it in the seed**

In `backend/prisma/seed.ts`:

1. Replace the header comment (lines 1-9) with:

```ts
// Sample data: demo chefs with menus, demo customers, past orders with reviews, and dish requests with votes.
// Safe to run more than once - existing demo records are updated, not duplicated.
//
//   npm run db:seed              load (or refresh) the samples
//   npm run db:seed:preview      the preview site's deploy step: load them only if they are not there yet
//
// It runs on this computer and on the preview site only (see src/services/sampleData.ts). Demo accounts
// use Password123 here and the private DEMO_PASSWORD on the preview site. Emails use the reserved .test
// domain, so no real inbox can ever receive mail sent to them.
```

(The TheMealDB line goes; Task 10 replaces the photos.)

2. Add `import { env } from '../src/config/env.js';` right after the `@prisma/client` import, and `import { DEVELOPMENT_DEMO_PASSWORD, sampleDataPlan } from '../src/services/sampleData.js';` right after the `bellText.js` import. `import 'dotenv/config';` must stay the first import, so `.env` is read before the settings are.

3. Delete `const DEMO_PASSWORD = 'Password123';`.
4. Replace the start of `main()`

```ts
async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
```

with

```ts
async function main() {
  const previewIfEmpty = process.argv.includes('--preview-if-empty');
  const sampleDataExists = (await prisma.user.count({ where: { email: { endsWith: '@neighborskitchen.test' } } })) > 0;
  const plan = sampleDataPlan(env, { previewIfEmpty, sampleDataExists });
  if (plan.action === 'skip') {
    console.log(plan.reason);
    return;
  }
  if (plan.action === 'refuse') throw new Error(plan.reason);
  const passwordHash = await bcrypt.hash(plan.password, 12);
```

5. Replace

```ts
  console.log(`Demo logins (password for all: ${DEMO_PASSWORD}):`);
```

with

```ts
  // The preview site's password is private: never print it.
  console.log(
    plan.password === DEVELOPMENT_DEMO_PASSWORD
      ? `Demo logins (password for all: ${DEVELOPMENT_DEMO_PASSWORD}):`
      : 'Demo logins (password for all: the DEMO_PASSWORD setting):',
  );
```

In `backend/package.json`, add after `"db:seed": "tsx prisma/seed.ts",`:

```json
    "db:seed:preview": "tsx prisma/seed.ts --preview-if-empty",
```

- [ ] **Step 5: Run the tests and try the seed**

Run: `cd backend && npx vitest run tests/sampleData.test.ts && npx tsc --noEmit -p .`
Expected: PASS.

Then run `npm run db:seed:preview`. Expected: `This is not the preview site, so no sample data is loaded.` (`PREVIEW_MODE` is off here.)

Then run `npm run db:seed`. Expected: the usual summary ending with the demo logins and `Password123`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/sampleData.ts backend/prisma/seed.ts backend/package.json backend/tests/sampleData.test.ts
git commit -m "feat(api): sample data only on this computer and the preview site, with a private preview password

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Free-license sample photos that ship with the app

**Files:**
- Create: `backend/src/services/samplePhotos.ts`, `backend/scripts/prepare-sample-photos.ts`, `backend/prisma/sample-photos/*.webp` (35) + `CREDITS.md`
- Modify: `backend/src/app.ts`, `backend/prisma/seed.ts`
- Test: `backend/tests/samplePhotos.test.ts` (new)

**Interfaces:**
- Consumes: `isUploadedMealPhotoUrl` (`services/uploadService.ts`), `createApp` (Tasks 2-3).
- Produces: `SAMPLE_PHOTOS_DIR`, `samplePhotoId(mealName): string`, `samplePhotoUrl(mealName): string` in `src/services/samplePhotos.ts`; sample photos served at `/uploads/meals/<id>.webp`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/samplePhotos.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { samplePhotoId, samplePhotoUrl } from '../src/services/samplePhotos.js';
import { isUploadedMealPhotoUrl } from '../src/services/uploadService.js';

describe('sample meal photos', () => {
  it('have a fixed, upload-shaped address for each sample meal', () => {
    expect(samplePhotoId('Beef Pho')).toBe('62576e04-b770-84a1-e886-d668ce2521c1');
    expect(samplePhotoUrl('Chicken Enchilada Casserole')).toBe('/uploads/meals/24180d31-378c-c867-2a7f-a4e36d920cbe.webp');
    expect(isUploadedMealPhotoUrl(samplePhotoUrl('Beef Pho'))).toBe(true);
  });

  it('are served from the photos that ship with the app', async () => {
    const res = await request(createApp()).get('/uploads/meals/62576e04-b770-84a1-e886-d668ce2521c1.webp');

    expect(res.status).toBe(200);
    expect(res.get('Content-Type')).toBe('image/webp');
    expect(res.get('Cache-Control')).toBe('public, max-age=2592000, immutable');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd backend && npx vitest run tests/samplePhotos.test.ts`
Expected: FAIL (the module does not exist).

- [ ] **Step 3: Write the photo names and serve the folder**

Create `backend/src/services/samplePhotos.ts`:

```ts
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// The sample meals' photos ship with the app: free-license stock photos (see prisma/sample-photos/CREDITS.md).

/** backend/prisma/sample-photos, found relative to this file (the same depth from src/ and from dist/). */
export const SAMPLE_PHOTOS_DIR = fileURLToPath(new URL('../../prisma/sample-photos', import.meta.url));

/** A fixed file name shaped like an uploaded photo's, so a sample meal's photo passes isUploadedMealPhotoUrl. */
export function samplePhotoId(mealName: string): string {
  const hex = createHash('sha256').update(`neighbors-kitchen sample photo: ${mealName}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const samplePhotoUrl = (mealName: string) => `/uploads/meals/${samplePhotoId(mealName)}.webp`;
```

In `backend/src/app.ts`, add `import { SAMPLE_PHOTOS_DIR } from './services/samplePhotos.js';` after the routes import, and after

```ts
  app.use('/uploads', express.static(env.UPLOAD_DIR, { index: false, immutable: true, maxAge: '30d' }));
```

add

```ts
  // The sample meals' photos ship with the app (prisma/sample-photos); an uploaded photo with the same name would win.
  app.use('/uploads/meals', express.static(SAMPLE_PHOTOS_DIR, { index: false, immutable: true, maxAge: '30d' }));
```

- [ ] **Step 4: Write the photo preparation script**

Create `backend/scripts/prepare-sample-photos.ts`:

```ts
// Turns downloaded stock photos into the sample meal photos the app ships (prisma/sample-photos).
//
//   npx tsx scripts/prepare-sample-photos.ts <folder with the downloads>
//
// The folder holds the downloaded files and sources.json, one entry per sample meal:
//   [{ "meal": "Beef Pho", "file": "beef-pho.jpg", "page": "https://unsplash.com/photos/...",
//      "photographer": "Name", "license": "Unsplash License" }]
// Each photo is turned upright, fitted within 1200 x 1200, saved as WebP without its hidden details (EXIF),
// and named with samplePhotoId(meal). CREDITS.md is written from sources.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SAMPLE_PHOTOS_DIR, samplePhotoId } from '../src/services/samplePhotos.js';

interface PhotoSource {
  meal: string;
  file: string;
  page: string;
  photographer: string;
  license: 'Unsplash License' | 'Pexels License';
}

const folder = process.argv[2];
if (!folder) throw new Error('Usage: npx tsx scripts/prepare-sample-photos.ts <folder with the downloads>');
const sources = JSON.parse(readFileSync(path.join(folder, 'sources.json'), 'utf8')) as PhotoSource[];

mkdirSync(SAMPLE_PHOTOS_DIR, { recursive: true });
for (const source of sources) {
  await sharp(path.join(folder, source.file))
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(SAMPLE_PHOTOS_DIR, `${samplePhotoId(source.meal)}.webp`));
}

const rows = sources.map(
  (source) => `| ${source.meal} | \`${samplePhotoId(source.meal)}.webp\` | [photo page](${source.page}) | ${source.photographer} | ${source.license} |`,
);
writeFileSync(
  path.join(SAMPLE_PHOTOS_DIR, 'CREDITS.md'),
  [
    '# Sample meal photos',
    '',
    'Free-license stock photos for the sample meals (this computer and the preview site). Food only, no people.',
    'Unsplash License: https://unsplash.com/license. Pexels License: https://www.pexels.com/license/',
    '',
    '| Meal | File | Source | Photographer | License |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n'),
);
console.log(`Prepared ${sources.length} photos in ${SAMPLE_PHOTOS_DIR}`);
```

- [ ] **Step 5: Find the photos**

Dispatch one research subagent (general-purpose, sonnet) with this brief:

> For each of these 35 dishes, find one photo on Unsplash (free photos under the Unsplash License, never Unsplash+ / plus.unsplash.com) or Pexels (Pexels License) that clearly shows that dish, looks home-cooked, and contains food only: no people, no hands if avoidable, no brand logos or text. Prefer landscape. For each, return JSON: `{ "meal": <exact dish name>, "page": <photo page URL>, "download": <direct image URL at about 1600-2400 px wide: images.unsplash.com/...?w=2000 or images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?w=2000>, "photographer": <name as credited>, "license": "Unsplash License" | "Pexels License" }`. Verify each page loads and names the license. Dishes: Chicken Enchilada Casserole, Smoky Chickpea Fajitas, Mexican Rice & Charro Beans, Churros with Chocolate Sauce, Chicken Katsu Curry, Honey Teriyaki Salmon, Homestyle Sushi Platter, Shoyu Ramen with Soft Egg, Chicken Shawarma Plate, Falafel Pita with Tahini, Shakshuka, Hummus & Warm Pita, Honey Pistachio Baklava, Lasagna Bolognese, Spaghetti alla Carbonara, Penne Arrabbiata, Ricotta Cheesecake, Southern Fried Chicken, Skillet Pork Chops with Sweet Potatoes, Baked Mac and Cheese, Peach Cobbler, Matar Paneer, Dal Fry with Basmati Rice, Lamb Biryani, Rajma Kidney Bean Curry, Mango Lassi, Beef Pho, Lemongrass Beef Noodles, Tofu Banh Mi, Herb Noodle Salad Bowl, Quinoa & Black Bean Stuffed Peppers, "Tofu, Greens & Cashew Stir-Fry", Smoky Lentil Chili with Squash, Oatmeal Pancakes, Chocolate Avocado Mousse. Return the 35 entries as one JSON array and nothing else.

Check the list: 35 entries, exact dish names (compare with `grep -n "        name: '" backend/prisma/seed.ts`), no `plus.unsplash.com`, every license named.

- [ ] **Step 6: Ask the owner, then download**

Ask the owner in chat, one question: "OK to download 35 free-license food photos (about 0.5-3 MB each, from images.unsplash.com and images.pexels.com) into a temporary folder on your Mac, to turn into the sample meal photos?" Wait for a clear yes.

Then, with `SRC=<scratchpad>/sample-photos-src`:

```bash
mkdir -p "$SRC"
# For each entry: curl -fsSL -o "$SRC/<slug>.jpg" "<download URL>"   (slug = the dish name in lower case, words joined by -)
```

Write `$SRC/sources.json` (the subagent's entries, with `download` replaced by `"file": "<slug>.jpg"`). Look at a few downloads with the Read tool to confirm they show the right dish. Replace any that don't with another photo (same rules).

- [ ] **Step 7: Prepare the photos and point the seed at them**

Run: `cd backend && npx tsx scripts/prepare-sample-photos.ts "$SRC"`
Expected: `Prepared 35 photos in .../backend/prisma/sample-photos`; `ls prisma/sample-photos | wc -l` prints 36 (35 WebP + CREDITS.md); `du -sh prisma/sample-photos` stays under 8 MB.

In `backend/prisma/seed.ts`:

1. Add the imports

```ts
import { existsSync } from 'node:fs';
import path from 'node:path';
```

right after `import 'dotenv/config';`, and

```ts
import { SAMPLE_PHOTOS_DIR, samplePhotoId, samplePhotoUrl } from '../src/services/samplePhotos.js';
```

after the `sampleData.js` import.

2. Delete the `photo` helper line (`const photo = (file: string) => ...`).
3. Delete the `imageUrl: string;` field from `interface SeedMeal`, and delete every `imageUrl: photo('...'),` line in the meal lists (35 lines):

```bash
cd backend && sed -i '' "/^        imageUrl: photo('/d" prisma/seed.ts && grep -c "photo('" prisma/seed.ts
```

The count must print 0.

4. In `seedChef`, replace

```ts
  for (const meal of meals) {
    const existingMeal = await prisma.meal.findFirst({ where: { chefId: chefProfile.id, name: meal.name } });
    if (existingMeal) {
      await prisma.meal.update({ where: { id: existingMeal.id }, data: { ...meal, menuId: menu.id, isAvailable: true } });
    } else {
      await prisma.meal.create({ data: { ...meal, menuId: menu.id, chefId: chefProfile.id } });
    }
  }
```

with

```ts
  for (const meal of meals) {
    const withPhoto = { ...meal, imageUrl: samplePhotoUrl(meal.name) };
    const existingMeal = await prisma.meal.findFirst({ where: { chefId: chefProfile.id, name: meal.name } });
    if (existingMeal) {
      await prisma.meal.update({ where: { id: existingMeal.id }, data: { ...withPhoto, menuId: menu.id, isAvailable: true } });
    } else {
      await prisma.meal.create({ data: { ...withPhoto, menuId: menu.id, chefId: chefProfile.id } });
    }
  }
```

5. In `main()`, right after `const passwordHash = await bcrypt.hash(plan.password, 12);`, add:

```ts
  const missingPhotos = chefs
    .flatMap((chef) => chef.meals)
    .filter((meal) => !existsSync(path.join(SAMPLE_PHOTOS_DIR, `${samplePhotoId(meal.name)}.webp`)))
    .map((meal) => meal.name);
  if (missingPhotos.length > 0) throw new Error(`Missing sample photos for: ${missingPhotos.join(', ')}`);
```

- [ ] **Step 8: Run the tests and reseed**

Run: `cd backend && npx vitest run tests/samplePhotos.test.ts && npm test && npx tsc --noEmit -p . && npm run db:seed`
Expected: PASS; the seed prints its usual summary. `grep -rni themealdb --exclude-dir=node_modules --exclude-dir=.git .` (from the repo root) prints only lines in `docs/`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/samplePhotos.ts backend/scripts/prepare-sample-photos.ts backend/prisma/sample-photos backend/prisma/seed.ts backend/src/app.ts backend/tests/samplePhotos.test.ts
git commit -m "feat(api): free-license sample meal photos that ship with the app, replacing TheMealDB

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Run `npm test` in the repo root, then push (end of Part 3). Tell the owner what Part 3 did in two plain sentences.

---

# Part 4: Leftovers a demo could run into

### Task 11: The bell count and cart after signing out

**Files:**
- Modify: `frontend/src/store/notificationStore.ts`, `frontend/src/services/authService.ts`, `frontend/src/pages/ResetPasswordPage.tsx`
- Test: `frontend/src/store/notificationStore.test.ts` (new), `frontend/src/pages/ResetPasswordPage.test.tsx`

**Interfaces:**
- Produces: `forgetSession(): void` in `services/authService.ts` (clears the session and the cart). The bell count now resets whenever the signed-in account changes.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/store/notificationStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { User } from '../types/user.types'
import { useAuthStore } from './authStore'
import { useNotificationStore } from './notificationStore'

const person = (id: string): User => ({
  id,
  email: `${id}@example.com`,
  role: 'CUSTOMER',
  firstName: 'Chris',
  lastName: 'Walker',
  phone: null,
  profilePhotoUrl: null,
  emailVerified: false,
  createdAt: '2026-09-01T00:00:00.000Z',
})

beforeEach(() => {
  useAuthStore.setState({ user: person('user-1'), accessToken: 'token-1', status: 'authenticated' })
  useNotificationStore.setState({ unreadCount: 3 })
})

describe('the bell count', () => {
  it('is forgotten when the person signs out', () => {
    useAuthStore.getState().clearSession()

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('is forgotten when someone else signs in', () => {
    useAuthStore.getState().setSession(person('user-2'), 'token-2')

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('stays when the same person gets a fresh token', () => {
    useAuthStore.getState().setSession(person('user-1'), 'token-3')

    expect(useNotificationStore.getState().unreadCount).toBe(3)
  })
})
```

In `frontend/src/pages/ResetPasswordPage.test.tsx`, add the imports

```tsx
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
```

and this test:

```tsx
  it("forgets this device's session and cart once the password is saved", async () => {
    reset.mockResolvedValue(undefined)
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token',
      user: {
        id: 'user-1',
        email: 'chris@example.com',
        role: 'CUSTOMER',
        firstName: 'Chris',
        lastName: 'Walker',
        phone: null,
        profilePhotoUrl: null,
        emailVerified: false,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    })
    useCartStore.getState().add({ id: 'chef-1', name: "Abuela's Table" }, { mealId: 'meal-1', name: 'Churros', price: 6, imageUrl: null }, 2)
    renderAt('/reset-password#token=abc123')

    submit('Tacos5ever', 'Tacos5ever')

    await screen.findByText('Login page: Your password was changed. Log in with your new password.')
    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useCartStore.getState().items).toEqual([])
  })
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd frontend && npx vitest run src/store/notificationStore.test.ts src/pages/ResetPasswordPage.test.tsx`
Expected: FAIL (the count stays 3; the cart keeps its item).

- [ ] **Step 3: Reset the count when the account changes**

Replace the whole of `frontend/src/store/notificationStore.ts` with:

```ts
import { create } from 'zustand'
import { useAuthStore } from './authStore'

interface NotificationState {
  /** How many notifications are unread; shown on the bell. */
  unreadCount: number
  setUnreadCount: (unreadCount: number) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
}))

// Someone signed out, or someone else signed in: the old count belongs to another person.
useAuthStore.subscribe((state, previous) => {
  if ((state.user?.id ?? null) !== (previous.user?.id ?? null)) useNotificationStore.getState().setUnreadCount(0)
})
```

- [ ] **Step 4: One way to forget a session**

In `frontend/src/services/authService.ts`, replace

```ts
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    useAuthStore.getState().clearSession()
    // Do not leave a cart behind for the next person on a shared device.
    useCartStore.getState().clear()
  }
}
```

with

```ts
/** Forgets the signed-in person on this device: the session and the cart (the bell count follows the session). */
export function forgetSession(): void {
  useAuthStore.getState().clearSession()
  // Do not leave a cart behind for the next person on a shared device.
  useCartStore.getState().clear()
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    forgetSession()
  }
}
```

In `frontend/src/pages/ResetPasswordPage.tsx`, replace `import { useAuthStore } from '../store/authStore'` with `import { forgetSession } from '../services/authService'`, and replace

```tsx
      // The server logged out every session; forget this one too.
      useAuthStore.getState().clearSession()
```

with

```tsx
      // The server logged out every session; forget this one (and its cart) too.
      forgetSession()
```

- [ ] **Step 5: Run the tests**

Run: `cd frontend && npx vitest run src/store/notificationStore.test.ts src/pages/ResetPasswordPage.test.tsx src/components/notifications && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store/notificationStore.ts frontend/src/store/notificationStore.test.ts frontend/src/services/authService.ts frontend/src/pages/ResetPasswordPage.tsx frontend/src/pages/ResetPasswordPage.test.tsx
git commit -m "fix(web): the bell count and cart never carry over to the next person

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Links keep their place through the login page

**Files:**
- Modify: `frontend/src/components/auth/RouteGuards.tsx`, `frontend/src/components/feedback/DishRequests.tsx`
- Test: `frontend/src/components/auth/RouteGuards.test.tsx` (new), `frontend/src/components/feedback/DishRequests.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/auth/RouteGuards.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, it } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import { ProtectedRoute } from './RouteGuards'

function Address() {
  const location = useLocation()
  return <p>At {location.pathname + location.search + location.hash}</p>
}

afterEach(cleanup)

describe('ProtectedRoute', () => {
  it('sends visitors to log in, keeping the #section they asked for', () => {
    useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null })

    render(
      <MemoryRouter initialEntries={['/account#email-settings']}>
        <Routes>
          <Route path="/account" element={<ProtectedRoute><p>Account</p></ProtectedRoute>} />
          <Route path="/login" element={<Address />} />
        </Routes>
      </MemoryRouter>,
    )

    screen.getByText('At /login?redirect=%2Faccount%23email-settings')
  })
})
```

In `frontend/src/components/feedback/DishRequests.test.tsx`:

1. Add to the `beforeEach`:

```tsx
  // jsdom has no scrolling.
  Element.prototype.scrollIntoView = vi.fn()
```

2. Add this test inside `describe('DishRequests', ...)`:

```tsx
  it('keeps the place in the page when sending a visitor to log in', async () => {
    vi.mocked(fetchChefSuggestions).mockResolvedValue([])

    render(
      <MemoryRouter initialEntries={['/chefs/chef-1#requests-heading']}>
        <DishRequests chefId="chef-1" kitchenName="Abuela's Table" isOwnKitchen={false} />
      </MemoryRouter>,
    )

    expect((await screen.findByRole('link', { name: 'Log in' })).getAttribute('href')).toBe('/login?redirect=%2Fchefs%2Fchef-1%23requests-heading')
  })
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd frontend && npx vitest run src/components/auth/RouteGuards.test.tsx src/components/feedback/DishRequests.test.tsx`
Expected: FAIL (the `#...` part is dropped).

- [ ] **Step 3: Keep the hash**

In `frontend/src/components/auth/RouteGuards.tsx`, change

```tsx
    const redirect = encodeURIComponent(location.pathname + location.search)
```

to

```tsx
    // Keep the #section too: email links such as /account#email-settings land where they point after logging in.
    const redirect = encodeURIComponent(location.pathname + location.search + location.hash)
```

In `frontend/src/components/feedback/DishRequests.tsx`, change

```tsx
  const loginLink = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`
```

to

```tsx
  const loginLink = `/login?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/components/auth src/components/feedback src/utils/safeRedirect.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/RouteGuards.tsx frontend/src/components/auth/RouteGuards.test.tsx frontend/src/components/feedback/DishRequests.tsx frontend/src/components/feedback/DishRequests.test.tsx
git commit -m "fix(web): links keep their #section through the login page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Dish-request links open the requests

**Files:**
- Modify: `backend/src/services/notifications/bellText.ts`, `backend/src/services/notifications/emailTemplates.ts`
- Test: `backend/tests/notificationText.test.ts`, `backend/tests/emailTemplates.test.ts`, `backend/tests/feedbackNotifications.test.ts`

- [ ] **Step 1: Write the failing tests**

In `backend/tests/notificationText.test.ts`, add after the test `words dish-request answers like the website does, linking to the requests`:

```ts
  it("opens the chef's dish requests tab for a new request", () => {
    expect(bellText('NEW_DISH_REQUEST', sampleRequest)).toEqual({
      title: 'New dish request: Birria tacos',
      body: 'From Dana K.',
      link: '/chef/feedback?view=requests',
    });
  });
```

In `backend/tests/emailTemplates.test.ts`, add inside `describe('renderEmail', ...)`:

```ts
  it('links dish-request emails to the requests', () => {
    expect(renderEmail('NEW_DISH_REQUEST', sampleRequest).text).toContain('Answer the request: http://localhost:3000/chef/feedback?view=requests');
    expect(renderEmail('DISH_REQUEST_ACCEPTED', { ...sampleRequest, status: 'ACCEPTED' }).text).toContain(
      "See Abuela's Table: http://localhost:3000/chefs/chef-1#requests-heading",
    );
  });
```

In `backend/tests/feedbackNotifications.test.ts`, change

```ts
      { kind: 'NEW_DISH_REQUEST', title: 'New dish request: Birria tacos', body: 'From Dana K.', link: '/chef/feedback' },
```

to

```ts
      { kind: 'NEW_DISH_REQUEST', title: 'New dish request: Birria tacos', body: 'From Dana K.', link: '/chef/feedback?view=requests' },
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd backend && npx vitest run tests/notificationText.test.ts tests/emailTemplates.test.ts tests/feedbackNotifications.test.ts`
Expected: FAIL on the three changed expectations.

- [ ] **Step 3: Change the links**

In `backend/src/services/notifications/bellText.ts`, add after `const CHEF_FEEDBACK = '/chef/feedback';`:

```ts
const CHEF_REQUESTS = '/chef/feedback?view=requests';
```

and change the `NEW_DISH_REQUEST` entry's `link: CHEF_FEEDBACK` to `link: CHEF_REQUESTS`.

In `backend/src/services/notifications/emailTemplates.ts`, change

```ts
    button: { label: `See ${data.kitchenName}`, path: `/chefs/${data.chefId}` },
```

to

```ts
    button: { label: `See ${data.kitchenName}`, path: `/chefs/${data.chefId}#requests-heading` },
```

and

```ts
    button: { label: 'Answer the request', path: '/chef/feedback' },
```

to

```ts
    button: { label: 'Answer the request', path: '/chef/feedback?view=requests' },
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && npm test && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications/bellText.ts backend/src/services/notifications/emailTemplates.ts backend/tests/notificationText.test.ts backend/tests/emailTemplates.test.ts backend/tests/feedbackNotifications.test.ts
git commit -m "fix(api): dish-request notices open the requests, not the reviews

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Scroll to the dish requests once they have loaded

**Files:**
- Modify: `frontend/src/components/feedback/DishRequests.tsx`
- Test: `frontend/src/components/feedback/DishRequests.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/feedback/DishRequests.test.tsx`, add inside `describe('DishRequests', ...)`:

```tsx
  it('scrolls to the requests once they have loaded, when a link asks for them', async () => {
    let answer: (items: Suggestion[]) => void = () => {}
    vi.mocked(fetchChefSuggestions).mockReturnValue(new Promise((resolve) => (answer = resolve)))

    render(
      <MemoryRouter initialEntries={['/chefs/chef-1#requests-heading']}>
        <DishRequests chefId="chef-1" kitchenName="Abuela's Table" isOwnKitchen={false} />
      </MemoryRouter>,
    )
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    answer([suggestion()])

    await screen.findByText('Birria tacos')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd frontend && npx vitest run src/components/feedback/DishRequests.test.tsx`
Expected: FAIL (`scrollIntoView` never called).

- [ ] **Step 3: Scroll after loading**

In `frontend/src/components/feedback/DishRequests.tsx`, change `import { useState } from 'react'` to `import { useEffect, useState } from 'react'`, and add after the `items` constant:

```tsx
  // Bell items and emails link to #requests-heading. The page's own scroll happens before the requests are
  // on the page, so scroll here once they have loaded (AccountPage does the same for #email-settings).
  const requestsLoaded = requests.data !== undefined
  useEffect(() => {
    if (requestsLoaded && location.hash === '#requests-heading') document.getElementById('requests-heading')?.scrollIntoView()
  }, [requestsLoaded, location.hash])
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/components/feedback && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/feedback/DishRequests.tsx frontend/src/components/feedback/DishRequests.test.tsx
git commit -m "fix(web): links to a kitchen's dish requests scroll there once they have loaded

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: The delivery distance menu shows the real value

**Files:**
- Create: `frontend/src/utils/deliveryRadius.ts`, `frontend/src/utils/deliveryRadius.test.ts`
- Modify: `frontend/src/components/chef/KitchenProfileForm.tsx`

**Interfaces:**
- Produces: `RADIUS_OPTIONS`, `radiusOptions(current?: number): number[]`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/deliveryRadius.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { radiusOptions } from './deliveryRadius'

describe('radiusOptions', () => {
  it('offers the usual distances', () => {
    expect(radiusOptions()).toEqual([2, 5, 10, 15, 25])
    expect(radiusOptions(10)).toEqual([2, 5, 10, 15, 25])
  })

  it("adds the kitchen's own distance when it is not one of them", () => {
    expect(radiusOptions(8)).toEqual([2, 5, 8, 10, 15, 25])
    expect(radiusOptions(7.5)).toEqual([2, 5, 7.5, 10, 15, 25])
    expect(radiusOptions(30)).toEqual([2, 5, 10, 15, 25, 30])
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd frontend && npx vitest run src/utils/deliveryRadius.test.ts`
Expected: FAIL (the module does not exist).

- [ ] **Step 3: Write the helper and use it**

Create `frontend/src/utils/deliveryRadius.ts`:

```ts
/** The delivery distances a chef picks from, in miles. */
export const RADIUS_OPTIONS = [2, 5, 10, 15, 25]

/** The menu's choices, including the kitchen's current distance when it is not one of them (e.g. 8 miles). */
export function radiusOptions(current?: number): number[] {
  if (current === undefined || RADIUS_OPTIONS.includes(current)) return RADIUS_OPTIONS
  return [...RADIUS_OPTIONS, current].sort((a, b) => a - b)
}
```

In `frontend/src/components/chef/KitchenProfileForm.tsx`:

1. Add `import { radiusOptions } from '../../utils/deliveryRadius'` after the `getApiError` import.
2. Delete `const RADIUS_OPTIONS = [2, 5, 10, 15, 25]`.
3. Change `{RADIUS_OPTIONS.map((miles) => (` to `{radiusOptions(initialKitchen?.serviceRadiusMiles).map((miles) => (`.

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/utils/deliveryRadius.test.ts && npm run lint && npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/deliveryRadius.ts frontend/src/utils/deliveryRadius.test.ts frontend/src/components/chef/KitchenProfileForm.tsx
git commit -m "fix(web): the delivery distance menu shows a kitchen's own distance, such as 8 miles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: "Use my location" gives up after 15 seconds

**Files:**
- Modify: `frontend/src/components/location/NearMeForm.tsx`
- Test: `frontend/src/components/location/NearMeForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `frontend/src/components/location/NearMeForm.test.tsx`, change the imports to

```tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

change `afterEach(cleanup)` to

```tsx
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
```

and add inside `describe('NearMeForm', ...)`:

```tsx
  it('gives up after 15 seconds when the browser never answers, such as an ignored permission prompt', () => {
    vi.useFakeTimers()
    getCurrentPosition.mockImplementation(() => {})
    renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    expect(screen.getByRole('button', { name: 'Finding you...' })).toHaveProperty('disabled', true)
    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(screen.getByRole('alert').textContent).toBe('We could not get your location. Type your ZIP code instead.')
    expect(screen.getByRole('button', { name: 'Use my location' })).toHaveProperty('disabled', false)
  })

  it('ignores a location that arrives after giving up', () => {
    vi.useFakeTimers()
    let answer: PositionCallback = () => {}
    getCurrentPosition.mockImplementation((found: PositionCallback) => {
      answer = found
    })
    const onChoose = renderForm()

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    act(() => answer({ coords: { latitude: 34.055216, longitude: -117.182488 } } as GeolocationPosition))

    expect(onChoose).not.toHaveBeenCalled()
  })

  it('does nothing when the answer comes after leaving the page', () => {
    let answer: PositionCallback = () => {}
    getCurrentPosition.mockImplementation((found: PositionCallback) => {
      answer = found
    })
    const onChoose = vi.fn()
    const { unmount } = render(<NearMeForm onChoose={onChoose} initialZip="" />)

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    unmount()
    answer({ coords: { latitude: 34.055216, longitude: -117.182488 } } as GeolocationPosition)

    expect(onChoose).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `cd frontend && npx vitest run src/components/location/NearMeForm.test.tsx`
Expected: FAIL (the button stays on "Finding you..."; late answers still call `onChoose`).

- [ ] **Step 3: Add the backup timer**

In `frontend/src/components/location/NearMeForm.tsx`:

1. Change `import { useId, useState, type FormEvent } from 'react'` to `import { useEffect, useId, useRef, useState, type FormEvent } from 'react'`.
2. Replace `const LOCATION_TIMEOUT_MS = 10_000` with:

```tsx
const LOCATION_TIMEOUT_MS = 10_000
// Browsers do not count the time a permission prompt waits for an answer, so an ignored prompt never
// calls back. Give up after this long either way.
const LOCATION_GIVE_UP_MS = 15_000
const LOCATION_ERROR = 'We could not get your location. Type your ZIP code instead.'
```

3. After `const canLocate = ...`, add:

```tsx
  // The give-up timer of the location request still waiting for an answer, if any.
  const pending = useRef<number | null>(null)
  useEffect(
    () => () => {
      // Leaving the page: forget the request, so a late answer does nothing.
      if (pending.current !== null) window.clearTimeout(pending.current)
      pending.current = null
    },
    [],
  )
```

4. Replace the whole `locate` function with:

```tsx
  const locate = () => {
    setError(null)
    setLocating(true)
    /** Ends this request; false when it already ended (gave up, answered, or the page was left). */
    const finish = () => {
      if (pending.current !== timer) return false
      window.clearTimeout(timer)
      pending.current = null
      setLocating(false)
      return true
    }
    const fail = () => {
      if (finish()) setError(LOCATION_ERROR)
    }
    const timer = window.setTimeout(fail, LOCATION_GIVE_UP_MS)
    pending.current = timer
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!finish()) return
        onChoose({
          kind: 'here',
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        })
      },
      fail,
      { timeout: LOCATION_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
    )
  }
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/components/location && npm run lint`
Expected: PASS (the four older tests still pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/location/NearMeForm.tsx frontend/src/components/location/NearMeForm.test.tsx
git commit -m "fix(web): \"Use my location\" gives up after 15 seconds and ignores late answers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 17: The chosen distance stays when changing place

**Files:**
- Modify: `frontend/src/utils/location.ts`, `frontend/src/pages/ChefsPage.tsx`
- Test: `frontend/src/utils/location.test.ts`

**Interfaces:**
- Produces: `choosePlaceParams(next: SearchPlace, previous: SearchPlace | null, maxDistance: string): Record<string, string | null>`.

- [ ] **Step 1: Write the failing test**

In `frontend/src/utils/location.test.ts`, add `choosePlaceParams,` to the import list (keep it alphabetical: before `describePlace`), and add at the end:

```ts
describe('choosePlaceParams', () => {
  const zip = { kind: 'zip', zip: '92262' } as const
  const here = { kind: 'here', latitude: 34.06, longitude: -117.18 } as const

  it('starts the first search within 25 miles', () => {
    expect(choosePlaceParams(zip, null, '')).toEqual({ near: '92262', lat: null, lng: null, maxDistance: '25' })
  })

  it('keeps the chosen distance for a new place', () => {
    expect(choosePlaceParams(zip, here, '10')).toEqual({ near: '92262', lat: null, lng: null, maxDistance: '10' })
  })

  it('keeps "Any distance" for a new place', () => {
    expect(choosePlaceParams(here, zip, '')).toEqual({ near: null, lat: '34.06', lng: '-117.18', maxDistance: null })
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd frontend && npx vitest run src/utils/location.test.ts`
Expected: FAIL (`choosePlaceParams` is not exported).

- [ ] **Step 3: Write the helper and use it**

In `frontend/src/utils/location.ts`, add after `searchPlaceParams`:

```ts
/**
 * Page-address changes for a newly chosen place. The first search starts within DEFAULT_MAX_DISTANCE; a new
 * place keeps the distance already chosen, including "Any distance" (no maxDistance at all).
 */
export function choosePlaceParams(next: SearchPlace, previous: SearchPlace | null, maxDistance: string): Record<string, string | null> {
  const distance = maxDistance || (previous ? null : String(DEFAULT_MAX_DISTANCE))
  return { ...searchPlaceParams(next), maxDistance: distance }
}
```

In `frontend/src/pages/ChefsPage.tsx`:

1. In the `../utils/location` import, replace `DEFAULT_MAX_DISTANCE,` with `choosePlaceParams,` (and keep `describePlace`, `DISTANCE_OPTIONS`, `readSearchPlace`, `searchPlaceParams`, `type SearchPlace`).
2. Replace

```tsx
  const choosePlace = (next: SearchPlace) =>
    update({ ...searchPlaceParams(next), maxDistance: maxDistance || String(DEFAULT_MAX_DISTANCE) })
```

with

```tsx
  const choosePlace = (next: SearchPlace) => update(choosePlaceParams(next, place, maxDistance))
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend && npx vitest run src/utils && npm run lint && npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/location.ts frontend/src/utils/location.test.ts frontend/src/pages/ChefsPage.tsx
git commit -m "fix(web): a new ZIP code or location keeps the chosen distance, including Any distance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 18: Try Parts 1-4 on this computer

**Files:** none (browser check).

- [ ] **Step 1: Start fresh**

Run `cd backend && npm run db:seed`, then start the preview config `neighbors-kitchen` (restart it if it was running, since the Prisma client changed in Task 6).

- [ ] **Step 2: Check in the browser pane** (JS DOM checks where screenshots come out blank)
  1. **Photos.** `/meals`: every meal photo comes from `/uploads/meals/<id>.webp`. Check with `[...document.images].map((image) => new URL(image.src).pathname)`: no `themealdb` addresses, and every image has `naturalWidth > 0`.
  2. **Link through login.** Logged out, open `/account#email-settings`. The address becomes `/login?redirect=%2Faccount%23email-settings`. Click "Customer demo", then "Log in". You land on `/account#email-settings`, scrolled to "Email settings".
  3. **Bell count.** Note Chris's bell count. Log out, then log in as Maria ("Chef demo"). The badge never shows Chris's number.
  4. **Chef side.** Maria's bell has a "New dish request" item. Clicking it opens `/chef/feedback?view=requests` on the Requests tab. On `/chef/kitchen`, the delivery menu shows "Within 8 miles".
  5. **Requests scroll.** Open `/chefs/<Maria's chef id>#requests-heading`. After loading, the "Dish requests" heading is in view (`document.getElementById('requests-heading').getBoundingClientRect().top` is between 0 and the window height).
  6. **Distance.** `/chefs?near=92373`: choose "Any distance", type ZIP `92262`, click "Find chefs". The Distance menu still says "Any distance", and the address has no `maxDistance`.
  7. **Reset link.** Log out. On `/forgot-password`, ask for a link for `customer@neighborskitchen.test`, open `/dev/mailbox`, and click "Choose a new password" in the newest email. The form opens, and the address bar shows `/reset-password` with no token. (Do not save.)
- [ ] **Step 3: Restore**

Re-run `npm run db:seed` in `backend/`. Note the results in the ledger.

---

# Part 5: Packaging and the dress rehearsal

### Task 19: The Docker image and Railway settings

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `railway.json`
- Modify: `backend/package.json` (`prisma` and `tsx` become dependencies), `backend/package-lock.json`

- [ ] **Step 1: Move the two tools the live site runs**

In `backend/package.json`, move `"prisma": "^6.19.0",` and `"tsx": "^4.20.6",` from `devDependencies` to `dependencies` (alphabetical order: `prisma` after `multer`, `tsx` after `sharp`). Then run `cd backend && npm install` and check `git diff --stat backend/package-lock.json`: only the two packages' `"dev": true` flags change.

- [ ] **Step 2: Write the Dockerfile**

Create `Dockerfile` in the repo root:

```dockerfile
# Neighbors Kitchen: one image that runs the whole app (API, website, background helper).
# Railway builds it from main (see railway.json). Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/package.json backend/package-lock.json backend/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm ci --prefix backend && npm ci --prefix frontend
COPY backend backend
COPY frontend frontend
RUN npm run build --prefix backend && npm run build --prefix frontend
# Keep only what the live site runs; the Prisma client is generated again for the trimmed packages.
WORKDIR /app/backend
RUN npm prune --omit=dev && npx prisma generate

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/backend/package.json /app/backend/package-lock.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/data ./data
COPY --from=build /app/frontend/dist /app/frontend/dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

Create `.dockerignore` in the repo root:

```
**/node_modules
**/dist
**/.env
**/.env.*
!**/.env.example
backend/uploads
.git
.superpowers
.claude
docs
AGENTS.md
**/*.log
**/coverage
**/.DS_Store
```

Create `railway.json` in the repo root:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "preDeployCommand": "npm run db:migrate:deploy && npm run db:seed:preview",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5,
    "drainingSeconds": 30
  }
}
```

- [ ] **Step 3: Ask the owner, then build the image**

Docker Desktop must be running. If `docker info` fails, ask the owner to start Docker Desktop (or OK Claude running `open -a Docker`).

Ask the owner, one question: "OK to download Docker's official Node.js 24 base image (node:24-bookworm-slim, about 80 MB) to build and test the live site's package on your Mac?" Wait for a clear yes. Then run:

```bash
docker build -t neighbors-kitchen:rehearsal .
```

Expected: the build ends with `naming to docker.io/library/neighbors-kitchen:rehearsal`.

- [ ] **Step 4: Check the image's contents**

```bash
docker run --rm neighbors-kitchen:rehearsal sh -c 'ls /app/frontend/dist/index.html && ls prisma/sample-photos | wc -l && npx prisma --version | head -1 && test ! -d node_modules/embedded-postgres && test ! -d node_modules/vitest && echo "no development packages"'
```

Expected: the index path, `36`, a `prisma` version line, and `no development packages`.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore railway.json backend/package.json backend/package-lock.json
git commit -m "build: one Docker image for the whole app, and Railway settings as code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 20: The dress rehearsal

**Files:** none in the repo. Scratch files go in the scratchpad (`$S` below).

- [ ] **Step 1: A scratch database and settings**

```bash
S=<scratchpad>
cd backend && node -e "const { Client } = require('pg'); const c = new Client({ host: 'localhost', port: 5433, user: 'postgres', database: 'postgres' }); c.connect().then(() => c.query('CREATE DATABASE neighbors_kitchen_rehearsal')).then(() => c.end())"
{
  echo "NODE_ENV=production"
  echo "PORT=8080"
  echo "PREVIEW_MODE=true"
  echo "FRONTEND_URL=http://localhost:4100"
  echo "DATABASE_URL=postgresql://postgres@host.docker.internal:5433/neighbors_kitchen_rehearsal"
  echo "JWT_SECRET=$(openssl rand -hex 48)"
  echo "UPLOAD_DIR=/data/uploads"
  echo "TRUST_PROXY_HOPS=0"
  echo "EMAIL_TRANSPORT=resend"
  echo "RESEND_API_KEY=re_rehearsal_not_a_real_key"
  echo "EMAIL_FROM=Neighbors Kitchen <no-reply@neighborskitchen.app>"
  echo "DEMO_PASSWORD=$(openssl rand -hex 8)"
} > "$S/rehearsal.env"
mkdir -p "$S/rehearsal-data"
```

(The DEMO_PASSWORD is a throwaway test value for this computer only. Read it from the file when logging in as Maria; never print it in chat.)

- [ ] **Step 2: The pre-deploy step, as Railway runs it**

```bash
docker run --rm --env-file "$S/rehearsal.env" neighbors-kitchen:rehearsal sh -c "npm run db:migrate:deploy && npm run db:seed:preview"
docker run --rm --env-file "$S/rehearsal.env" neighbors-kitchen:rehearsal sh -c "npm run db:seed:preview"
```

Expected:
- The first run applies every migration and prints the seed summary, ending with `the DEMO_PASSWORD setting`.
- The second prints `The sample data is already there.`

If the container cannot reach Postgres through `host.docker.internal`, ask the owner before downloading `postgres:17` to use instead.

- [ ] **Step 3: Start the site**

```bash
docker run -d --name nk-rehearsal --env-file "$S/rehearsal.env" -p 127.0.0.1:4100:8080 -v "$S/rehearsal-data:/data" neighbors-kitchen:rehearsal
sleep 5 && docker logs nk-rehearsal
curl -si http://localhost:4100/ | sed -n '1,25p'
curl -s http://localhost:4100/robots.txt
curl -s http://localhost:4100/chefs/anything | grep -c 'nk-preview'
curl -si -H 'Host: www.localhost' http://localhost:4100/meals?x=1 | sed -n '1,5p'
curl -s http://localhost:4100/health
```

Expected:
- `/` answers 200 with `Cache-Control: no-cache`, `X-Robots-Tag: noindex, nofollow`, a Content-Security-Policy without `upgrade-insecure-requests`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- `robots.txt` answers `Disallow: /`.
- The marker is found (`1`).
- The www request gets a 301 to `http://localhost:4100/meals?x=1`.
- `/health` answers JSON.

- [ ] **Step 4: Click through in the browser pane**

Open `http://localhost:4100` with preview_start `{ url }`.
1. **Banner and samples.** The banner shows on the home page and on `/meals`. The sample kitchens show their photos, and the map on `/chefs?near=92373&view=map` shows tiles. The console has no Content-Security-Policy errors (`read_console_messages`, errors only).
2. **A practice order.** Sign up a test customer `rehearsal@example.com` (password `Rehearsal2026`), and place a pickup order at Abuela's Table.
3. **Chef side.** Log out, then log in as `maria@neighborskitchen.test` with the rehearsal's `DEMO_PASSWORD` (read it from `$S/rehearsal.env`). Confirm the order. Upload a meal photo on one of Maria's meals and save.
4. **Emails.** Sign up a second test account, `rehearsal@neighborskitchen.app`, then use "Forgot password" for it.

(The login cookie is marked Secure. If a reload logs you out on plain `http://localhost`, that comes from the Secure mark, not a bug; the live site is https.)
5. **The emails table.** After 10 seconds, run:

```bash
cd backend && node -e "const { Client } = require('pg'); const c = new Client({ host: 'localhost', port: 5433, user: 'postgres', database: 'neighbors_kitchen_rehearsal' }); c.connect().then(() => c.query('SELECT kind, to_address, status, last_error FROM emails ORDER BY created_at')).then((r) => { console.table(r.rows); return c.end(); })"
```

Expected:
- Every email to `@example.com` or `@neighborskitchen.test` is `SKIPPED` with `Not sent: example address`.
- The `rehearsal@neighborskitchen.app` reset email is `PENDING`, with `last_error` starting `Resend 40` (the dummy key is refused, so nothing is sent).

- [ ] **Step 5: Restart and stop**

```bash
docker restart nk-rehearsal && sleep 5
```

Reload Maria's meal in the browser: the uploaded photo is still there (it lives on the mounted folder).

Then:

```bash
docker stop nk-rehearsal && docker logs nk-rehearsal | tail -3
```

Expected: `SIGTERM received: finishing the current work`, and the container stops within a few seconds.

- [ ] **Step 6: Clean up**

```bash
docker rm nk-rehearsal
cd backend && node -e "const { Client } = require('pg'); const c = new Client({ host: 'localhost', port: 5433, user: 'postgres', database: 'postgres' }); c.connect().then(() => c.query('DROP DATABASE neighbors_kitchen_rehearsal')).then(() => c.end())"
rm -rf "$S/rehearsal-data" "$S/rehearsal.env"
docker image rm neighbors-kitchen:rehearsal
```

Record the results in the ledger. Any problem found is fixed test-first (RED to GREEN) before going on.

### Task 21: Docs for the live preview

**Files:**
- Delete: `vercel.json`, `netlify.toml`
- Modify: `DEPLOYMENT.md` (rewrite), `README.md`, `CLAUDE.md`

- [ ] **Step 1: Remove the old hosting files**

```bash
git rm vercel.json netlify.toml
```

- [ ] **Step 2: Rewrite `DEPLOYMENT.md`**

Replace its whole content with:

````markdown
# Deploying Neighbors Kitchen

The show-and-tell preview (Phase 8a) runs on [Railway](https://railway.com) at **https://neighborskitchen.app**.
Design: `docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md`.

## How it is set up

- **Railway project `neighbors-kitchen`**, with two services:
  - `web`: the whole app (web pages, API, background helper), built from the `Dockerfile` in this repo. Its build and deploy settings are in `railway.json`.
  - `Postgres`: the database.
- **Photo volume.** A volume mounted at `/data` on `web` keeps uploaded meal photos (`/data/uploads`). The sample meals' photos ship with the app (`backend/prisma/sample-photos`).
- **Addresses.** The site answers at `neighborskitchen.app` and `www.neighborskitchen.app`; the app forwards www to the bare address. The domain and its DNS records are at Namecheap.
- **Email.** Emails go through [Resend](https://resend.com) from `no-reply@neighborskitchen.app`. The free plan allows 100 a day and 3,000 a month. Emails to the sample accounts' made-up `@neighborskitchen.test` addresses are never sent.

## How an update goes live

1. Work happens on a branch and is merged into `main` through a pull request.
2. Railway builds the Docker image from the new commit on `main`.
3. The pre-deploy command runs `npm run db:migrate:deploy` (database changes), then `npm run db:seed:preview`, which loads the sample data the first time only.
4. The new version starts. Once `/health` answers, Railway switches visitors to it and stops the old one (which finishes its current work first). Because of the photo volume, the site pauses for up to about a minute.

If the build or the pre-deploy command fails, the old version keeps running.

## Settings (Railway > web > Variables)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `PREVIEW_MODE` | `true` (banner, no search engines, sample data allowed) |
| `FRONTEND_URL` | `https://neighborskitchen.app` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | 96 random characters (generated; never shown) |
| `UPLOAD_DIR` | `/data/uploads` |
| `TRUST_PROXY_HOPS` | `1` |
| `EMAIL_TRANSPORT` | `resend` |
| `RESEND_API_KEY` | Resend's API key (sending access only) |
| `EMAIL_FROM` | `Neighbors Kitchen <no-reply@neighborskitchen.app>` |
| `DEMO_PASSWORD` | the sample accounts' private password (at least 12 characters) |

Never paste the secret values into chat or into the repo. The app refuses to start with unsafe production settings, and says which.

## Everyday tasks

- **See what is happening:** Railway > web > Deployments > View logs, or `railway logs` in the project folder. One line after each start says whether visitors' addresses look public (the proxy check).
- **Reset the sample data:** `railway ssh` (service `web`), then `npm run db:seed`. This restores the sample chefs, meals, orders and reviews; visitors' own accounts stay.
- **Change a setting:** edit it under Variables; Railway redeploys.
- **Roll back:** Railway > web > Deployments > pick the previous one > Redeploy.

## Costs

| Item | Cost |
|---|---|
| Railway Hobby | $5/month, including $5 of usage (this app needs about $5-10/month in total) |
| Domain | Namecheap's yearly price for `.app` |
| Resend | Free plan |

## Before the public launch (Phase 8b)

- Payments (Phase 5), Terms of Service and Privacy Policy pages, and an age confirmation.
- Chef permits (MEHKO).
- Database backups: Railway Pro, or a nightly backup job.
- A faster first load on phones, error alerts, a map tile provider for real traffic, and a support inbox.
- `PREVIEW_MODE=false`. The app then refuses to load sample data. Delete the sample accounts first.
````

- [ ] **Step 3: Update `README.md`**

1. **Status table.** Change the Phase 8 row to

```
| 8. Launch | Put it live on the internet | 🔶 8a: show-and-tell preview at https://neighborskitchen.app (public launch after payments: 8b) |
```

2. **The preview.** After the "How notifications work (Phase 7b)" paragraph, add:

```
**How the preview works (Phase 8a):** the show-and-tell preview runs on Railway at https://neighborskitchen.app, with the sample chefs, meals and reviews. A banner on every page says orders are practice only, and search engines are asked not to list the site. Emails really go out (through Resend), except to the sample accounts' made-up addresses. The sample accounts use a private password on the preview site; `Password123` only works on your own computer. The sample meal photos are free-license stock photos (credits in `backend/prisma/sample-photos/CREDITS.md`). Every merge into `main` updates the site; see `DEPLOYMENT.md`.
```

3. **Future Integrations.** Replace the line `- Email service (notifications)` with `- A map tile provider and photo storage that scale, for the public launch`, and delete `- Cloudinary or similar (image storage in production)`.
4. **Environment Variables.** Add to the backend list:

```
- `PREVIEW_MODE` - `true` on the preview site (banner, no search engines, sample data allowed)
- `TRUST_PROXY_HOPS` - `1` behind Railway's proxy, `0` on your computer
- `EMAIL_TRANSPORT` / `RESEND_API_KEY` / `EMAIL_FROM` - `mailbox` here; `resend` plus its key on the live site
- `DEMO_PASSWORD` - the sample accounts' password on the preview site
```

5. **Coming in later phases.** Change `Payments (Phase 5). At launch (Phase 8) a real email service replaces the practice mailbox.` to `Payments (Phase 5), then the public launch (Phase 8b).`
6. **Uploaded photos.** Change `Uploaded photos are stored in \`backend/uploads/\` during development (not committed to git). Production photo storage is set up in Phase 8.` to `Uploaded photos are stored in \`backend/uploads/\` during development (not committed to git) and on a Railway volume on the live site.`
7. **Documentation.** Change `- \`DEPLOYMENT.md\` - Deployment notes (updated in Phase 8)` to `- \`DEPLOYMENT.md\` - How the preview is deployed and run on Railway`.
8. **Project structure.** Add `Dockerfile` and `railway.json` lines to the tree (`Dockerfile  # the live site's image (Railway)`, `railway.json  # Railway build and deploy settings`).

- [ ] **Step 4: Update `CLAUDE.md`**

1. **Header.** Change `> **Repository Status:** ...` to `> **Repository Status:** Phases 1-4, 6, 7 and 8a (live preview) complete; Phase 5 waits for Stripe test keys; 8b (public launch) after payments`, and set `**Last Updated:**` (top and bottom) to the day of this task.
2. **Build Plan.** Change item 8 to `8. Put it live on the internet (8a done: show-and-tell preview at https://neighborskitchen.app; 8b: public launch)`.
3. **Current State tree.** Add `├── Dockerfile, railway.json  # the live site (Railway)`, `backend/src/web/` (website, security) and `backend/prisma/sample-photos/`.
4. **Conventions.** Add this bullet at the end of "Key conventions already in place":

```
- Live preview (Phase 8a, `docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md`):
  - **Packaging.** One Docker image (`Dockerfile`; Railway settings in `railway.json`, deploys from `main`) runs everything. In production `createApp(appOptionsFromEnv())` also serves `frontend/dist` (`web/website.ts`): `/assets` immutable, and `index.html` no-cache for every GET/HEAD outside `/api`, `/uploads` and `/health`.
  - **Preview mode.** `PREVIEW_MODE=true` adds `<meta name="nk-preview" content="true" />` (read by `PreviewBanner`), a Disallow `robots.txt` and `X-Robots-Tag: noindex, nofollow`.
  - **Settings.** `readEnv` refuses unsafe production settings (`productionProblems`).
  - **Proxy.** `TRUST_PROXY_HOPS` (1 on Railway) sets trust proxy and logs one "Proxy check" line.
  - **Headers.** Helmet's CSP allows only our files plus `https://tile.openstreetmap.org`; `Referrer-Policy` is `strict-origin-when-cross-origin`, because OpenStreetMap's tiles need a Referer.
  - **Email.** `EMAIL_TRANSPORT=resend` uses `resendTransport` (10 s limit, `Idempotency-Key` = email id). Real transports mark reserved addresses (`isReservedAddress`) `SKIPPED`, and subjects go through `cleanSubject`.
  - **Reset links.** They put the token after `#`, and the reset endpoint clears the refresh cookie.
  - **Sample data.** It loads only through `sampleDataPlan()`: never on a live site unless it is the preview with `DEMO_PASSWORD` of at least 12 characters. `npm run db:seed:preview` loads it once (Railway's pre-deploy).
  - **Sample photos.** They live in `backend/prisma/sample-photos/<samplePhotoId(name)>.webp` (credits in `CREDITS.md`) and are served at `/uploads/meals/` after `UPLOAD_DIR`.
  - **Stopping.** SIGTERM stops the helper after its pass, lets requests finish (25 s), then disconnects (`lib/shutdown.ts`).
```

5. **Environment Variables.** Extend the backend list in "Environment Variables" with `PREVIEW_MODE`, `TRUST_PROXY_HOPS`, `WEB_DIST_DIR`, `RESEND_API_KEY` and `DEMO_PASSWORD`.

- [ ] **Step 5: Check and commit**

Run `npm test` and `npm run build` in the repo root, and `cd frontend && npm run lint`. Then:

```bash
git add DEPLOYMENT.md README.md CLAUDE.md
git commit -m "docs: the Railway runbook, and the live preview in README and CLAUDE.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 22: Final review, fixes and push

- [ ] **Step 1: Everything green**

Run all of these:
- `npm test` in the root;
- `cd backend && npx tsc --noEmit -p .`;
- `cd frontend && npm run lint && npm run build`;
- `docker build -t neighbors-kitchen:review .`, then `docker image rm neighbors-kitchen:review`.

Record the counts in the ledger.

- [ ] **Step 2: A fresh reviewer**

Dispatch a fresh reviewer: the `code-reviewer` agent, model `opus`. Its brief:

> Review the branch changes since commit c89bb55 (`git diff c89bb55..HEAD`) against the spec `docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md` and the plan `docs/superpowers/plans/2026-09-29-phase8a-live-preview.md`.
>
> Focus on:
> - security (headers, secrets, the reserved-address skip, the sample-data guard, the website fallback, the reset token);
> - production failure modes (startup checks, SIGTERM, pre-deploy, Docker image contents, Railway settings);
> - the Review Focus list.
>
> Report Critical / Important / Minor findings with file:line and a failing-input description. Do not modify files.

- [ ] **Step 3: Fix and push**

Fix every Critical and Important finding test-first (RED to GREEN), one commit each, and note the Minor ones for the owner. Run Step 1 again. Then push to `claude/neighbors-kitchen-chat-dk4r07`, and tell the owner Part 5 is done and the site is ready to go live once the accounts are set up.

---

# Part 6: Going live (with the owner)

Each owner step is sent as short click-by-click instructions, one at a time; wait for "done" before the next. Claude never buys, signs up, types a password on a live site, edits Namecheap, or merges without a clear yes.

### Task 23: The owner's accounts

- [ ] **Step 1: Vercel (owner, or Claude with an OK)**

Ask the owner to open Vercel > project `neighbors-kitchen` > Settings > Git and click **Disconnect**.

If the owner prefers that Claude do it, the Vercel connection cannot disconnect Git, but it can stop the failing builds: with an explicit OK, set the project's Ignored Build Step to `exit 0` through `update_project` (`commandForIgnoringBuildStep: "exit 0"`, team `team_szgT52ldbqyDBvYAhRGw0iQm`, project `prj_otilleIu08L8pPgDtMyfRcInxUcE`).

- [ ] **Step 2: The domain (owner)**

At Namecheap, buy `neighborskitchen.app`. Turn on auto-renew; the free domain privacy is on by default.

Then, in Domain List > Manage > Advanced DNS, delete the default parking records: the `URL Redirect Record` for `@` and the `CNAME` for `www` pointing at `parkingpage.namecheap.com`.

- [ ] **Step 3: Resend (owner)**
  1. Sign up at resend.com (free plan).
  2. Go to Domains > Add Domain > `neighborskitchen.app` (region: North Virginia, us-east-1).
  3. Resend lists 3-4 DNS records. Add each one at Namecheap (Advanced DNS > Add new record), exactly as shown:
     - For the MX record on `send`, first set Namecheap's Mail Settings to **Custom MX**.
     - Add the DMARC record `_dmarc` TXT `v=DMARC1; p=none;` if Resend suggests it.
  4. Click **Verify** in Resend. It may take a few minutes.
  5. Go to API Keys > Create API Key: name `neighbors-kitchen-preview`, permission **Sending access**, domain `neighborskitchen.app`. Copy the key and keep it for Task 24 (do not paste it into chat).

### Task 24: The Railway project

- [ ] **Step 1: Ask first**

Ask the owner, one question: "OK for me to create the Railway project 'neighbors-kitchen' in your account with the Railway tool on your Mac (a database, a 'web' service, its settings and a photo volume)? It starts billing on your Hobby plan, about $5-10 a month."

Also confirm the account is on the Hobby plan (Railway > Account > Plans). Wait for a clear yes.

- [ ] **Step 2: Create it** (from the repo root; check each command's `--help` first; if the tool asks an interactive question, stop and give the owner the dashboard clicks instead)

```bash
railway init --name neighbors-kitchen
railway add --database postgres
railway add --service web
railway variable set --service web --skip-deploys NODE_ENV=production PORT=8080 PREVIEW_MODE=true FRONTEND_URL=https://neighborskitchen.app 'DATABASE_URL=${{Postgres.DATABASE_URL}}' UPLOAD_DIR=/data/uploads TRUST_PROXY_HOPS=1 EMAIL_TRANSPORT=resend 'EMAIL_FROM=Neighbors Kitchen <no-reply@neighborskitchen.app>'
openssl rand -hex 48 | railway variable set --service web --skip-deploys --stdin JWT_SECRET
railway service link web
railway volume add --mount-path /data
railway variable list --service web --kv | cut -d= -f1
```

Expected: the last command lists the variable names (never print values). `railway volume list` shows `/data`.

- [ ] **Step 3: The owner's secrets (owner)**

In Railway > neighbors-kitchen > web > Variables > New Variable, add:
- `RESEND_API_KEY` = the key from Task 23;
- `DEMO_PASSWORD` = a password of at least 12 characters that the owner chooses and keeps.

### Task 25: Merge, deploy and check

- [ ] **Step 1: Merge pull request #2 (owner OK)**

Ask: "Ready to merge pull request #2 into main? Railway builds the live preview from main." After a clear yes:

```bash
gh pr merge 2 --merge --repo joe-bera/Neighbors-Kitchen
```

- [ ] **Step 2: Connect the repo (owner)**

In Railway > web > Settings > Source > Connect Repo, pick `joe-bera/Neighbors-Kitchen`, branch `main`. If Railway asks for access to the repo, allow it for this repo.

The first deploy starts. Follow it:

```bash
railway logs --service web
```

Expected in order:
- the Docker build;
- the pre-deploy output (migrations, the seed summary ending `the DEMO_PASSWORD setting`);
- `🚀 Neighbors-Kitchen API server running on port 8080`.

- [ ] **Step 3: A first look before DNS**

Run `railway domain --service web --port 8080`. It creates the free `*.up.railway.app` address. Check `/health`, `/` and `/robots.txt` there with curl, and once in the browser pane (banner, photos, map).

- [ ] **Step 4: The real address**

```bash
railway domain neighborskitchen.app --service web --port 8080 --json
railway domain www.neighborskitchen.app --service web --port 8080 --json
```

Give the owner the records from the output to add at Namecheap (Advanced DNS):
- an **ALIAS Record** for `@` with the Railway target;
- a **CNAME** for `www` with its target;
- both **TXT** verification records.

Wait until Railway shows both domains as active with certificates (minutes to an hour). Then remove the temporary `*.up.railway.app` address (Railway > web > Settings > Networking), so the preview has one public address.

- [ ] **Step 5: Live checks (Claude)**
  1. `curl -sI https://neighborskitchen.app/` → 200, `X-Robots-Tag`, a CSP with `upgrade-insecure-requests`, and `Strict-Transport-Security`.
  2. `curl -sI https://www.neighborskitchen.app/meals` → 301 to `https://neighborskitchen.app/meals`.
  3. `/robots.txt` and `/health` answer as expected.
  4. In the browser pane: the banner, the photos, and the map on `/chefs?near=92373&view=map`; no console errors.
  5. In `railway logs`: `Proxy check: visitor addresses look public.` If it says private, set `TRUST_PROXY_HOPS=2`, redeploy, and check again.
- [ ] **Step 6: The owner's sign-in checks**

Send the owner this list:
1. Sign up with your real email.
2. Place a practice pickup order at Abuela's Table. The receipt email arrives.
3. Log out, then log in as `maria@neighborskitchen.test` with your `DEMO_PASSWORD`. Confirm the order.
4. Log back in as yourself. The "confirmed" email arrives.
5. Try "Forgot password" on your account. The email arrives, and its button opens "Choose a new password".
6. Open the site on your phone.

- [ ] **Step 7: Wrap up**

Update the memory notes (progress file: live address, Railway project, what's next). Tell the owner the preview is live, with the link and what to click. Offer the next step: Stripe keys for Phase 5, or the Phase 8b list.
