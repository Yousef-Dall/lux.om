import { EnhancementStatus } from '@prisma/client';

export type ImageEnhancementTarget = {
  entityType: 'listing' | 'activity';
  entityId: string;
  sourceImageUrl: string;
};

export type ImageEnhancementResult = {
  status: EnhancementStatus;
  enhancedImageUrl?: string;
  provider?: string;
  notes: string;
};

export type ImageEnhancementAdapter = {
  provider: string;
  isConfigured: () => boolean;
  requestEnhancement: (
    target: ImageEnhancementTarget
  ) => Promise<ImageEnhancementResult>;
};

class NotConfiguredImageEnhancementAdapter implements ImageEnhancementAdapter {
  provider = process.env.IMAGE_ENHANCEMENT_PROVIDER || 'not_configured';

  isConfigured() {
    return false;
  }

  async requestEnhancement(): Promise<ImageEnhancementResult> {
    return {
      status: 'NOT_CONFIGURED',
      provider: this.provider,
      notes: 'Enhancement service is not configured.'
    };
  }
}

class IntegrationReadyImageEnhancementAdapter implements ImageEnhancementAdapter {
  provider: string;

  constructor(provider: string) {
    this.provider = provider;
  }

  isConfigured() {
    return Boolean(
      process.env.IMAGE_ENHANCEMENT_PROVIDER &&
        process.env.IMAGE_ENHANCEMENT_API_KEY
    );
  }

  async requestEnhancement(
    target: ImageEnhancementTarget
  ): Promise<ImageEnhancementResult> {
    if (!this.isConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        provider: this.provider,
        notes: 'Enhancement service is not configured.'
      };
    }

    return {
      status: 'QUEUED',
      provider: this.provider,
      notes: `Image enhancement request prepared for ${target.entityType}. External provider execution is adapter-ready and requires provider implementation before live use.`
    };
  }
}

export function getImageEnhancementAdapter(): ImageEnhancementAdapter {
  const provider = process.env.IMAGE_ENHANCEMENT_PROVIDER?.trim();

  if (!provider) {
    return new NotConfiguredImageEnhancementAdapter();
  }

  return new IntegrationReadyImageEnhancementAdapter(provider);
}

export async function requestImageEnhancement(
  target: ImageEnhancementTarget
): Promise<ImageEnhancementResult> {
  const adapter = getImageEnhancementAdapter();

  return adapter.requestEnhancement(target);
}

export function getInitialEnhancementStatus(): EnhancementStatus {
  return getImageEnhancementAdapter().isConfigured()
    ? 'NOT_REQUESTED'
    : 'NOT_CONFIGURED';
}