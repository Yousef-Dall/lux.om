# Mobile workspace extension guidance

Mobile clients should load `/api/crm/access` first, cache workspace summaries only for the active session, and send workspace selection through existing company/personal filters until explicit `workspaceId` query support is promoted.

Rules:

- Never infer access from user role alone.
- Never infer CRM access from PMS entitlement.
- Use `workspaceId` on returned CRM records as the isolation boundary.
- Respect property scope before presenting PMS-linked records.
- Do not fetch CRM record endpoints after access returns `hasAccess: false`.
- Treat platform workspaces as admin-only.
