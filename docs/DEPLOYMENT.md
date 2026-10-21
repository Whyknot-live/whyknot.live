# Deployment Guide

Production runs on **Render**. Three services, one repository, three custom domains.

This file was rewritten on 2026-10-21 against the live services, after the first real deploy
of the expanded platform. The old version of this guide described Vercel, Netlify, Railway,
Heroku and Fly — none of which are used. Trust this one, and check the Render dashboard if the
two disagree.

## Table of Contents

- [The three services](#the-three-services)
- [What is where](#what-is-where)
- [Build traps](#build-traps)
- [Environment variables](#environment-variables)
- [Deploying](#deploying)
- [When a deploy does not happen](#when-a-deploy-does-not-happen)
- [Reading the build log](#reading-the-build-log)
- [Custom domains and redirects](#custom-domains-and-redirects)
- [After a deploy](#after-a-deploy)

## The three services

| Service | Type | Root dir | Build | Start | Auto-deploy | Domain |
|---|---|---|---|---|---|---|
| `whyknot.live` | static site | `./frontend` | `bun run build` (install is **npm**) | - | `checksPass` | `www.whyknot.live` |
| `admin.whyknot.live` | static site | `./admin` | `bun install; bun run build` | - | `commit` | `admin.whyknot.live` |
| `whyknot.live-backend` | web service | `./backend` | `bun install; bun run build;` | `./whyknot-backend` | `checksPass` | `api.whyknot.live` |

The repository is `https://github.com/Whyknot-live/whyknot.live` (it moved from
`jayptl-me/whyknot.live`; the old path still redirects).

## What is where

- **Public site** — `frontend/`, built to `frontend/dist`, published as `dist`. Static only
  (`output: 'static'`). 82 pages, pagefind indexes the built output.
- **Admin** — `admin/`, built to `admin/dist`, published as `dist`. Static only.
- **API** — `backend/`, compiled to a single binary (`bun build --compile`) and run as
  `./whyknot-backend`. Hono + MongoDB, stateless, one instance.
- **Tokens** — `frontend/src/styles/tokens.css` is the single source. The admin copy is
  generated: `cd admin && bun scripts/sync-tokens.mjs --write`. Run it on the build box and copy
  the file back; the Mac does not run tools.
- **Redirects** — `frontend/public/_redirects` holds the canonical host redirects, the screener
  report rewrite and the 404 fallback. Render serves it as-is.

## Build traps

Both of these have already broken a production build. Read them before adding a dependency.

1. **Render installs the public site with npm, not bun.** Bun ignores peer ranges; npm refuses
   them outright. `@astrojs/check` pinned a TypeScript 5 peer against the project's TypeScript 7
   and the whole static build died with `ERESOLVE`. Keep every peer range npm can install, or the
   build fails before it starts. (The admin service installs with bun, because its build command
   says so.)
2. **A dependency belongs in the package that imports it.** `astro-pagefind` was added to a root
   `package.json` while `frontend/astro.config.mjs` imports it, and the frontend installs on its
   own — so the import could never resolve. It now lives in `frontend/package.json`.

Also: `astro check` cannot run on TypeScript 7 (Astro's own check needs the TypeScript programmatic
API that TS 7 does not ship). Use `bun run typecheck` and `bun run lint`.

## Environment variables

Secrets live in gitignored `.env` files and in the Render dashboard. They never enter the repo.

**Backend service** (`whyknot.live-backend` -> Environment):

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI`, `MONGODB_DB` | yes | Atlas. The service boots only with these. |
| `ADMIN_PASSWORD_HASH` | yes | bcrypt hash, 60 chars, `$2b$12$...` |
| `ADMIN_PASSWORD_PEPPER` | recommended | mixed into the admin password check |
| `ADMIN_JWT_SECRET` | yes | at least 32 characters, signs the admin cookie |
| `CORS_ORIGIN` | yes | comma separated: `https://whyknot.live,https://www.whyknot.live,https://admin.whyknot.live` |
| `PORT` | yes | `10000` |
| `MAKER_SESSION_SECRET` | optional | signs maker edit sessions; falls back to `ADMIN_JWT_SECRET` |
| `REDIS_URL`, `USE_REDIS_RATE_LIMIT` | optional | without them rate limiting is in-memory only, and resets on every deploy |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for money | without them checkout returns `payments_not_configured` |
| `RAZORPAY_WEBHOOK_SECRET` | for money | the webhook fails CLOSED outside development without it |
| `RAZORPAY_CURRENCY` | optional | `INR` |
| `RESEND_API_KEY`, `ENABLE_EMAIL`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | for email | `ENABLE_EMAIL=1` turns sending on |

The values for all of these exist in the local `backend/.env`.

**Public site build** (Environment): `PUBLIC_API_BASE_URL=https://api.whyknot.live`. This one is
baked into the bundle at build time — the browser calls that host for every API request. The
repository's `frontend/.env` is gitignored and has no effect on production.

**Admin build**: `PUBLIC_API_URL=https://api.whyknot.live/api`.

**The Render API key** (for scripted deploys) lives in the local `backend/.env` as
`RENDER_API_KEY`. It is gitignored. It is a personal key for the Render workspace that owns these
services, and it is not scoped to them: keep it out of the repo and rotate it if it ever leaks.

## Deploying

**By hand (the dashboard).** Render dashboard -> the service -> Manual deploy -> Deploy latest
commit. Do this for `whyknot.live` and `whyknot.live-backend` whenever CI is not reporting a
check (see below).

**By API** (what the agent uses). A personal API key from the workspace that owns the services:

```bash
KEY=$(grep '^RENDER_API_KEY=' backend/.env | cut -d= -f2-)

# trigger a deploy
curl -sS -X POST https://api.render.com/v1/services/<serviceId>/deploys \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}'

# follow it
curl -sS https://api.render.com/v1/services/<serviceId>/deploys/<deployId> \
  -H "Authorization: Bearer $KEY"
```

Service ids (as of 2026-10-21): public `srv-d3ti4gfdiees73diqvig`, admin
`srv-d416v3mr433s73b6tqk0`, backend `srv-d3v7mde3jp1c7389j1hg`.

**Before any deploy:** the gates must be green on the build box, never on the Mac. The smallest
proof is typecheck and lint in the touched package, plus a frontend build for any page or CSS
change, plus `bun test` for backend changes.

## When a deploy does not happen

The public site and the API only deploy when their `checksPass` trigger is satisfied, and a
check has to report for that to happen. **If no CI reports anything, they wait forever** — a push
looks like it did nothing. That is exactly what happened after the repository moved to the
`Whyknot-live` org: GitHub Actions stopped running for the repo and CircleCI reported nothing,
so both services sat on old builds while the admin (which deploys on `commit`) went live.

Two ways out, and the second is the more honest one:

1. Set those two services to auto-deploy on `commit`, like the admin.
2. Fix CI so a check actually reports: GitHub Actions enabled for the org repository
   (Settings -> Actions -> General -> "Enable Actions"), and the CircleCI project pointed at the
   new repository path. Then `checksPass` means something again.

Until that is sorted, trigger the two deploys by hand.

## Reading the build log

The build log is where the real reason for a failed build lives — the deploy status only says
`build_failed`.

```bash
KEY=$(grep '^RENDER_API_KEY=' backend/.env | cut -d= -f2-)
OWNER=tea-d3ti3b6uk2gs73d5ll80   # the workspace id

curl -sS "https://api.render.com/v1/logs?ownerId=$OWNER&type=build&resource=<serviceId>&limit=100" \
  -H "Authorization: Bearer $KEY"
```

The filter names are exact: `ownerId` and `resource` (not `serviceId`), and `ownerId` is required.
The per-service and per-deploy log paths (`/v1/services/<id>/logs`) return 404 on an API key.

## Custom domains and redirects

- `whyknot.live` redirects to `www.whyknot.live` (canonical host), per `frontend/public/_redirects`.
- `api.whyknot.live` is the API. The `api-whyknot-live.onrender.com` subdomain redirects to the
  custom domain, which breaks CORS — always use the custom domain.
- `admin.whyknot.live` is the admin dashboard.
- The screener report route is a rewrite to one prerendered shell, so live `scan_<id>` URLs
  resolve without SSR.
- `whyknot-live-development-backend.onrender.com` has no server attached and is dead. Nothing
  points at it except the local `frontend/.env`, which is gitignored and irrelevant to production.

## After a deploy

Check the live site, not the build output:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://www.whyknot.live/screener/
curl -sS -o /dev/null -w "%{http_code}\n" https://api.whyknot.live/health
curl -sS https://api.whyknot.live/api/payments/config      # {"configured":false} means no keys yet
curl -sS -X PATCH -H 'Content-Type: application/json' -d '{"tagline":"x"}' \
  https://api.whyknot.live/api/submissions/anything         # 401: edits need a maker session
```

The money path cannot be proven until the Razorpay keys are on the service: `/api/payments/config`
must report `"configured":true` and one real test order has to complete. Nothing about a checkout
is proven by a build.
