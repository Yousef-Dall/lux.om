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

## Stage 21I-R operational communications center

The authenticated `/crm/communications` route now exposes the governed delivery register without weakening the Stage 21H outbox contract.

- `GET /api/crm/delivery-attempts` supports workspace-scoped server pagination, contact/name/destination/template search, channel/provider/status filters, and deterministic sorting.
- `GET /api/crm/contacts` provides a property-scoped contact selector with server search and pagination. Merged or archived contacts are excluded.
- Delivery records include the visible contact, linked lead/deal/activity references, immutable template version, provider state, provider reference, and retained message metadata when it has not been redacted.
- Managers can save `DRAFT_ONLY` records or queue `VERIFIED_EMAIL`. Queued email requires an explicit acknowledgement that submission and delivery remain unconfirmed.
- WhatsApp and phone remain draft-only in this workspace. No unofficial provider automation was added.
- The composer derives the destination from the selected stored identity. It does not permit an arbitrary recipient address or phone number.
- Idempotency keys are generated once per composer session so duplicate submissions are safely replayed by the existing backend contract.
- Workspace viewers receive a read-only register. Company property scope continues to constrain both contacts and delivery attempts.
- URL-persisted filters, Arabic copy, RTL rendering, keyboard focus restoration, and narrow-screen layouts are covered by browser tests.

Template creation/version administration, suppression-list administration, delivery retry controls, and provider-worker operations remain separate controlled batches.
