# CRM Stage 21H architecture

## Purpose

Stage 21H expands the shared-workspace CRM into a relationship and revenue operating system without replacing the Stage 21C/21D lead model. Existing `CrmLead.status`, inquiry links, tasks, activities, URLs, and scoring explanations remain compatible.

A CRM workspace is the internal data owner. A `CrmAccount` is an external relationship inside that workspace. They are deliberately different concepts.

## Core model

- `CrmAccount` represents an individual or organization and may have parent/child accounts, an owner, a team, a PMS property scope, contacts, deals, activities, and source events.
- `CrmContact` remains the canonical person record. Multiple contacts can belong to one account. Normalized email and phone identities are unique inside a workspace.
- `CrmLead` remains the original incoming relationship signal and preserves Stage 21C/21D history. Stage 21H adds pipeline, outcome, conversion, archival, and durable scoring fields.
- `CrmDeal` represents a commercial opportunity. A contact/account may have many deals, but a source lead can be converted only once.
- `CrmPipeline` and `CrmPipelineStage` are workspace-owned. Every active pipeline must retain at least one open, won, and lost stage.
- `CrmStageHistory` is append-only and records outcome changes, reopen events, reasons, actors, and time in stage.

## Outcome and archive separation

`outcome` is `OPEN`, `WON`, or `LOST`. `archivedAt` is an independent administrative state. Archiving does not rewrite a commercial outcome. A closed deal must be reopened through an open stage before it can change to the opposite outcome, and an archived deal must be restored before stage transitions.

## Workspace and property isolation

Every new CRM record carries `workspaceId`. Company workspaces continue to enforce Stage 21F property scope. Account, contact, deal, source-event, delivery, and analytics queries apply property filtering before returning data. Customers remain blocked from internal CRM routes.

## Scoring

Scoring remains deterministic and explainable. Current values are stored on `CrmLead` for database sorting and filtering. Immutable `CrmScoreSnapshot` rows preserve score, band, version, reasons, signals, previous score, trend, timestamp, and a durable job key. No AI model is used.

## Communications

Communication APIs create governed draft or queued delivery attempts. External provider submission is performed by a durable worker after the request transaction commits. Only authenticated provider webhooks may confirm `DELIVERED`. Official WhatsApp Business support remains adapter-based; unofficial automation is not implemented.

## Analytics

Forecast and conversion analytics use complete database queries rather than paginated UI results. Pipeline and weighted values are grouped by currency. Current stage occupancy excludes archived deals, while won/lost results remain historically counted after archival.
