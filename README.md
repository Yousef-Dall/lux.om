# lux.om

Premium Oman real estate, short-stay, development, and curated activities marketplace.

lux.om is a full-stack marketplace built with React + Vite, Express, Prisma, PostgreSQL, JWT authentication, and role-based workflows for users, owners, activity providers, developers, and admins.

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 14+
- Docker Desktop, optional for local PostgreSQL

## Project structure

- backend: Express API, Prisma schema, migrations, tests
- frontend: React/Vite application

## Local setup

Install dependencies:

    npm install

Create local environment files:

    cp .env.example .env
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env

Start local PostgreSQL:

    docker compose up -d

Generate Prisma Client, run migrations, and seed local data:

    npm run db:generate
    npm run db:migrate
    npm run db:seed

Run the backend:

    npm run dev:backend

Run the frontend in another terminal:

    npm run dev:frontend

Default local URLs:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Database: localhost:5433

## Environment files

Root .env is used by docker-compose.yml:

    POSTGRES_PASSWORD=replace-with-a-strong-local-password

Backend backend/.env:

    NODE_ENV=development
    PORT=4000
    DATABASE_URL="postgresql://postgres:replace-with-your-postgres-password@localhost:5433/lux_om?schema=public"
    JWT_SECRET="replace-this-with-a-long-random-secret-value"
    CORS_ORIGIN="http://localhost:5173"
    STORAGE_DRIVER="local"
    UPLOAD_DIR="uploads"
    MAX_UPLOAD_MB=5
    CLOUDINARY_CLOUD_NAME=""
    CLOUDINARY_API_KEY=""
    CLOUDINARY_API_SECRET=""
    CLOUDINARY_FOLDER="lux-om"
    EMAIL_DELIVERY_RETENTION_DAYS=180

Frontend frontend/.env:

    VITE_API_URL=""
    VITE_API_PROXY_TARGET="http://localhost:4000"

For production, set VITE_API_URL to the public backend API origin, for example:

    VITE_API_URL="https://api.your-domain.com"

Production frontend cache/versioning policy:

- `index.html` and HTML fallback responses must be served with `Cache-Control: no-cache, max-age=0, must-revalidate` so users receive the newest deployment entry point.
- Vite hashed assets under `/assets/*` should be served with `Cache-Control: public, max-age=31536000, immutable`.
- `robots.txt`, `sitemap.xml`, and `site.webmanifest` may use a short public cache window such as one hour plus stale revalidation.
- The frontend build injects `lux:app-version`, `lux:build-id`, `lux:build-time`, and `lux:cache-policy` metadata into `index.html` for deployment diagnosis.
- `frontend/public/_headers` documents the static-host cache contract for hosts that support `_headers` files. For Hostinger or Apache-style hosting, mirror the same rules in the hosting cache/header panel or `.htaccess`. For Vercel, Netlify, Cloudflare Pages, or a CDN, configure equivalent rules there if `_headers` is not honored.
- Do not cache `index.html` immutably. Stale HTML can point users at old asset URLs after deployment.

Frontend cache verification:

    npm run verify:frontend-cache

`npm run verify:production` runs this after the frontend build.

Leave VITE_API_URL empty only when frontend and backend share the same origin.

## Quality checks

Run all production readiness checks:

    npm run verify:production

Or run each step separately:

    npm run typecheck
    npm run test:integration
    npm run build

## Database commands

Generate Prisma Client:

    npm run db:generate

Create and apply a local migration:

    npm run db:migrate -- --name migration_name

Apply existing migrations in production:

    npm run db:migrate:deploy

Seed local data:

    npm run db:seed

Open Prisma Studio locally:

    npm run db:studio

## Public SEO launch files

Public SEO and crawler files live in `frontend/public`:

- `robots.txt`
- `sitemap.xml`
- `site.webmanifest`

The sitemap covers the public marketplace, discovery, contact, trust, and legal routes. Private account, auth, notification, dashboard, and admin routes are excluded from crawler indexing through robots rules and runtime `noindex` metadata.

Automated SEO verification:

Run:

    npm run verify:seo

This checks sitemap route coverage, robots private-route exclusions, footer legal route discoverability, runtime canonical/noindex metadata, manifest metadata, and launch README notes.

npm run verify:production also runs this SEO verification.

Before launch, confirm:

- `https://lux.om/robots.txt` is reachable.
- `https://lux.om/sitemap.xml` is reachable.
- public routes return the correct canonical URL.
- private/admin/auth routes set `noindex, nofollow`.
- legal and trust policy pages are reachable from the footer.

## Public marketplace policy pages

Public legal and trust policy routes:

- `/terms`
- `/privacy`
- `/trust-safety`
- `/cancellation-policy`
- `/refund-policy`
- `/verification-policy`

These pages are linked from the public footer and explain marketplace terms, privacy, trust/safety reporting, cancellation handling, refund review, and verification rules.

## Production operations

Production runbooks:

- [Production operations runbook](docs/production-operations-runbook.md)
- [Admin health checklist](docs/admin-health-checklist.md)

Use these documents for deployment verification, SMTP setup, transactional email monitoring, admin dashboard checks, and email delivery retention cleanup.

## Production HTTP security and cache hardening

The backend applies production-safe HTTP security headers before API routes are mounted. Helmet is configured with an explicit Content Security Policy, `X-Content-Type-Options`, `X-Frame-Options: DENY`, strict referrer policy, cross-origin settings that keep uploaded media usable from the frontend, and production-only HSTS.

Sensitive API responses, including auth, account, admin, verification, notification, booking, payment, transaction, contract, report, saved, inquiry, and upload endpoints, are marked `no-store` so browsers and proxies do not keep private marketplace data. Anonymous public discovery reads can use a short cache window, while authenticated reads are forced back to `no-store`.

Local uploaded media is served with a one-week public cache window and without `immutable`, because local upload filenames are not guaranteed to be content-hashed. SEO files such as `robots.txt` and `sitemap.xml` may be cached longer by the frontend host/CDN.

Optional comma-separated CSP extension variables are available only for verified third-party production integrations:

    CSP_CONNECT_SRC=
    CSP_IMG_SRC=
    CSP_FRAME_SRC=

Keep these values empty unless a real integration fails CSP in production and the required origin has been verified.

## Production deployment checklist

Before deployment:

- Use Node.js 20+.
- Use a managed PostgreSQL database.
- Set NODE_ENV=production.
- Set a strong JWT_SECRET.
- Set CORS_ORIGIN to the exact production frontend URL.
- Do not use localhost values in production.
- Use persistent image storage in production. Cloudinary is recommended with STORAGE_DRIVER=cloudinary.
- Run npm run verify:db-safety and create a verified database backup before migrations.
- Run npm run db:migrate:deploy before starting the backend.
- Confirm /api/ready returns database connected.
- Build the frontend with the correct VITE_API_URL.
- Keep .env, backend/.env, and frontend/.env out of Git.


### CORS, proxy, HTTPS, and cookies

- `CORS_ORIGIN` must contain only the exact production frontend origins that are allowed to call the API.
- Do not use wildcard CORS origins when credentials are enabled.
- Browser requests with an untrusted `Origin` header are rejected before route handling.
- `RATE_LIMIT_TRUST_PROXY_HOPS` must match the number of trusted reverse proxies in front of the API. In typical single-proxy hosting, use `1`.
- TLS should terminate at the production proxy, CDN, or load balancer. The proxy must forward the original protocol and client IP correctly.
- The API currently uses bearer JWT auth rather than auth cookies. If auth cookies are added later, they must be `HttpOnly`, `Secure` in production, use an explicit `SameSite` policy, and only be used with exact allowlisted CORS origins.



### Production logging, request IDs, and redaction

- Every API response includes an `X-Request-Id` header. Safe caller-provided request IDs are preserved; unsafe values are replaced with generated IDs.
- Production request logging is structured JSON and records method, path, status, duration, origin, IP, user agent, and request ID.
- Logs redact sensitive keys and URL query parameters such as tokens, passwords, authorization headers, cookies, API keys, SMTP credentials, reset links, and verification links.
- Development email links returned by API responses remain usable for local/testing flows, but token-bearing URLs are redacted before they are written to logs.
- Production error responses stay generic and never expose stack traces. Use the request ID to correlate a user-visible failure with backend logs.

### API payload limits, validation, and safe errors

- JSON API bodies are capped at `1mb` and URL-encoded form bodies are capped at `32kb`.
- API requests with unsupported body content types are rejected before route validation.
- Malformed JSON and oversized request bodies return safe `400`/`413` responses without parser internals or stack details.
- Unknown API routes return a generic `Route not found` message and do not echo query strings or attempted URLs.
- Route-level Zod validation remains responsible for domain-specific payload rules.

### Static uploads and media serving

- Uploads are accepted only as authenticated multipart image requests using the `image` or `file` field.
- Allowed image formats are JPG, PNG, WEBP, and GIF. The backend validates MIME type, file extension, and binary signature before storing media.
- The local storage driver writes generated filenames only and does not reuse user-supplied filenames for disk paths.
- Local `/uploads` serving accepts only generated image filenames, disables directory indexes and redirects, denies dotfiles, sets `X-Content-Type-Options: nosniff`, and serves files inline with explicit image content types.
- Local uploads use a one-week public cache window in production. Do not enable immutable caching unless filenames are guaranteed to be content-addressed.
- Production deployments should prefer persistent object/image storage such as Cloudinary. Local uploads are suitable only when the server filesystem is persistent, backed up, and not shared with private documents.


### Database migration, backup, and rollback safety

Production database changes must use committed Prisma migrations only. Do not use `prisma db push`, `prisma migrate dev`, or destructive reset commands against production.

Before each production deploy:

1. Run `npm run verify:db-safety` to confirm Prisma migration files, migration lock provider, and production migration scripts are safe.
2. Run `npm run db:migrate:status -w backend` against the production database to confirm what Prisma thinks is pending or applied.
3. Create a verified database backup before applying migrations. The helper command is:

       npm run ops:db:backup -w backend -- --output=../backups/lux-om-predeploy.dump

   This helper uses `pg_dump` with environment variables instead of putting the database password in command arguments. The PostgreSQL client tools must be installed and `pg_dump` must be available on `PATH`; alternatively set `PG_DUMP_PATH` to the full executable path. Keep backup files outside Git and confirm the file exists before continuing.

4. Apply migrations with:

       npm run db:migrate:deploy

5. Start or restart the backend only after migration deploy succeeds.
6. Verify `/api/ready`, admin system health, and the critical smoke tests.

Rollback policy:

- Prefer application rollback first when the database migration is backward-compatible.
- If data/schema rollback is required, stop writes, preserve the failed database state for investigation, restore from the verified pre-deploy backup into a clean database, repoint `DATABASE_URL`, run `npm run db:migrate:status -w backend`, then restart the backend.
- Never run `prisma migrate reset` or `prisma db push --force-reset` against production.
- Production `DATABASE_URL` must not point to a database whose name ends with `_test`.

## Backend deployment

Recommended backend build command:

    npm install
    npm run build -w backend

Recommended pre-start command:

    npm run db:migrate:deploy -w backend

Recommended backend start command:

    npm run start -w backend

Health checks:

- GET /health
- GET /api/health
- GET /api/ready

Use /api/ready for deployment readiness because it verifies the database connection.

## Frontend deployment

Recommended frontend build command:

    npm install
    npm run build -w frontend

Deploy this folder:

    frontend/dist

Set the production API URL before building:

    VITE_API_URL="https://api.your-domain.com"

## Admin setup notes

Admin users must not be created through public registration.

Use one controlled method only:

- a private production seed script,
- a direct database insert handled by the owner/developer,
- or a protected internal admin creation workflow.

After creating the first admin account, verify:

- admin dashboard access works,
- non-admin users cannot access admin routes,
- booking finance/export routes return 403 for non-admin users,
- provider/owner booking operations only show their own assets.

## Security notes

The backend includes Helmet security headers, CORS allowlisting, request IDs, production-safe structured logging with redaction, JSON body size limits, global API rate limiting, stricter auth/upload rate limiting, JWT verification, database-backed user validation, stale-role token rejection, role-based admin route protection, and image MIME/extension/signature validation.

## Git hygiene

The repository ignores dependencies, production builds, local env files, runtime uploads, logs, coverage, and editor files.

Never commit real production secrets.
