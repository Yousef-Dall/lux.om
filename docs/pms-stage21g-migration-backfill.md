# PMS Stage 21G migration and backfill

Migration:

`20260711220000_pms_stage21g_financial_operations`

## Before deployment

1. Confirm the Stage 21F migration is applied.
2. Stop financial write traffic or place the service in a controlled maintenance window.
3. Create and verify a PostgreSQL custom-format backup.
4. Snapshot private PMS document storage.
5. Review duplicate or malformed legacy rent records before applying the migration.

## Migration behavior

The migration:

- creates the charge, allocation, deposit, period, reconciliation, payout, portal, asset, maintenance-plan, and inspection structures;
- makes `PmsRentPayment.rentDueItemId` nullable for split or unallocated payments;
- creates one issued structured rent charge and one rent line for each legacy rent due item;
- links the legacy due item to that charge;
- creates active allocations for confirmed legacy payments where payment and charge currency match;
- recomputes charge paid and balance values;
- creates one security-deposit account for each lease, using the lease deposit as expected balance only;
- adds issued-charge immutability triggers and financial consistency checks.

The migration does not invent deposit collection, bank reconciliation, owner payout completion, or missing evidence.

## Apply

```bash
npm run verify:db-safety
npm run db:migrate:status
npm run db:migrate:deploy
npm run db:generate
npm run db:migrate:status
```

Apply to the integration database before running tests:

```bash
cd backend
node scripts/run-with-test-env.mjs npx prisma migrate deploy
cd ..
```

## Verify backfill

```bash
npm run ops:pms-stage21g:verify-backfill
```

The verifier fails when it finds:

- a rent due item without a structured charge;
- a confirmed rent payment without a compatible active allocation;
- a lease without a deposit account;
- an invalid charge paid/balance calculation;
- an allocation whose currency differs from its payment or charge.

Review failures; do not bypass constraints or manually mark the migration applied. Correct the source data through a reviewed remediation script and rerun verification.

## Rollback policy

Do not use `prisma migrate reset`. Restore the verified pre-deployment database backup and the matching private-document snapshot. Because the migration backfills durable financial links and later writes may depend on them, reverse SQL against a live partially-used Stage 21G database is not a safe rollback strategy.
