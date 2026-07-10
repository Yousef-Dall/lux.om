import { describe, expect, it } from 'vitest';

import { buildCrmCommunicationTemplates, calculateCrmLeadIntelligence } from '../src/lib/crmIntelligence';

const now = new Date('2026-07-10T12:00:00.000Z');

function baseLead() {
  return {
    source: 'LISTING_INQUIRY' as const,
    status: 'NEW' as const,
    priority: 'MEDIUM' as const,
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
    contact: { fullName: 'Aisha Al Balushi', email: 'aisha@example.com', phone: '+968 9000 0000' },
    activities: []
  };
}

describe('CRM pipeline intelligence', () => {
  it('scores recent high-intent engagement from real lead signals', () => {
    const result = calculateCrmLeadIntelligence({
      ...baseLead(),
      status: 'QUALIFIED',
      priority: 'HIGH',
      expectedValue: '125000',
      watchlistItemId: 'watch-1',
      repeatEngagementCount: 3,
      activities: [
        { type: 'CALL', status: 'COMPLETED', createdAt: '2026-07-10T09:00:00.000Z' },
        { type: 'EMAIL', status: 'COMPLETED', createdAt: '2026-07-10T10:00:00.000Z' }
      ]
    }, now);

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.scoreBand).toBe('HOT');
    expect(result.scoreReasons.map((reason) => reason.key)).toEqual(expect.arrayContaining(['source', 'recency', 'repeat', 'communication']));
    expect(result.nextBestAction.key).toBe('SCHEDULE_VIEWING');
  });

  it('prioritizes overdue tasks above pipeline-stage suggestions', () => {
    const result = calculateCrmLeadIntelligence({
      ...baseLead(),
      status: 'PROPOSAL_SENT',
      activities: [
        { type: 'TASK', status: 'OPEN', dueAt: '2026-07-09T08:00:00.000Z', createdAt: '2026-07-08T08:00:00.000Z' }
      ]
    }, now);

    expect(result.signals.overdueTasks).toBe(1);
    expect(result.nextBestAction).toMatchObject({ key: 'COMPLETE_OVERDUE_TASK', priority: 'URGENT' });
  });

  it('does not invent active opportunity scores for closed leads', () => {
    const lost = calculateCrmLeadIntelligence({ ...baseLead(), status: 'LOST' }, now);
    const won = calculateCrmLeadIntelligence({ ...baseLead(), status: 'WON' }, now);

    expect(lost.score).toBe(0);
    expect(won.score).toBe(100);
  });

  it('builds safe email and WhatsApp drafts without claiming delivery', () => {
    const templates = buildCrmCommunicationTemplates({
      title: 'Madinat Al Irfan apartment',
      source: 'LISTING_INQUIRY',
      sourceLabel: 'Madinat Al Irfan apartment',
      status: 'QUALIFIED',
      contact: baseLead().contact
    });

    expect(templates.map((template) => template.key)).toContain('VIEWING_OR_CONSULTATION');
    expect(templates[0].emailHref).toMatch(/^mailto:/);
    expect(templates[0].whatsappHref).toMatch(/^https:\/\/wa\.me\/96890000000/);
    expect(templates[0].body).not.toMatch(/sent|delivered/i);
  });
});
