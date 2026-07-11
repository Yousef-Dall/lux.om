# API contract guide

Stage 21F uses backend-owned Zod-compatible contract literals in `backend/src/modules/crm/contracts` and generates frontend TypeScript types into `frontend/src/generated/crmContract.ts`.

Commands:

```bash
npm run contracts:crm:generate
npm run contracts:crm:check
```

Compatibility rules:

- Existing `/api/crm` and `/api/pms` URLs remain unchanged.
- Additive fields such as `workspaceId` are backward compatible.
- Legacy ownership fields remain during the deprecation window.
- Breaking request or response changes require a versioned endpoint or a documented compatibility period.
- Mobile clients should use `workspaceId` as the stable ownership key and treat company/user legacy fields as source metadata.
