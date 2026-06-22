import { describe, expect, it } from 'vitest';

import {
  createWhatsAppAction,
  createWhatsAppTemplate,
  normalizeWhatsAppPhoneNumber
} from '../src/services/whatsappTemplates';

describe('Stage 8 WhatsApp transaction actions', () => {
  it('normalizes Oman local phone numbers for WhatsApp links', () => {
    expect(normalizeWhatsAppPhoneNumber('9123 4567')).toBe('96891234567');
    expect(normalizeWhatsAppPhoneNumber('+968 9123 4567')).toBe('96891234567');
  });

  it('creates safe payment-link copy with fraud-prevention wording', () => {
    const template = createWhatsAppTemplate('SEND_PAYMENT_LINK', {
      activityTitle: 'Dolphin trip',
      paymentLink: 'https://checkout.example/pay/test'
    });

    expect(template.message).toContain('Dolphin trip');
    expect(template.message).toContain('approved payment provider');
  });

  it('returns a clickable WhatsApp action when a valid phone is present', () => {
    const action = createWhatsAppAction('91234567', 'BUYER_INQUIRY', {
      listingTitle: 'Muscat apartment'
    });

    expect(action.canSend).toBe(true);
    expect(action.url).toContain('https://wa.me/96891234567');
  });
});
