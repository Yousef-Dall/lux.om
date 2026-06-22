import { describe, expect, it } from 'vitest';

import { createWhatsAppTemplate } from '../src/services/whatsappTemplates';

describe('Stage 8 rental contract messaging', () => {
  it('creates safe contract draft WhatsApp copy without claiming official registration', () => {
    const template = createWhatsAppTemplate('RENTAL_CONTRACT_DISCUSSION', {
      contractTitle: 'Al Mouj lease draft',
      customNote: 'Please confirm tenant name and rent amount.'
    });

    expect(template.message).toContain('Al Mouj lease draft');
    expect(template.message).toContain('not an automatically registered official contract');
    expect(template.message).toContain('Please confirm tenant name and rent amount.');
  });
});
