# CRM contact governance

Stage 21I-V introduces the dedicated CRM contact center at `/crm/contacts`.

## Operational scope

The contact center is the operational surface for:

- workspace- and property-scoped contact browsing;
- server-side search, account filtering, consent filtering, state filtering, sorting, and pagination;
- active and archived contact totals;
- account-linked contact creation through the existing identity-governed account endpoint;
- contact identity, consent, suppression, lead, and deal visibility;
- duplicate preview and controlled irreversible merge;
- audited contact archive and restore.

The contact center does not replace account relationship management, communication delivery, or deal-stage governance. Those workflows remain on their dedicated CRM routes.

## Scope and access

Every register and detail request resolves CRM workspace access before reading records. Property-scoped members only receive contacts linked through accounts, leads, or primary deals inside their assigned properties.

Mutation controls require workspace management access. Read-only members can browse the same scoped register and details without seeing creation, archive, restore, or merge actions.

## Identity creation

Contacts are created through an active account. The server requires at least one email or phone identity and preserves the existing normalized identity uniqueness rules. A conflicting identity is rejected instead of silently moving a contact between accounts.

## Archive lifecycle

Archive and restore operations:

- require a reason of at least three characters;
- preserve all linked leads, deals, source records, activities, delivery attempts, and identities;
- record `Contact archived` or `Contact restored` CRM activities;
- are idempotent when the contact is already in the requested state;
- reject merged aliases, which cannot be managed independently.

Archived contacts are hidden from the default active register but remain available through the archived and all-state filters.

## Merge governance

Duplicate merging continues to use the existing preview and commit contract. The operator must review both identities, resolve supported conflicts, acknowledge irreversibility, and receive the immutable merge audit reference after completion.

The duplicate contact is archived and its supported relationships are relinked to the primary contact. Cross-workspace and out-of-property-scope merges remain blocked by the backend.

## URL contract

The contact center persists browsing state with these query parameters:

- `workspaceId`
- `contactQ`
- `contactAccount`
- `contactConsent`
- `contactStatus`
- `contactSort`
- `contactDirection`
- `contactPage`

Filter edits are committed atomically when the operator selects **Apply filters**, preventing rapid-control URL races.

## Validation coverage

Stage 21I-V adds integration coverage for paginated scoped browsing, consent and account filters, idempotent archive/restore, activity evidence, and cross-property denial. Browser coverage verifies URL persistence, account-linked creation, duplicate review, archive governance, Arabic RTL behavior, narrow-screen layout, and read-only controls.
