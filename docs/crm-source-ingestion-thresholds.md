# CRM source ingestion thresholds

Stage 21H records canonical, idempotent source events. A source event is unique by workspace, source type, source record, and ingestion rule.

## Lead-creating signals

The following explicit or operationally meaningful events may create or advance a lead:

- listing, project, developer-profile, travel-agency, and activity inquiries;
- approved bookings;
- confirmed or paid bookings, which may advance an existing open booking lead to won;
- submitted valuation requests;
- investor watchlist actions when the record represents explicit high intent;
- saved searches only when alerts/high-intent criteria are present;
- PMS owner, tenant, and maintenance-vendor onboarding.

## Provenance-only signals

Passive browsing, ordinary listing saves, low-intent watchlist activity, and saved searches without a high-intent rule may create a `CrmSourceEvent` but must not automatically create a lead. This prevents low-quality pipeline inflation.

## Idempotency and progression

Ingestion uses canonical source IDs and transaction-scoped advisory locks. Reprocessing the same event returns the existing source event. Stronger booking signals may advance an existing open lead; they do not create duplicates. A previously lost outcome is not silently overwritten.

## Consent and privacy

Source ingestion stores the consent/lawful-contact state available at the event. It does not infer marketing consent. PMS and marketplace events use legitimate-interest status only for the operational relationship; outbound communication remains subject to channel preferences, suppression, quiet hours, and provider rules.
