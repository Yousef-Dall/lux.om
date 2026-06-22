import { describe, expect, it } from 'vitest';

import {
  getSafeVerificationNote,
  getVerificationSourceLabel,
  isVerifiedStatus,
  resolveCurrentVerificationStatus
} from '../src/services/verificationAdapters';

describe('Stage 8 verification and trust safety copy', () => {
  it('labels future official integrations without pretending they are live', () => {
    expect(getVerificationSourceLabel('FUTURE_MOLUP_API')).toBe('Future MOLUP API');
    expect(getSafeVerificationNote('SUBMITTED', 'FUTURE_MOLUP_API')).toContain(
      'Official integration is prepared architecturally'
    );
  });

  it('expires previously verified records when their expiry date has passed', () => {
    expect(isVerifiedStatus('ADMIN_VERIFIED')).toBe(true);
    expect(resolveCurrentVerificationStatus('ADMIN_VERIFIED', new Date('2020-01-01'))).toBe('EXPIRED');
  });
});
