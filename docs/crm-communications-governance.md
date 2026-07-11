# CRM communications governance

## Delivery states

- `DRAFT`: mailto/WhatsApp/phone drafting only; no provider claim.
- `QUEUED`: accepted by the durable CRM outbox, not yet submitted externally.
- `PROCESSING`: claimed by one worker with a claim token.
- `SUBMITTED`: accepted by a configured provider; delivery is not yet confirmed.
- `DELIVERED`, `FAILED`, or `BOUNCED`: provider-confirmed terminal information.
- `BLOCKED`: consent, suppression, legal, identity, or adapter policy prevented submission.
- `CANCELLED`: explicitly cancelled before delivery.

The database rejects `DELIVERED` without `providerConfirmedAt`.

## Governance checks

Before queueing and again before provider submission, the system verifies:

- destination matches a stored normalized contact identity;
- contact consent or documented lawful basis for real sending;
- active suppression entries and opt-outs;
- workspace and contact quiet hours using an IANA timezone;
- workspace hourly rate limits;
- channel/provider compatibility.

## Provider adapters

Verified email uses the existing SMTP infrastructure only when `CRM_EMAIL_DELIVERY_ENABLED=true` and SMTP credentials are configured. Provider submission runs through `npm run jobs:crm-communications:once` or an equivalent durable scheduler.

WhatsApp drafts remain available. Real WhatsApp sending is not enabled unless an official WhatsApp Business adapter, credentials, and webhook verification are configured.

## Webhooks

Provider callbacks use `/api/crm-provider-webhooks/:provider` and require `CRM_PROVIDER_WEBHOOK_SECRET`. The provider message ID identifies the submitted attempt. Duplicate terminal callbacks are idempotent.

## Retention

The communication job redacts destination and message payload after each workspace's retention window. It preserves the delivery attempt, status, timestamps, provider identifiers, and audit history.
