# Release candidate launch readiness report

This document is the final launch-readiness layer for the lux.om production release candidate. It summarizes what has been hardened, what must be verified before launch, and how the team should make a go/no-go decision.

## Release candidate scope

The release candidate covers the production-ready marketplace foundation for:

- public listing and activity discovery
- owner, provider, developer, customer, and admin account flows
- email verification, password reset, email change, and account security notifications
- verification submission/review and public trust badges
- trust/safety reporting and admin review
- booking request, provider approval, cancellation, payment, and refund-state workflows
- Thawani hosted checkout session creation and payment sync
- transactional email delivery audit and admin health checks
- frontend SEO, cache/versioning, accessibility, mobile, empty, error, and loading states
- production deployment, migration, backup, rollback, and smoke-verification runbooks

This document does not replace the deployment checklist. Use it as the final release sign-off sheet, then execute [the production deployment checklist](production-deployment-checklist.md) step by step.

## Production hardening completed

The current release candidate includes the following completed hardening layers:

- AR — production HTTP security headers and cache hardening
- AS — CORS, trusted proxy, HTTPS, and secure cookie hardening
- AT — API payload limits, request validation, and error response hardening
- AU — static uploads/media serving security and cache policy
- AV — frontend production cache/versioning safety
- AW — production logging, request IDs, and sensitive data redaction
- AX — Prisma migration, database backup, and deploy rollback safety
- AY — payment/webhook integrity re-audit
- AZ — admin authorization and role-permission regression audit
- BA — critical auth/account/verification/trust notification flow smoke tests
- BB — critical marketplace booking/payment/reporting flow smoke tests
- BC — accessibility, mobile, empty/error/loading final polish
- BD — environment validation and production deployment checklist

## Automated verification commands

Run the full release-candidate verification chain from a clean `main` checkout:

```bash
npm install
npm run verify:production
```

The release-candidate verifier can be run directly:

```bash
npm run verify:release-candidate
```

Use these targeted checks when isolating issues:

```bash
npm run verify:deployment-checklist
npm run verify:db-safety
npm run typecheck
npm run verify:seo
npm run verify:frontend-polish
npm run test:smoke
npm run test:marketplace-smoke
npm run test:integration
npm run build
npm run verify:frontend-cache
```

Database migration and backup checks before deploy:

```bash
npm run db:migrate:status -w backend
npm run ops:db:backup -w backend -- --output=../backups/lux-om-predeploy.dump
npm run db:migrate:deploy
```

The backup command requires PostgreSQL client tools and `pg_dump`. On Windows or managed machines, set `PG_DUMP_PATH` to the full `pg_dump` executable path.

## Go/no-go checklist

Mark the release `GO` only when every item below is true:

- [ ] The release commit on `main` is the exact commit being deployed.
- [ ] `npm run verify:production` passes from a clean checkout.
- [ ] `npm run verify:release-candidate` passes.
- [ ] `npm run test:smoke` passes.
- [ ] `npm run test:marketplace-smoke` passes.
- [ ] The production database backup exists outside Git and has been verified before migrations.
- [ ] `npm run db:migrate:status -w backend` shows the expected migration state.
- [ ] Production `DATABASE_URL` does not point to a `_test` database.
- [ ] production SMTP is configured with a verified sender/domain.
- [ ] Cloudinary credentials and folder are configured for production media storage.
- [ ] Thawani production secret, publishable key, API URL, and checkout URL are configured.
- [ ] Google OAuth production redirect URL exactly ends with `/api/auth/google/callback` on the production API origin.
- [ ] `CORS_ORIGIN` contains only exact HTTPS frontend origins.
- [ ] `FRONTEND_URL` is the canonical HTTPS frontend origin.
- [ ] `VITE_API_URL` points to the production backend API origin when frontend/backend are split.
- [ ] `/api/ready` is healthy after backend deploy and database migration.
- [ ] `robots.txt`, `sitemap.xml`, and `site.webmanifest` are reachable on the live frontend.
- [ ] A rollback owner is named and reachable during deployment.
- [ ] A customer-support/admin-monitoring owner is named for the first launch window.

Mark the release `NO-GO` when any of these is true:

- [ ] Any required verification command fails.
- [ ] Database backup or migration status cannot be confirmed.
- [ ] Production SMTP, Cloudinary, Thawani, Google OAuth, CORS, or frontend API URL values are missing or still point to localhost/UAT unexpectedly.
- [ ] `/api/ready` fails after deploy.
- [ ] Registration, verification, password reset, booking, payment sync, or admin trust/safety smoke paths fail on production.
- [ ] Rollback ownership or database restore path is unclear.

## Deployment sign-off sequence

Use this sequence for launch day:

1. Confirm release commit and branch.
2. Confirm hosting environment variables and secrets.
3. Run `npm run verify:production`.
4. Run `npm run verify:release-candidate`.
5. Run `npm run db:migrate:status -w backend`.
6. Create and verify the database backup with `npm run ops:db:backup -w backend`.
7. Run `npm run db:migrate:deploy`.
8. Deploy/restart the backend and verify `/api/ready`.
9. Build/deploy the frontend and verify cache rules.
10. Run live auth/account smoke checks.
11. Run live marketplace booking/payment/reporting smoke checks.
12. Confirm admin health, email delivery, trust/safety, and notification queues.
13. Announce launch readiness only after the rollback owner and monitoring owner both sign off.

Record the deployed commit, deployment time, migration status, backup file location, smoke-test result, rollback owner, monitoring owner, and final GO/NO-GO decision in the release notes or deployment tracker.

## Known limitations and deferred post-launch items

The following are not blockers for the current release candidate, but should remain visible after launch:

- The backup helper depends on `pg_dump`; developer workstations may need PostgreSQL client tools or `PG_DUMP_PATH`.
- `npm audit` is not currently part of the enforced `verify:production` chain because dependency availability and advisory severity can change outside the repo; run it manually before launch and review any moderate-or-higher advisories.
- Frontend bundle-size warnings remain advisory. The current build may emit a large main chunk warning; track route-level code splitting as a post-launch performance improvement.
- Live Thawani behavior must still be smoke-tested with production credentials before paid bookings are publicly promoted.
- Real SMTP deliverability should be monitored during the first launch window through the admin email delivery audit and provider mail logs.
- Cloudinary quota, folder naming, and media transformations should be monitored after real upload traffic begins.
- Search engine indexing should be monitored after launch through sitemap submission and analytics/search-console tooling.
- Accessibility polish is verified statically and through build checks; schedule a manual screen-reader and keyboard pass after the first production deployment.

## Launch decision

Final decision format:

```text
Release candidate commit:
Deployment date/time:
Database backup file/location:
Migration status:
Smoke checks:
Rollback owner:
Monitoring owner:
Decision: GO / NO-GO
Notes:
```

Do not mark `GO` unless every required automated check has passed, the production environment is verified, `/api/ready` is healthy, and the rollback path is clear.
