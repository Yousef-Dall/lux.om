# Workspace membership and permission matrix

| Role | CRM view | CRM manage | Assign | Workspace manage |
|---|---:|---:|---:|---:|
| OWNER | Yes | Yes | Yes | Yes |
| MANAGER | Yes | Yes | Yes | Yes |
| MEMBER | Yes | Yes | No by default | No |
| VIEWER | Yes | No | No | No |
| Platform admin | Global oversight | Global | Global | Global |

Active explicit permission rows are additive to role defaults. PMS permissions remain separate and are not evaluated for general CRM access after backfill.

Property scopes apply only to company workspaces and only to CRM records linked to `pmsPropertyId`. Company-wide CRM records remain unavailable to property-restricted members unless intentionally assigned a property.
