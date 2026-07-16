# CRM communication governance

Stage 21I-Z moves workspace-level communication administration to `/crm/settings/communications`.

## Boundaries

The center owns:

- workspace timezone, quiet-hour, hourly-rate, and retention policy;
- suppression register browsing and governed upsert;
- communication-template creation;
- immutable template version creation;
- reason-bearing template archive and restore.

It does not replace:

- per-contact consent and lawful-basis management in the contact center;
- draft and delivery-attempt operations in the communications center;
- provider confirmation and durable delivery processing.

## Access control

Workspace-level policy and suppression data require workspace-management access. Property-restricted users receive an explicit boundary state and the frontend does not request workspace-wide policy, suppression destinations, or templates.

Existing communication-template reads remain compatible with the governed composer for users who can create communications. Template mutations require workspace-management access.

## Suppression register

The register supports server-side search, channel, reason, lifecycle status, sorting, and pagination. Active status excludes entries whose expiry time has passed even when their stored `active` flag remains true.

Suppression upsert always normalizes the destination using the delivery channel before applying the workspace/channel/destination uniqueness rule.

## Template governance

Every content change creates a new `CrmCommunicationTemplateVersion`. Historical versions are never edited. Each version exposes its delivery-attempt usage count.

Archived templates:

- remain available for historical delivery evidence;
- cannot receive new versions;
- can be restored with a reason.

Archive and restore actions create immutable CRM activity evidence. Repeating the same lifecycle request is idempotent and does not create duplicate lifecycle evidence.

## Data and migration impact

This stage changes no Prisma model, migration, backfill, or generated CRM contract.
