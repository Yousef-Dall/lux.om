# CRM Stage 21D — Pipeline, communications, and sales workflow

Stage 21D upgrades the shared lux.om CRM foundation into a practical, deterministic sales and relationship workflow for marketplace operators, PMS companies, partners, and administrators.

## Product boundaries

- CRM remains available through `/crm` and `/crm/:leadId`.
- Personal marketplace records, company/PMS records, property-scoped records, and lux.om admin records retain the Stage 21C access boundaries.
- Customers never receive CRM access.
- Lead intelligence is deterministic and explainable. It does not use an AI model and does not make decisions for operators.
- Email and WhatsApp actions create local drafts only. lux.om does not claim delivery and does not send messages through these endpoints.
- Existing marketplace notifications and PMS communications remain independent and unchanged.

## Pipeline workflow

The existing lead statuses remain the canonical pipeline stages:

`NEW → CONTACTED → QUALIFIED → VIEWING_SCHEDULED / PROPOSAL_SENT / NEGOTIATION → WON / LOST → ARCHIVED`

Allowed transitions continue to be enforced by the backend. The pipeline endpoint groups scoped leads by:

- stage/status
- assigned user
- source
- company or personal/admin workspace

Expected values are summarized by currency without combining unlike currencies.

## Deterministic lead intelligence

Each returned lead includes an `intelligence` object with:

- score from 0 to 100
- `COLD`, `WARM`, or `HOT` band
- individual score reasons and points
- operational signals
- one deterministic next-best action with its reason and priority

The score uses only available, scoped data such as source quality, inquiry recency, contact completeness, pipeline progress, completed communications, repeat CRM engagement, booking/payment state, saved/watchlist/valuation signals, PMS relationship context, expected value, and operator priority. Won leads score 100; lost and archived leads score 0.

Next actions prioritize overdue tasks and overdue follow-ups before suggesting qualification, viewing, service details, document collection, proposal follow-up, decision confirmation, or relationship nurture.

## Tasks and communication history

`CrmActivity` remains the single CRM timeline and task model. Stage 21D adds:

- task/activity priority
- WhatsApp and system-notification activity types
- communication direction
- communication outcome
- template identifier

Task queues support company/personal/admin scope, assignment, status, priority, overdue-only, due-date range, and result limits. Every query inherits the lead's CRM workspace and PMS property scope.

Communication records can represent calls, email drafts/actions, WhatsApp drafts/actions, and meetings. Operators explicitly record outcomes such as draft opened, sent externally, no answer, connected, or replied. These values are operator records, not delivery receipts.

## Draft templates

The communication-template endpoint returns prefilled `mailto:` and WhatsApp links when a usable contact channel exists. Templates include initial contact, general follow-up, viewing/consultation, document request, service details, and proposal follow-up.

Opening a draft can be logged as a completed CRM communication with `DRAFT_OPENED`. The system does not infer that the external message was sent.

## Analytics foundation

The scoped analytics endpoint returns:

- total, new, and open leads
- overdue follow-ups
- open and overdue tasks
- won and lost leads
- decided-lead conversion rate
- counts by stage
- conversion summary by source

Conversion is calculated only from won and lost records. A null rate is returned when no decided records exist.

## API additions

- `GET /api/crm/analytics`
- `GET /api/crm/pipeline`
- `GET /api/crm/tasks`
- `GET /api/crm/leads/:id/communication-templates`

Existing lead and activity endpoints now return intelligence and accept the new task/communication metadata.

## Operational verification

After deployment:

1. Apply migrations with `prisma migrate deploy`.
2. Regenerate Prisma Client.
3. Verify a personal marketplace operator cannot see company CRM records.
4. Verify a property-scoped PMS member sees tasks and communications only for assigned properties.
5. Verify draft links contain the intended text and do not trigger delivery.
6. Verify analytics and pipeline totals match the filtered lead list.
7. Verify scoring reasons are present and remain deterministic for the same data and time window.
