# Workspace migration and backfill

Migration: `20260711193000_shared_workspace_architecture`.

The migration:

1. Creates workspace, membership, permission, and property-scope tables.
2. Creates the `CRM` platform workspace.
3. Creates personal workspaces for legacy personal CRM owners.
4. Creates one company workspace for every existing company.
5. Copies PMS members into shared workspace membership without checking PMS entitlement status.
6. Copies existing PMS property assignments into workspace property scopes.
7. Backfills CRM contact, lead, and activity `workspaceId` values.
8. Makes CRM workspace ownership required and adds workspace-scoped contact identity constraints.

Before deploy, check duplicate normalized contact identities inside the same legacy owner scope. Resolve duplicates before applying the unique workspace identity indexes.

Legacy `companyId` and `ownerUserId` fields remain temporarily. Removal is deferred until all source-link creation paths and external clients use `workspaceId` exclusively.
