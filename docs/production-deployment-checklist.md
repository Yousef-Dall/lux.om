# Production deployment checklist

Use this checklist for every lux.om production release. It is intentionally operational and should be completed before traffic is moved to a new backend or frontend build.

## Required production environment variables

Backend runtime:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL` pointing to the production PostgreSQL database, never a `_test` database
- `JWT_SECRET` as a strong random value of at least 48 characters
- `CORS_ORIGIN` containing only exact HTTPS frontend origins, for example `https://lux.om,https://www.lux.om`
- `FRONTEND_URL` using the canonical HTTPS frontend origin
- `RATE_LIMIT_TRUST_PROXY_HOPS` matching the trusted reverse-proxy hop count, usually `1` on single-proxy hosting
- `EMAIL_DELIVERY_MODE=smtp`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`
- `STORAGE_DRIVER=cloudinary` plus `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and `CLOUDINARY_FOLDER`
- `THAWANI_SECRET_KEY`, `THAWANI_PUBLISHABLE_KEY`, `THAWANI_API_BASE_URL`, and `THAWANI_CHECKOUT_BASE_URL` using production HTTPS Thawani endpoints
- Optional CSP extension variables only after the exact third-party origins are verified: `CSP_CONNECT_SRC`, `CSP_IMG_SRC`, `CSP_FRAME_SRC`

Frontend build:

- `VITE_API_URL` must point to the public HTTPS backend API origin when frontend and backend are not deployed on the same origin.
- Do not leave production frontend builds pointing to localhost or a UAT backend.

Secrets must stay in the hosting provider secret manager or environment panel. Never commit `.env`, `backend/.env`, `frontend/.env`, database dumps, SMTP credentials, Thawani keys, Google OAuth secrets, or Cloudinary secrets.

## Pre-deployment verification sequence

Run this from a clean `main` checkout before production deployment:

```bash
npm install
npm run verify:production
```

The production verification chain must include:

1. production environment validation fixtures
2. Prisma migration safety validation
3. this deployment checklist verifier
4. backend and frontend typechecks
5. public SEO verification
6. frontend accessibility/mobile polish verification
7. backend integration and smoke coverage
8. backend and frontend production builds
9. frontend build cache/version verification

The deployment checklist verifier can also be run directly:

```bash
npm run verify:deployment-checklist
```

## Database migration and backup sequence

Before any migration deploy:

```bash
npm run verify:db-safety
npm run db:migrate:status -w backend
npm run ops:db:backup -w backend -- --output=../backups/lux-om-predeploy.dump
npm run db:migrate:deploy
```

The backup helper requires PostgreSQL client tools. On Windows or locked-down workstations, set `PG_DUMP_PATH` to the full `pg_dump` executable path. Confirm the backup file exists and is stored outside Git before applying migrations.

Never run these commands against production:

```bash
npx prisma db push
npx prisma migrate dev
npx prisma migrate reset
npx prisma db push --force-reset
```

`prisma migrate dev` and `prisma db push` are local development tools only.

## Deployment order

1. Confirm the release commit is pushed to `main` and matches the commit being deployed.
2. Confirm required backend, frontend, database, SMTP, Cloudinary, Google OAuth, and Thawani environment variables are set in the hosting provider.
3. Run `npm run verify:production` from the release checkout.
4. Run the database migration and backup sequence.
5. Deploy or restart the backend only after `npm run db:migrate:deploy` succeeds.
6. Check backend readiness with `/api/ready` before sending traffic.
7. Build and deploy the frontend with the production `VITE_API_URL`.
8. Confirm static host/CDN cache rules match `frontend/public/_headers`.
9. Confirm `index.html` is revalidated and hashed assets under `/assets/*` are immutable.

## Post-deployment smoke verification

After deployment, verify the live environment before announcing release readiness:

```bash
npm run test:smoke
npm run test:marketplace-smoke
npm run verify:frontend-cache
```

Manual live checks:

- `GET /health`, `GET /api/health`, and `GET /api/ready` return healthy responses.
- Public routes load over HTTPS and point at the production API.
- `/robots.txt`, `/sitemap.xml`, and `/site.webmanifest` are reachable on the frontend domain.
- Registration, email verification, password reset, and email change are functional with production SMTP.
- Owner verification submission and admin verification review create notifications and email audit records.
- Listing booking request and provider approval produce the expected dashboard deep links.
- Payable activity checkout creates exactly one hosted payment session for repeated clicks and syncs paid sessions safely.
- Trust report submission and admin review create notification routing metadata.
- Admin-only pages reject non-admin accounts and stale admin tokens.
- Notification, report dialog, review, saved-button, and mobile navigation states remain keyboard accessible.

## Rollback checklist

Prefer application rollback first when migrations are backward compatible:

1. Stop new deployment traffic or roll the backend/frontend service back to the previous known-good build.
2. Keep the failed release logs and request IDs for investigation.
3. Confirm `/api/ready` and core smoke paths on the rolled-back app.
4. Do not run destructive Prisma reset commands.

If a database restore is required:

1. Stop writes and preserve the failed database state for investigation.
2. Restore the verified pre-deploy backup into a clean database.
3. Repoint `DATABASE_URL` to the restored database.
4. Run `npm run db:migrate:status -w backend`.
5. Restart the backend and verify `/api/ready`.
6. Run `npm run test:smoke` and the most relevant marketplace smoke path before reopening traffic.

## Hosting and integration notes

- Render or another reverse proxy must forward the original protocol and client IP. Keep `RATE_LIMIT_TRUST_PROXY_HOPS` aligned with that topology.
- Hostinger/static hosting must mirror `frontend/public/_headers` cache rules if `_headers` is not honored automatically.
- Cloudinary should be used for production media unless the server filesystem is persistent, backed up, and explicitly intended for uploaded images.
- SMTP must use production credentials and a verified sender/domain before launch.
- Thawani production keys and HTTPS checkout/API URLs must be configured before paid bookings are enabled.
- Google OAuth redirect URL must exactly end with `/api/auth/google/callback` on the production API origin.
- Keep backups, deployment logs, and request IDs available for incident review.
