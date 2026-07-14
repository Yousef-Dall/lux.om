# CRM task governance

Stage 21I-T turns the existing CRM activity task model into a dedicated operational workspace at `/crm/tasks`.

## Scope and access

- Task reads reuse the CRM lead visibility scope. A task is visible only when its linked lead is visible to the authenticated user.
- Company workspaces continue to respect property-scoped CRM membership.
- Personal CRM tasks remain visible only to the personal workspace owner and permitted operators.
- Platform operators use the existing admin CRM scope.
- Task creation and edits require manage access to the linked lead.
- Assignment changes continue through the existing assignment validator, so company tasks can only be assigned to active CRM-enabled members inside the relevant property scope.

## Server-side browsing

`GET /api/crm/tasks` supports:

- workspace or company scope
- search across task subject/body, lead title, contact identity, and company name
- status, priority, assignee, overdue-only, and due-date filters
- sorting by due date, priority, creation time, or status
- stable `take` and `skip` pagination

The response includes a pagination object and preserves the previous summary and `limited` fields for compatibility with the CRM overview.

## Task lifecycle

Tasks are CRM activities with type `TASK`. The operational workspace can:

- create a task against an existing scoped lead
- set subject, notes, due date, priority, and assignee
- update those governed fields
- move a task between `OPEN`, `COMPLETED`, and `CANCELLED`
- complete an open task directly from the register

Completion timestamps remain server controlled through the existing activity update route.

## UX and accessibility

- Filters and pagination are stored in the URL.
- Create and review flows use the shared accessible dialog with focus trapping and focus restoration.
- Read-only users receive an explicit permission state and no mutation controls.
- English and Arabic copy, RTL direction, keyboard navigation, and narrow-screen task cards are covered by browser tests.

## Deliberate exclusions

This batch does not introduce recurring tasks, reminders, notifications, task dependencies, custom task types, bulk mutation, or a new database model. Those require separate product and delivery contracts.
