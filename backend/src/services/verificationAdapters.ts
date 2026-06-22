import {
  VerificationSource,
  VerificationStatus,
  VerificationTargetType
} from '@prisma/client';

export type VerificationAdapterRequest = {
  targetType: VerificationTargetType;
  targetId: string;
  source: VerificationSource;
  submittedDocumentUrls?: string[];
  notes?: string;
};

export type VerificationAdapterResult = {
  status: VerificationStatus;
  source: VerificationSource;
  reference?: string;
  notes: string;
  checkedAt: Date;
  expiresAt?: Date;
};

export type VerificationAdapter = {
  source: VerificationSource;
  label: string;
  isConfigured: () => boolean;
  submit: (request: VerificationAdapterRequest) => Promise<VerificationAdapterResult>;
};

function createNotConfiguredResult(
  request: VerificationAdapterRequest,
  notes: string
): VerificationAdapterResult {
  return {
    status: 'SUBMITTED',
    source: request.source,
    notes,
    checkedAt: new Date()
  };
}

class LuxOmAdminReviewAdapter implements VerificationAdapter {
  source: VerificationSource = 'LUX_OM_ADMIN_REVIEW';
  label = 'lux.om admin review';

  isConfigured() {
    return true;
  }

  async submit(request: VerificationAdapterRequest): Promise<VerificationAdapterResult> {
    return {
      status: 'SUBMITTED',
      source: this.source,
      notes:
        request.notes ||
        'Submitted for lux.om admin review. This is not an official government verification.',
      checkedAt: new Date()
    };
  }
}

class OwnerDocumentSubmissionAdapter implements VerificationAdapter {
  source: VerificationSource = 'OWNER_DOCUMENT_SUBMISSION';
  label = 'owner document submission';

  isConfigured() {
    return true;
  }

  async submit(request: VerificationAdapterRequest): Promise<VerificationAdapterResult> {
    return {
      status: 'SUBMITTED',
      source: this.source,
      notes:
        request.submittedDocumentUrls?.length
          ? 'Documents submitted for manual review. Verification is subject to admin checks.'
          : 'Document submission created. Required documents still need to be uploaded.',
      checkedAt: new Date()
    };
  }
}

class FutureMolupApiAdapter implements VerificationAdapter {
  source: VerificationSource = 'FUTURE_MOLUP_API';
  label = 'future MOLUP API';

  isConfigured() {
    return Boolean(process.env.MOLUP_API_BASE_URL && process.env.MOLUP_API_KEY);
  }

  async submit(request: VerificationAdapterRequest): Promise<VerificationAdapterResult> {
    if (!this.isConfigured()) {
      return createNotConfiguredResult(
        request,
        'Future MOLUP API integration is not configured. Manual admin verification is required.'
      );
    }

    return {
      status: 'SUBMITTED',
      source: this.source,
      notes:
        'Prepared for future MOLUP API verification. Live official verification requires approved API access before use.',
      checkedAt: new Date()
    };
  }
}

class FutureMunicipalityRegistrationAdapter implements VerificationAdapter {
  source: VerificationSource = 'FUTURE_MUNICIPALITY_REGISTRATION';
  label = 'future municipality registration';

  isConfigured() {
    return Boolean(
      process.env.MUNICIPALITY_API_BASE_URL &&
        process.env.MUNICIPALITY_API_KEY
    );
  }

  async submit(request: VerificationAdapterRequest): Promise<VerificationAdapterResult> {
    if (!this.isConfigured()) {
      return createNotConfiguredResult(
        request,
        'Future municipality registration integration is not configured. Drafts can be prepared for external submission only.'
      );
    }

    return {
      status: 'SUBMITTED',
      source: this.source,
      notes:
        'Prepared for future municipality registration integration. Live official registration requires approved access before use.',
      checkedAt: new Date()
    };
  }
}

class FutureThirdPartyProviderAdapter implements VerificationAdapter {
  source: VerificationSource = 'FUTURE_THIRD_PARTY_PROVIDER';
  label = 'future third-party verification provider';

  isConfigured() {
    return Boolean(
      process.env.VERIFICATION_PROVIDER_NAME &&
        process.env.VERIFICATION_PROVIDER_API_KEY
    );
  }

  async submit(request: VerificationAdapterRequest): Promise<VerificationAdapterResult> {
    if (!this.isConfigured()) {
      return createNotConfiguredResult(
        request,
        'Third-party verification provider is not configured. Manual admin verification is required.'
      );
    }

    return {
      status: 'SUBMITTED',
      source: this.source,
      notes:
        'Prepared for third-party verification provider review. Live external checks require provider implementation before use.',
      checkedAt: new Date()
    };
  }
}

export const verificationAdapters: Record<VerificationSource, VerificationAdapter> = {
  LUX_OM_ADMIN_REVIEW: new LuxOmAdminReviewAdapter(),
  OWNER_DOCUMENT_SUBMISSION: new OwnerDocumentSubmissionAdapter(),
  FUTURE_MOLUP_API: new FutureMolupApiAdapter(),
  FUTURE_MUNICIPALITY_REGISTRATION: new FutureMunicipalityRegistrationAdapter(),
  FUTURE_THIRD_PARTY_PROVIDER: new FutureThirdPartyProviderAdapter()
};

export function getVerificationAdapter(source: VerificationSource) {
  return verificationAdapters[source];
}

export async function submitVerificationRequest(
  request: VerificationAdapterRequest
) {
  const adapter = getVerificationAdapter(request.source);

  return adapter.submit(request);
}

export function getVerificationStatusLabel(status: VerificationStatus) {
  switch (status) {
    case 'SUBMITTED':
      return 'Submitted for review';
    case 'ADMIN_VERIFIED':
      return 'Verified by lux.om admin review';
    case 'EXTERNALLY_VERIFIED':
      return 'Externally verified';
    case 'REJECTED':
      return 'Verification rejected';
    case 'EXPIRED':
      return 'Verification expired';
    default:
      return 'Unverified';
  }
}

export function getVerificationSourceLabel(source?: VerificationSource | null) {
  switch (source) {
    case 'LUX_OM_ADMIN_REVIEW':
      return 'lux.om admin review';
    case 'OWNER_DOCUMENT_SUBMISSION':
      return 'Owner document submission';
    case 'FUTURE_MOLUP_API':
      return 'Future MOLUP API';
    case 'FUTURE_MUNICIPALITY_REGISTRATION':
      return 'Future municipality registration';
    case 'FUTURE_THIRD_PARTY_PROVIDER':
      return 'Future third-party provider';
    default:
      return 'Not specified';
  }
}

export function getSafeVerificationNote(
  status?: VerificationStatus | null,
  source?: VerificationSource | null
) {
  if (status === 'EXTERNALLY_VERIFIED') {
    return 'External verification has been recorded. Review source and expiry details before relying on it.';
  }

  if (status === 'ADMIN_VERIFIED') {
    return 'Verified through lux.om admin review based on submitted information.';
  }

  if (
    source === 'FUTURE_MOLUP_API' ||
    source === 'FUTURE_MUNICIPALITY_REGISTRATION'
  ) {
    return 'Official integration is prepared architecturally but is not live unless approved access is configured.';
  }

  if (status === 'SUBMITTED') {
    return 'Submitted for verification review.';
  }

  return 'Verification should be confirmed before transaction decisions.';
}

export function isVerifiedStatus(status?: VerificationStatus | null) {
  return status === 'ADMIN_VERIFIED' || status === 'EXTERNALLY_VERIFIED';
}

export function isVerificationExpired(expiryDate?: Date | string | null) {
  if (!expiryDate) return false;

  const expiry = new Date(expiryDate);

  if (Number.isNaN(expiry.getTime())) return false;

  return expiry.getTime() < Date.now();
}

export function resolveCurrentVerificationStatus(
  status: VerificationStatus,
  expiryDate?: Date | string | null
): VerificationStatus {
  if (isVerifiedStatus(status) && isVerificationExpired(expiryDate)) {
    return 'EXPIRED';
  }

  return status;
}