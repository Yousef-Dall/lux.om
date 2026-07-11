# CRM and PMS relationship

CRM and PMS share company identity but no longer share entitlement.

- CRM access: `WorkspaceMember` and `WorkspacePermission`.
- PMS access: `PmsCompanyMember`, PMS permission keys, PMS entitlement, and PMS property scope.
- PMS-linked CRM lead: company workspace plus optional `pmsPropertyId`.
- General company CRM lead: company workspace without a PMS property.
- PMS suspension: blocks PMS routes but does not remove CRM workspace membership.
- Personal CRM: private personal workspace.
- Admin CRM: platform/global oversight, not company ownership.

The compatibility synchronizer maps PMS members into company workspace membership, but CRM member management can occur directly through the CRM workspace route without enabling PMS.
