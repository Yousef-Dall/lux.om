# CRM account governance

Stage 21I-U moves CRM accounts out of the combined revenue-operations page into a dedicated operational workspace at `/crm/accounts`.

## Scope and access

- Every list, detail, create, contact-addition, and archive request is resolved against the authenticated CRM workspace.
- Property-scoped members only see and mutate accounts attached to their assigned PMS properties.
- Viewers receive the same account register and detail evidence without mutation controls.
- Account creation cannot assign a property, owner, parent, or team member outside the selected workspace scope.

## Register contract

`GET /api/crm/accounts` supports:

- server-side search across account name, legal name, registration number, email, phone, and industry;
- account-type filtering;
- active, archived, or all-state filtering;
- deterministic sorting by name, creation time, or update time;
- bounded `take` and `skip` pagination;
- active and archived summary counts for the filtered workspace scope.

The frontend stores search, type, state, sorting, direction, and page in the URL. Filter edits are committed atomically through the Apply action so rapid control changes cannot overwrite each other.

## Creation and relationships

Account creation uses the existing Stage 21H validation contract. Property-scoped workspaces require an allowed PMS property. The account center intentionally does not expose arbitrary owner or team assignment until a dedicated governed membership editor is delivered.

Contacts are added through `POST /api/crm/accounts/:id/contacts`. The backend normalizes email and phone identities, rejects cross-account duplicate ownership, and records an account activity for the relationship change. Archived accounts cannot receive new contacts.

## Archive lifecycle

`PATCH /api/crm/accounts/:id/archive` requires:

- CRM manage access;
- property-scope access to the account;
- an explicit archive or restore boolean;
- a human-readable reason.

State changes create immutable CRM account activities containing the actor, action, reason, and timestamp. Repeating a request for the account's current state is idempotent and does not create duplicate activities.

Archiving changes operational visibility only. Contacts, deals, source evidence, and historical activities remain preserved and available in account detail.

## User experience

The account center provides:

- a server-paginated register;
- URL-persisted filters;
- accessible create, detail, contact, and state-review dialogs;
- keyboard focus restoration;
- English and Arabic copy;
- RTL and narrow-screen layouts;
- explicit read-only states.

Deal stage transitions and contact merges remain on their existing governed workflows.
