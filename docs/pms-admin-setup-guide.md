# PMS admin setup guide

Use this guide when enabling the private PMS module for a company. PMS access is company-scoped and is separate from global platform administration.

## 1. Enable the PMS entitlement

1. Log in as a platform admin.
2. Open the admin PMS access page.
3. Find the developer/property-management company.
4. Set the PMS entitlement to `ACTIVE` or `TRIAL`.
5. Record setup notes, trial end date, and who approved the workspace.

Only companies with an active or trial PMS entitlement can load `/pms` APIs.

## 2. Add the first PMS owner

1. Confirm the target user has a verified lux.om account.
2. Add the user to the PMS company as `PMS_OWNER`.
3. Leave property scope empty for the first owner so they can manage all properties.
4. Confirm `/api/auth/me` returns PMS access for that user.

The PMS owner can then manage staff, property scopes, portfolios, templates, imports, and operational settings inside the PMS portal.

## 3. Recommended launch roles

| Role | Launch use | Notes |
| --- | --- | --- |
| `PMS_OWNER` | Company administrator / landlord | Full PMS workspace control. |
| `PMS_MANAGER` | Operations manager | Broad operations, staff, documents, maintenance, communications. |
| `PMS_ACCOUNTANT` | Finance team | Rent, accounting, statements, exports. |
| `PMS_MAINTENANCE` | Maintenance coordinator | Work orders, vendors, quotes, maintenance documents. |
| `PMS_AGENT` | Leasing/admin assistant | Inventory and tenancy operations where permitted. |
| `PMS_VIEWER` | Auditor/read-only stakeholder | Read-only access where allowed. |

Property-scoped staff can only see selected PMS properties and related units/records where route guards enforce property scope. Leave scope empty only for all-property access.

## 4. Pre-onboarding checks

- PMS entitlement is active or trial.
- At least one `PMS_OWNER` exists.
- Staff accounts are verified and not suspended/deactivated.
- Staff property scopes match the onboarding plan.
- Tenant portal access is granted only after the tenant has a normal lux.om user account.
- Public marketplace listings remain separate unless a PMS property/unit is explicitly linked.

## 5. Support and rollback

To pause a PMS customer, suspend the company entitlement instead of deleting data. To remove an individual, deactivate their PMS company membership. These actions preserve audit history and reduce data-loss risk.
