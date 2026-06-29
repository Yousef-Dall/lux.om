# lux.om Admin Health Checklist

Use this checklist after every deployment and during daily operations.

## Admin access

- [ ] Admin can log in.
- [ ] Admin dashboard loads.
- [ ] Non-admin users cannot access admin routes.
- [ ] Admin user management page loads.
- [ ] Suspended users cannot authenticate or use protected routes.

## Notifications

- [ ] Navbar unread notification badge updates.
- [ ] Notification center loads.
- [ ] Mark one notification as read works.
- [ ] Mark all as read works.
- [ ] Notification action links route to the correct page.
- [ ] Booking notification links open the related dashboard booking.

## Transactional email

- [ ] SMTP mode is enabled in production.
- [ ] Email verification email sends.
- [ ] Password reset email sends.
- [ ] Email change verification sends.
- [ ] Booking workflow email sends.
- [ ] Verification decision email sends.
- [ ] Trust/safety report outcome email sends.
- [ ] Email footer includes manage-preferences link.
- [ ] `/profile?section=email-preferences` scrolls to the preference card.

## Email delivery audit

Open:

    /admin/email-deliveries

Check:

- [ ] Logged or sent events appear.
- [ ] Failed delivery filter works.
- [ ] Skipped delivery filter works.
- [ ] Search by recipient email works.
- [ ] Detail panel shows action URL.
- [ ] Detail panel shows preferences URL.
- [ ] Errors or reasons are visible when present.

## Email health summary

Open the admin dashboard and check:

- [ ] 7-day total email delivery events.
- [ ] Failed count.
- [ ] Skipped count.
- [ ] Logged count.
- [ ] Sent count.
- [ ] Recent failures list.
- [ ] Link to full email audit page.

Investigate immediately when:

- failed count is greater than zero after SMTP changes,
- failed count spikes unexpectedly,
- sent count drops to zero in production,
- logged count appears in production,
- many optional emails are skipped unexpectedly.

## Email retention cleanup

Dry run:

    npm run jobs:email-deliveries:prune -w backend -- --days=180 --dry-run

Execute:

    npm run jobs:email-deliveries:prune -w backend -- --days=180 --execute

Check:

- [ ] Dry run reports expected matched count.
- [ ] Execute mode is scheduled only in production operations.
- [ ] Retention days are at least 30.
- [ ] Cleanup job is scheduled during low-traffic hours.

## Trust and safety

- [ ] Admin trust/safety reports page loads.
- [ ] Pending reports are visible.
- [ ] Admin can review reports.
- [ ] Reporter receives notification/email after review.
- [ ] Public provider report modal works.
- [ ] Non-admin users cannot access admin report queue.

## Verification

- [ ] Admin verification queue loads.
- [ ] Pending verification requests are visible.
- [ ] Approval updates public trust badge.
- [ ] Rejection requires notes when needed.
- [ ] Submitter receives notification/email after decision.
- [ ] Duplicate pending verification requests are blocked.

## Marketplace operations

- [ ] Listing discovery works.
- [ ] Activity discovery works.
- [ ] Verified-only filters work.
- [ ] Trust sorting works.
- [ ] Provider trust profiles load.
- [ ] Provider directory badges render.

## Booking and payment

- [ ] Customer can create booking request.
- [ ] Provider can approve/reject.
- [ ] Admin follow-up appears after provider approval.
- [ ] Paid booking checkout works.
- [ ] Payment sync updates booking state.
- [ ] Cancellation request workflow works.
- [ ] Admin cancellation rules are enforced.

## Production readiness

Before marking a release ready:

    npm run verify:production

Expected:

- [ ] backend typecheck passes.
- [ ] frontend typecheck passes.
- [ ] integration tests pass.
- [ ] frontend build passes.
- [ ] backend build passes.
- [ ] production env validation passes.
- [ ] npm audit has zero moderate-or-higher vulnerabilities.
