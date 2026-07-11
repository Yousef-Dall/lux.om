# Shared workspace architecture

Stage 21F introduces `Workspace` as the ownership boundary for CRM and future enterprise modules.

## Workspace types

- `PERSONAL`: exactly one `personalOwnerUserId`; private marketplace CRM.
- `COMPANY`: exactly one `companyId`; independent from PMS entitlement.
- `PLATFORM`: identified by `platformKey`; restricted lux.om operational scope.

`WorkspaceMember` links a user to a workspace. Effective access comes from member role defaults plus active `WorkspacePermission` records. Optional `WorkspacePropertyScope` rows narrow company access to PMS properties. An empty property-scope set means company-wide CRM access.

## CRM ownership

`CrmContact`, `CrmLead`, and `CrmActivity` now require `workspaceId`. Legacy `companyId` and `ownerUserId` remain as compatibility and source-link fields during the transition. New access checks scope by `workspaceId` first.

## PMS relationship

PMS continues to use `PmsCompanyEntitlement`, `PmsCompanyMember`, and PMS-specific permissions. Shared CRM membership is synchronized separately. Suspending PMS does not deactivate workspace membership or unrelated CRM access.

## Invariants

- One company workspace per company.
- One personal workspace per user.
- One platform workspace per platform key.
- One member row per workspace/user.
- CRM records cannot exist without a workspace.
- Property scope never grants access outside the workspace company.
