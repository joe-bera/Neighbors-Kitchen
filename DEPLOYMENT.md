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
3. The pre-deploy command (`npm run db:predeploy`) runs `npm run db:migrate:deploy` (database changes), then `npm run db:seed:preview`, which loads the sample data the first time only.
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
