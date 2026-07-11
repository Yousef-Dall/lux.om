# CRM Stage 21H migration and backfill

Migration: `20260711233000_crm_stage21h_revenue_operations`

## Migration behavior

The migration is additive. It creates account, deal, pipeline, stage-history, score, identity, source, consent, suppression, template, policy, and delivery tables. It adds nullable compatibility fields to existing contacts, leads, and activities.

For every existing workspace it creates a deterministic default pipeline and maps existing lead statuses to stages. Archived leads preserve the latest known pre-archive commercial status when the Stage 21D status-change timeline contains it. Existing contacts receive normalized identity rows, existing leads receive a baseline score snapshot, and existing lead sources receive canonical source events.

No existing lead, inquiry, booking, activity, task, or communication history is deleted.

## Required deployment sequence

```bash
npm run verify:db-safety
npm run db:migrate:status || true
npm run db:migrate:deploy
npm run db:generate
npm run jobs:crm-scores:once
npm run ops:crm-stage21h:verify-backfill
```

The score job replaces the migration baseline with the current deterministic scoring version. It is safe to rerun; score snapshots use state fingerprints and durable job keys.

## Verification failures

The verifier requires zero for:

- leads without a pipeline, stage, calculated score, or score snapshot;
- contacts missing active normalized identities when an email/phone exists;
- lead, deal, pipeline, stage, contact, or history workspace mismatches;
- delivered attempts without provider confirmation;
- duplicate active workspace email/phone identities.

## Rollback

Because the migration backfills and new runtime code writes Stage 21H records, production rollback should restore the pre-migration database backup and deploy the prior application version together. Do not manually drop Stage 21H tables from a live database while Stage 21H code is running.
