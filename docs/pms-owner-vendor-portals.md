# PMS owner and vendor portals

## Owner portal

Access is granted explicitly by a PMS manager through `PmsOwnerPortalAccess`. A grant is property-specific and may independently allow quote approval and maintenance-cost visibility.

The owner overview may contain:

- assigned property metadata;
- aggregate occupancy counts;
- currency-separated approved financial summaries;
- published owner statements and linked private documents;
- maintenance status and permitted costs;
- quote approval requests;
- payout batch status and external reference evidence;
- portal decision and activity history.

The contract does not serialize tenant names, emails, identity documents, lease private notes, payment methods, or internal accounting ledgers. A user with access to Property A cannot select Property B by changing a query parameter; the server resolves the supplied access grant first.

Published statements download only through authenticated private-document routes with no-store/private cache headers.

## Vendor portal

Access is granted explicitly through `PmsVendorPortalAccess`, linking one user to one vendor record. The portal returns only work orders whose `vendorId` matches that grant.

Allowed vendor actions:

- inspect assigned work order, property label, unit label, and linked asset context;
- submit a quote;
- propose scheduling;
- start assigned work;
- request completion;
- add progress comments;
- upload before/after evidence, invoices, and related private files;
- download files attached to assigned work.

Vendors cannot approve their own quote, complete internal finance review, view unrelated work orders, inspect tenants, browse owner balances, or access the PMS accounting ledger.

## Frontend routes

- `/owner`: owner collaboration workspace.
- `/vendor`: vendor collaboration workspace.

Both routes are guarded by the `ownerAccess` or `vendorAccess` summary returned by `/api/auth/me`. The guard prevents restricted pages from initiating portal API requests. Backend authorization remains authoritative even if frontend state is manipulated.

## Release verification

Test at least:

1. owner with one property;
2. owner with two property grants switching between them;
3. unrelated user requesting owner routes;
4. vendor with one assigned and one unassigned work order;
5. owner attempting vendor routes;
6. vendor attempting internal PMS accounting routes;
7. private document download for allowed and denied users;
8. responses containing no tenant identity strings.
