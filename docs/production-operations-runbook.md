# lux.om Production Operations Runbook

This runbook is the production checklist for deploying, monitoring, and operating lux.om.

## Required production checks

Before every release, run:

    npm run verify:production

This verifies production environment rules, typecheck, integration tests, and builds.

## Backend production environment

Required production values:

    NODE_ENV=production
    DATABASE_URL="postgresql://..."
    JWT_SECRET="a-long-strong-random-secret-at-least-48-characters"
    CORS_ORIGIN="https://lux.om,https://www.lux.om"
    FRONTEND_URL="https://lux.om"
    EMAIL_DELIVERY_MODE="smtp"
    RATE_LIMIT_TRUST_PROXY_HOPS=1

Never use localhost production frontend, CORS, or OAuth redirect values.

## SMTP setup

Production must use SMTP:

    EMAIL_DELIVERY_MODE="smtp"
    SMTP_HOST="smtp.your-provider.com"
    SMTP_PORT=587
    SMTP_SECURE=false
    SMTP_USER="no-reply@lux.om"
    SMTP_PASS="provider-password-or-app-password"
    MAIL_FROM="lux.om <no-reply@lux.om>"

Transactional emails support email verification, password reset, email change, account security, booking, payment, cancellation, verification, and trust/safety workflows.

## Email preferences

Users can manage optional emails at:

    /profile?section=email-preferences

Mandatory account security, verification, trust/safety, payment, cancellation, and transaction emails cannot be disabled.

## Email delivery audit

Admins can inspect delivery events at:

    /admin/email-deliveries

The audit includes logged, sent, skipped, and failed email delivery events.

The admin dashboard also includes a 7-day email delivery health summary.

## Email delivery retention cleanup

Dry run:

    npm run jobs:email-deliveries:prune -w backend -- --days=180 --dry-run

Execute cleanup:

    npm run jobs:email-deliveries:prune -w backend -- --days=180 --execute

Recommended schedule: once per day during a low-traffic window.

Retention below 30 days is blocked.

## Database migrations

Production migration command:

    npm run db:migrate:deploy -w backend

Do not run destructive development reset or seed commands in production.

## Backend deployment

Recommended sequence:

    npm install
    npm run db:migrate:deploy -w backend
    npm run build -w backend
    npm run start -w backend

Health checks:

    GET /health
    GET /api/health
    GET /api/ready

Use `/api/ready` for deployment readiness because it checks database connectivity.

## Frontend deployment

Set the production backend API URL before building:

    VITE_API_URL="https://api.your-domain.com"
    npm run build -w frontend

Deploy:

    frontend/dist

## Post-deployment smoke test

After deployment, verify:

- `/api/ready` returns healthy database status.
- Login works.
- Google OAuth works if enabled.
- Email verification works.
- Password reset email works.
- Profile email preference deep link opens the preference card.
- Booking creates in-app and email notifications.
- Admin notification center works.
- Admin email delivery audit page loads.
- Admin email health summary loads.
- Non-admin users cannot open admin pages.

## Daily admin monitoring

Daily:

- Check admin email health summary.
- Review failed email deliveries.
- Review pending verification requests.
- Review trust/safety reports.
- Review suspicious accounts.
- Confirm no unexpected spike in skipped or failed deliveries.

Weekly:

- Confirm email delivery retention cleanup ran.
- Review SMTP provider delivery and bounce dashboard.
- Review production logs for repeated auth or rate-limit errors.
- Confirm backups are healthy.

## CRM Stage 21C operational checks

The private CRM is served at `/crm` with API routes under `/api/crm`. Treat CRM contact data, notes, assignments, expected values, source links, and timeline records as confidential operational data. CRM endpoints are included in the sensitive no-store API policy.

Before release, verify one marketplace-owner workspace, one global admin, one unrestricted PMS CRM member, and two property-scoped PMS CRM members. Confirm source-owner, company, and assigned-property boundaries using direct API requests as well as the UI. General contact-form leads with no owner or company must remain admin-only.

Marketplace listing and activity inquiries create their CRM lead inside the same transaction. After deployment, submit one test inquiry and confirm the inquiry, contact, lead, source link, assignment, and initial timeline note are present exactly once.

See `docs/crm-stage21c-foundation.md` for data ownership, API routes, transition rules, and the complete verification checklist.

## CRM Stage 21D operations

The Stage 21D migration adds CRM task priority and communication metadata plus WhatsApp/system timeline types. Deploy it with the normal production `prisma migrate deploy` process before starting the updated backend.

CRM email and WhatsApp actions are draft-only links. They do not send through lux.om and must not be monitored as delivery events. Operators log the actual external outcome in the CRM timeline. Lead scoring and next-best actions are deterministic operational aids, not AI decisions.

When investigating CRM totals, always reproduce the same workspace, company, assignment, source, status, priority, and date filters. Pipeline, analytics, task queues, and lead lists all apply the same company and PMS property access scope.
