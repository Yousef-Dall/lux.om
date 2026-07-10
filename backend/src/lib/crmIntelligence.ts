import type {
  CrmActivityStatus,
  CrmActivityType,
  CrmLeadPriority,
  CrmLeadSource,
  CrmLeadStatus
} from '@prisma/client';

const DAY_MS = 86_400_000;

export type CrmIntelligenceActivity = {
  type: CrmActivityType;
  status: CrmActivityStatus;
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
};

export type CrmLeadIntelligenceInput = {
  source: CrmLeadSource;
  status: CrmLeadStatus;
  priority: CrmLeadPriority;
  createdAt: Date | string;
  updatedAt: Date | string;
  nextFollowUpAt?: Date | string | null;
  expectedValue?: unknown;
  lostReason?: string | null;
  contact: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
  };
  inquiry?: { createdAt: Date | string } | null;
  booking?: {
    status: string;
    payment?: { status: string } | null;
  } | null;
  savedSearchId?: string | null;
  watchlistItemId?: string | null;
  valuationRequestId?: string | null;
  pmsTenantId?: string | null;
  pmsVendorId?: string | null;
  pmsPropertyId?: string | null;
  activities?: CrmIntelligenceActivity[];
  repeatEngagementCount?: number;
};

export type CrmScoreReason = {
  key: string;
  label: string;
  points: number;
};

export type CrmNextBestAction = {
  key:
    | 'COMPLETE_OVERDUE_TASK'
    | 'FOLLOW_UP_NOW'
    | 'COMPLETE_CONTACT_DETAILS'
    | 'MAKE_FIRST_CONTACT'
    | 'QUALIFY_REQUIREMENTS'
    | 'SCHEDULE_VIEWING'
    | 'SEND_DETAILS'
    | 'REQUEST_DOCUMENTS'
    | 'SCHEDULE_NEXT_STEP'
    | 'FOLLOW_UP_AFTER_VIEWING'
    | 'FOLLOW_UP_PROPOSAL'
    | 'CONFIRM_DECISION'
    | 'REVIEW_LOSS_REASON'
    | 'ARCHIVE_OR_REACTIVATE'
    | 'NURTURE_RELATIONSHIP'
    | 'NO_ACTION';
  title: string;
  description: string;
  priority: CrmLeadPriority;
  dueAt: string | null;
  reason: string;
};

export type CrmLeadIntelligence = {
  score: number;
  scoreBand: 'COLD' | 'WARM' | 'HOT';
  scoreReasons: CrmScoreReason[];
  nextBestAction: CrmNextBestAction;
  signals: {
    repeatEngagementCount: number;
    completedCommunications: number;
    openTasks: number;
    overdueTasks: number;
    lastCommunicationAt: string | null;
  };
};

const sourceScores: Record<CrmLeadSource, number> = {
  LISTING_INQUIRY: 18,
  PROJECT_INQUIRY: 20,
  DEVELOPER_PROFILE: 12,
  TRAVEL_AGENCY_PROFILE: 12,
  ACTIVITY_INQUIRY: 14,
  ACTIVITY_BOOKING: 24,
  MAP_DISCOVERY: 8,
  CONTACT_FORM: 8,
  INVESTOR_WATCHLIST: 20,
  VALUATION_REQUEST: 18,
  SAVED_SEARCH: 10,
  PMS_OWNER: 22,
  PMS_TENANT: 16,
  PMS_MAINTENANCE_VENDOR: 12,
  MANUAL: 5,
  ADMIN_CREATED: 6
};

const communicationTypes = new Set<CrmActivityType>(['CALL', 'EMAIL', 'WHATSAPP', 'MEETING']);
const closedStatuses = new Set<CrmLeadStatus>(['WON', 'LOST', 'ARCHIVED']);

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function daysBetween(earlier: Date, later: Date) {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / DAY_MS));
}

function scoreBand(score: number): CrmLeadIntelligence['scoreBand'] {
  if (score >= 70) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}

function makeAction(
  key: CrmNextBestAction['key'],
  title: string,
  description: string,
  priority: CrmLeadPriority,
  reason: string,
  dueAt?: Date | string | null
): CrmNextBestAction {
  return {
    key,
    title,
    description,
    priority,
    reason,
    dueAt: asDate(dueAt)?.toISOString() ?? null
  };
}

function calculateNextBestAction(input: CrmLeadIntelligenceInput, now: Date): CrmNextBestAction {
  const activities = input.activities ?? [];
  const overdueTasks = activities
    .filter((activity) => activity.type === 'TASK' && activity.status === 'OPEN')
    .map((activity) => ({ activity, dueAt: asDate(activity.dueAt) }))
    .filter((item): item is { activity: CrmIntelligenceActivity; dueAt: Date } => Boolean(item.dueAt && item.dueAt < now))
    .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());

  if (overdueTasks[0]) {
    return makeAction(
      'COMPLETE_OVERDUE_TASK',
      'Complete overdue follow-up',
      'Resolve the oldest overdue CRM task before the relationship becomes stale.',
      'URGENT',
      'An open CRM task is past its due date.',
      overdueTasks[0].dueAt
    );
  }

  const nextFollowUp = asDate(input.nextFollowUpAt);
  if (!closedStatuses.has(input.status) && nextFollowUp && nextFollowUp < now) {
    return makeAction(
      'FOLLOW_UP_NOW',
      'Follow up now',
      'The lead-level follow-up date has passed. Contact the lead and schedule the next step.',
      'HIGH',
      'The next follow-up is overdue.',
      nextFollowUp
    );
  }

  if (input.status === 'WON') {
    return makeAction(
      'NURTURE_RELATIONSHIP',
      'Confirm handover and nurture',
      'Record the handover outcome and create a future relationship follow-up if appropriate.',
      'MEDIUM',
      'The opportunity is won.'
    );
  }

  if (input.status === 'LOST') {
    return input.lostReason
      ? makeAction('ARCHIVE_OR_REACTIVATE', 'Archive or schedule re-engagement', 'Keep the loss reason and decide whether this relationship should be revisited later.', 'LOW', 'The opportunity is lost with a recorded reason.')
      : makeAction('REVIEW_LOSS_REASON', 'Record the loss reason', 'Capture why the opportunity was lost before archiving or planning re-engagement.', 'MEDIUM', 'The opportunity is lost without a reason.');
  }

  if (input.status === 'ARCHIVED') {
    return makeAction('NO_ACTION', 'No active action', 'This lead is archived. Reopen it only when a real new signal appears.', 'LOW', 'The opportunity is archived.');
  }

  if (!input.contact.email && !input.contact.phone) {
    return makeAction('COMPLETE_CONTACT_DETAILS', 'Complete contact details', 'Add a valid email address or phone number before scheduling outreach.', 'HIGH', 'No usable contact channel is recorded.');
  }

  const completedCommunications = activities.filter(
    (activity) => communicationTypes.has(activity.type) && activity.status === 'COMPLETED'
  );

  if (input.status === 'NEW' && completedCommunications.length === 0) {
    return makeAction('MAKE_FIRST_CONTACT', 'Make first contact', 'Open a safe email or WhatsApp draft, then log the actual outcome.', 'HIGH', 'This is a new lead with no completed communication.');
  }

  if (input.status === 'NEW' || input.status === 'CONTACTED') {
    return makeAction('QUALIFY_REQUIREMENTS', 'Qualify requirements', 'Confirm intent, timeline, budget, and the decision process before advancing the stage.', 'HIGH', 'The lead has not yet reached the qualified stage.');
  }

  if (input.status === 'QUALIFIED') {
    if (['LISTING_INQUIRY', 'PROJECT_INQUIRY', 'MAP_DISCOVERY', 'INVESTOR_WATCHLIST', 'VALUATION_REQUEST'].includes(input.source)) {
      return makeAction('SCHEDULE_VIEWING', 'Schedule a viewing or consultation', 'Agree a date and create a CRM meeting task with a clear owner.', 'HIGH', 'A qualified property or investment lead is ready for a concrete appointment.');
    }
    if (['PMS_OWNER', 'PMS_TENANT'].includes(input.source)) {
      return makeAction('REQUEST_DOCUMENTS', 'Request required documents', 'Confirm the relationship requirements and log any documents still needed.', 'HIGH', 'A qualified PMS relationship normally needs an onboarding or tenancy document step.');
    }
    if (['ACTIVITY_INQUIRY', 'ACTIVITY_BOOKING', 'TRAVEL_AGENCY_PROFILE'].includes(input.source)) {
      return makeAction('SEND_DETAILS', 'Send service details', 'Share the relevant availability, inclusions, and next booking step using a safe draft.', 'HIGH', 'A qualified activity or travel lead needs the relevant service details.');
    }
    return makeAction('SCHEDULE_NEXT_STEP', 'Schedule the next step', 'Create a dated task for the next concrete commitment.', 'MEDIUM', 'The lead is qualified but has no later-stage commitment yet.');
  }

  if (input.status === 'VIEWING_SCHEDULED') {
    return makeAction('FOLLOW_UP_AFTER_VIEWING', 'Prepare viewing follow-up', 'Confirm attendance and schedule the post-viewing decision follow-up.', 'MEDIUM', 'A viewing is scheduled.');
  }

  if (input.status === 'PROPOSAL_SENT') {
    return makeAction('FOLLOW_UP_PROPOSAL', 'Follow up the proposal', 'Confirm the proposal was reviewed and capture objections or requested changes.', 'HIGH', 'A proposal has been sent but no decision is recorded.');
  }

  if (input.status === 'NEGOTIATION') {
    return makeAction('CONFIRM_DECISION', 'Confirm decision and close next step', 'Record the remaining decision point, owner, and target close date.', 'HIGH', 'The opportunity is in negotiation.');
  }

  return makeAction('SCHEDULE_NEXT_STEP', 'Schedule the next step', 'Create a dated follow-up task so the opportunity does not stall.', 'MEDIUM', 'No more specific deterministic action applies.');
}

export function calculateCrmLeadIntelligence(
  input: CrmLeadIntelligenceInput,
  now = new Date()
): CrmLeadIntelligence {
  if (input.status === 'WON') {
    return {
      score: 100,
      scoreBand: 'HOT',
      scoreReasons: [{ key: 'won', label: 'Opportunity won', points: 100 }],
      nextBestAction: calculateNextBestAction(input, now),
      signals: buildSignals(input, now)
    };
  }

  if (input.status === 'LOST' || input.status === 'ARCHIVED') {
    return {
      score: 0,
      scoreBand: 'COLD',
      scoreReasons: [{ key: 'closed', label: input.status === 'LOST' ? 'Opportunity lost' : 'Opportunity archived', points: 0 }],
      nextBestAction: calculateNextBestAction(input, now),
      signals: buildSignals(input, now)
    };
  }

  const reasons: CrmScoreReason[] = [];
  const add = (key: string, label: string, points: number) => {
    if (points > 0) reasons.push({ key, label, points });
  };

  add('source', 'Source quality', sourceScores[input.source]);

  const signalDate = asDate(input.inquiry?.createdAt) ?? asDate(input.createdAt) ?? now;
  const ageDays = daysBetween(signalDate, now);
  add('recency', 'Recent engagement', ageDays <= 1 ? 18 : ageDays <= 3 ? 14 : ageDays <= 7 ? 10 : ageDays <= 30 ? 5 : 0);

  const contactPoints = input.contact.email && input.contact.phone ? 8 : input.contact.email || input.contact.phone ? 4 : 0;
  add('contact', 'Contact completeness', contactPoints);

  const stagePoints: Partial<Record<CrmLeadStatus, number>> = {
    CONTACTED: 4,
    QUALIFIED: 8,
    VIEWING_SCHEDULED: 10,
    PROPOSAL_SENT: 12,
    NEGOTIATION: 15
  };
  add('stage', 'Pipeline progress', stagePoints[input.status] ?? 0);

  const activities = input.activities ?? [];
  const completedCommunications = activities.filter(
    (activity) => communicationTypes.has(activity.type) && activity.status === 'COMPLETED'
  );
  add('communication', 'Completed communication', Math.min(12, completedCommunications.length * 3));

  const repeatEngagementCount = Math.max(1, input.repeatEngagementCount ?? 1);
  add('repeat', 'Repeat engagement', Math.min(10, Math.max(0, repeatEngagementCount - 1) * 3));

  if (input.booking?.payment?.status === 'PAID') add('paid_booking', 'Paid booking signal', 15);
  else if (input.booking?.status === 'ADMIN_CONFIRMED') add('confirmed_booking', 'Confirmed booking signal', 10);
  else if (input.booking) add('booking', 'Booking signal', 5);

  if (input.watchlistItemId) add('watchlist', 'Investor watchlist interest', 8);
  if (input.savedSearchId) add('saved_search', 'Saved-search interest', 5);
  if (input.valuationRequestId) add('valuation', 'Valuation intent', 7);
  if (input.pmsTenantId || input.pmsVendorId || input.pmsPropertyId) add('pms', 'Active PMS relationship context', 6);

  const expectedValue = asNumber(input.expectedValue);
  if (expectedValue !== null && expectedValue > 0) add('value', 'Expected value recorded', 5);

  add('priority', 'Operator priority', input.priority === 'URGENT' ? 6 : input.priority === 'HIGH' ? 4 : 0);

  const score = Math.max(0, Math.min(100, reasons.reduce((total, reason) => total + reason.points, 0)));
  return {
    score,
    scoreBand: scoreBand(score),
    scoreReasons: reasons,
    nextBestAction: calculateNextBestAction(input, now),
    signals: buildSignals(input, now)
  };
}

function buildSignals(input: CrmLeadIntelligenceInput, now: Date): CrmLeadIntelligence['signals'] {
  const activities = input.activities ?? [];
  const communications = activities.filter((activity) => communicationTypes.has(activity.type));
  const completedCommunications = communications.filter((activity) => activity.status === 'COMPLETED');
  const openTasks = activities.filter((activity) => activity.type === 'TASK' && activity.status === 'OPEN');
  const overdueTasks = openTasks.filter((activity) => {
    const dueAt = asDate(activity.dueAt);
    return Boolean(dueAt && dueAt < now);
  });
  const lastCommunicationAt = communications
    .map((activity) => asDate(activity.completedAt) ?? asDate(activity.createdAt))
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return {
    repeatEngagementCount: Math.max(1, input.repeatEngagementCount ?? 1),
    completedCommunications: completedCommunications.length,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    lastCommunicationAt: lastCommunicationAt?.toISOString() ?? null
  };
}

export type CrmCommunicationTemplate = {
  key: string;
  label: string;
  description: string;
  subject: string;
  body: string;
  emailHref: string | null;
  whatsappHref: string | null;
};

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || 'there';
}

function buildActionLinks(email: string | null | undefined, phone: string | null | undefined, subject: string, body: string) {
  const normalizedPhone = phone?.replace(/\D/g, '') || '';
  return {
    emailHref: email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null,
    whatsappHref: normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(body)}` : null
  };
}

export function buildCrmCommunicationTemplates(input: {
  title: string;
  source: CrmLeadSource;
  sourceLabel?: string | null;
  status: CrmLeadStatus;
  contact: { fullName: string; email?: string | null; phone?: string | null };
}): CrmCommunicationTemplate[] {
  const name = firstName(input.contact.fullName);
  const context = input.sourceLabel || input.title;
  const templates = [
    {
      key: 'INITIAL_CONTACT',
      label: 'Initial contact',
      description: 'Acknowledge the enquiry and agree the next step.',
      subject: `Regarding ${context}`,
      body: `Hello ${name},\n\nThank you for your interest in ${context}. I would be happy to help. Please let me know a convenient time to discuss your requirements and next steps.\n\nRegards,\nlux.om partner team`
    },
    {
      key: 'FOLLOW_UP',
      label: 'Follow-up',
      description: 'Continue a previous conversation without claiming delivery.',
      subject: `Follow-up: ${context}`,
      body: `Hello ${name},\n\nI am following up regarding ${context}. Please let me know whether you would like to continue, arrange a call, or receive any additional information.\n\nRegards,\nlux.om partner team`
    }
  ];

  if (['LISTING_INQUIRY', 'PROJECT_INQUIRY', 'MAP_DISCOVERY', 'INVESTOR_WATCHLIST', 'VALUATION_REQUEST'].includes(input.source)) {
    templates.push({
      key: 'VIEWING_OR_CONSULTATION',
      label: 'Viewing or consultation',
      description: 'Propose a viewing or property consultation.',
      subject: `Viewing or consultation for ${context}`,
      body: `Hello ${name},\n\nI can help arrange a viewing or consultation for ${context}. Please share your preferred date and time, and any key requirements we should prepare for.\n\nRegards,\nlux.om partner team`
    });
  }

  if (['PMS_OWNER', 'PMS_TENANT'].includes(input.source)) {
    templates.push({
      key: 'DOCUMENT_REQUEST',
      label: 'Document request',
      description: 'Request the documents needed for the next PMS step.',
      subject: `Documents required for ${context}`,
      body: `Hello ${name},\n\nTo continue with ${context}, please share the outstanding documents discussed with your property-management contact. Do not send passwords or payment-card details by email or WhatsApp.\n\nRegards,\nlux.om property management`
    });
  }

  if (['ACTIVITY_INQUIRY', 'ACTIVITY_BOOKING', 'TRAVEL_AGENCY_PROFILE'].includes(input.source)) {
    templates.push({
      key: 'SERVICE_DETAILS',
      label: 'Service details',
      description: 'Share availability and the next booking step.',
      subject: `Details for ${context}`,
      body: `Hello ${name},\n\nI am following up with the relevant details for ${context}. Please confirm your preferred date, party size, and any special requirements so we can advise the next booking step.\n\nRegards,\nlux.om partner team`
    });
  }

  if (input.status === 'PROPOSAL_SENT' || input.status === 'NEGOTIATION') {
    templates.push({
      key: 'PROPOSAL_FOLLOW_UP',
      label: 'Proposal follow-up',
      description: 'Ask for feedback or a decision on the proposal.',
      subject: `Proposal follow-up: ${context}`,
      body: `Hello ${name},\n\nI am checking whether you had a chance to review the proposal for ${context}. Please share any questions, requested changes, or the next decision step.\n\nRegards,\nlux.om partner team`
    });
  }

  return templates.map((template) => ({
    ...template,
    ...buildActionLinks(input.contact.email, input.contact.phone, template.subject, template.body)
  }));
}
