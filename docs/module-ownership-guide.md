# Module ownership guide

## Backend

- `modules/workspaces`: workspace provisioning, membership, permissions, visibility, property scope, and shared access decisions.
- `modules/crm/contracts`: canonical Zod-compatible CRM contract literals and response schemas.
- `routes/crm.ts`: compatibility route composition and remaining CRM domain handlers.
- `routes/pms.ts`: existing PMS route composition; future extractions should move one domain at a time without changing URLs.

Next safe backend extraction order: CRM access, contacts, leads, activities/tasks, analytics; then PMS documents, communications, reports, and automation.

## Frontend

- `features/crm/WorkspaceSelector.tsx`: reusable workspace selection UI.
- `generated/crmContract.ts`: generated CRM enum/type contract.
- `pages/Crm.tsx`: route-level orchestration retained for compatibility.

Next safe frontend extraction order: filter bar, pipeline board, lead detail, activity timeline, task editor, then PMS navigation and individual PMS module panels.
