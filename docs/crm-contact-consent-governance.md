# CRM contact consent governance

Stage 21I-AA moves per-contact communication consent into the dedicated CRM contact center.

## Scope

The contact detail route allows CRM managers to review and update one preference per communication channel:

- consent status
- lawful basis
- preferred-channel flag
- IANA timezone
- optional quiet-hour start and end minutes

Active suppression entries remain authoritative. Updating consent does not remove, deactivate, or override a suppression.

## Server safeguards

The API enforces the following rules inside the existing workspace and property scope:

- consented and legitimate-interest statuses require a lawful basis
- only consented or legitimate-interest channels can be preferred
- selecting a preferred channel clears the preferred flag from other channels for the same contact
- quiet-hour start and end must be supplied together
- the timezone must be a valid IANA timezone
- statuses without a current lawful-contact basis store a null current lawful basis while the audit activity preserves the prior state
- archived contacts must be restored before consent can change
- users cannot change a contact outside their assigned property scope

Every successful preference update records an immutable completed CRM activity containing the previous and next preference evidence. The activity contains policy metadata only and does not duplicate the contact destination.

## Access behavior

Users with CRM manage access can update active contacts in their scope. View-only users and archived contacts retain a read-only preference and suppression view.

## Operational boundaries

Contact consent and lawful basis are managed in the contact center. Workspace communication policy, suppression administration, and immutable template versions remain in `/crm/settings/communications`. Message drafting and delivery operations remain in `/crm/communications`.
