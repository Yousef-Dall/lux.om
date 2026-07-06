import type { ReactElement } from 'react';

import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  XCircle
} from 'lucide-react';

import { useLanguage } from '../i18n/LanguageContext';

type TrustBadgeTone = 'verified' | 'official' | 'pending' | 'warning' | 'neutral';

type TrustBadgeItem = {
  key: string;
  label: string;
  detail?: string;
  tone: TrustBadgeTone;
  icon: ReactElement;
};

type TrustBadgesProps = {
  verificationStatus?: string | null;
  verificationSource?: string | null;
  verificationDate?: string | null;
  verificationExpiryDate?: string | null;
  mediaQualityStatus?: string | null;
  buyerEligibility?: readonly string[];
  variant?: 'compact' | 'full';
  className?: string;
};

function humanize(value: string) {
  return value
    .replace(/^FUTURE_/, 'Future ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium'
  }).format(parsed);
}

function getVerificationBadge(
  status: string | null | undefined,
  source: string | null | undefined,
  verificationDate: string | null | undefined,
  expiryDate: string | null | undefined,
  language: 'en' | 'ar'
): TrustBadgeItem | null {
  if (!status || status === 'UNVERIFIED') return null;

  const verifiedOn = formatDate(verificationDate, language);
  const expiresOn = formatDate(expiryDate, language);
  const sourceLabel = source ? humanize(source) : '';

  if (status === 'EXTERNALLY_VERIFIED') {
    return {
      key: 'verification-official',
      tone: 'official',
      icon: <BadgeCheck size={14} aria-hidden="true" />,
      label: language === 'ar' ? 'موثق من مصدر رسمي' : 'Officially verified',
      detail:
        language === 'ar'
          ? [sourceLabel, verifiedOn ? `تم التحقق: ${verifiedOn}` : '', expiresOn ? `ينتهي: ${expiresOn}` : '']
              .filter(Boolean)
              .join(' · ')
          : [sourceLabel, verifiedOn ? `Checked ${verifiedOn}` : '', expiresOn ? `Expires ${expiresOn}` : '']
              .filter(Boolean)
              .join(' · ')
    };
  }

  if (status === 'ADMIN_VERIFIED') {
    return {
      key: 'verification-admin',
      tone: 'verified',
      icon: <ShieldCheck size={14} aria-hidden="true" />,
      label: language === 'ar' ? 'تم التحقق بواسطة lux.om' : 'Verified by lux.om',
      detail:
        language === 'ar'
          ? [sourceLabel, verifiedOn ? `تم التحقق: ${verifiedOn}` : '', expiresOn ? `ينتهي: ${expiresOn}` : '']
              .filter(Boolean)
              .join(' · ')
          : [sourceLabel, verifiedOn ? `Checked ${verifiedOn}` : '', expiresOn ? `Expires ${expiresOn}` : '']
              .filter(Boolean)
              .join(' · ')
    };
  }

  if (status === 'SUBMITTED') {
    return {
      key: 'verification-submitted',
      tone: 'pending',
      icon: <Clock3 size={14} aria-hidden="true" />,
      label: language === 'ar' ? 'قيد مراجعة التحقق' : 'Verification under review',
      detail:
        language === 'ar'
          ? 'لم يتم اعتماده كموثق بعد.'
          : 'Not approved as verified yet.'
    };
  }

  if (status === 'REJECTED') {
    return {
      key: 'verification-rejected',
      tone: 'warning',
      icon: <XCircle size={14} aria-hidden="true" />,
      label: language === 'ar' ? 'لم يجتز التحقق' : 'Verification not approved',
      detail:
        language === 'ar'
          ? 'راجع التفاصيل قبل الحجز أو التواصل.'
          : 'Review details before booking or contacting.'
    };
  }

  if (status === 'EXPIRED') {
    return {
      key: 'verification-expired',
      tone: 'warning',
      icon: <ShieldAlert size={14} aria-hidden="true" />,
      label: language === 'ar' ? 'انتهى التحقق' : 'Verification expired',
      detail:
        language === 'ar'
          ? 'يحتاج إلى مراجعة حديثة.'
          : 'Needs a fresh review.'
    };
  }

  return {
    key: 'verification-other',
    tone: 'neutral',
    icon: <FileCheck2 size={14} aria-hidden="true" />,
    label: humanize(status),
    detail: sourceLabel
  };
}

function getMediaBadge(status: string | null | undefined, language: 'en' | 'ar') {
  if (!status) return null;

  if (['APPROVED', 'HIGH_QUALITY', 'ACCEPTABLE', 'EXCELLENT'].includes(status)) {
    return {
      key: 'media-quality',
      tone: 'neutral' as const,
      icon: <CheckCircle2 size={14} aria-hidden="true" />,
      label:
        status === 'EXCELLENT'
          ? language === 'ar'
            ? 'وسائط ممتازة'
            : 'Excellent media'
          : language === 'ar'
            ? 'وسائط مراجعة'
            : 'Reviewed media',
      detail: humanize(status)
    };
  }

  if (['NEEDS_REVIEW', 'REJECTED', 'BLOCKED'].includes(status)) {
    return {
      key: 'media-quality-warning',
      tone: 'warning' as const,
      icon: <ShieldAlert size={14} aria-hidden="true" />,
      label: language === 'ar' ? 'الوسائط تحتاج مراجعة' : 'Media needs review',
      detail: humanize(status)
    };
  }

  return null;
}

function getBuyerEligibilityBadges(
  buyerEligibility: readonly string[],
  language: 'en' | 'ar'
) {
  return buyerEligibility.slice(0, 2).map<TrustBadgeItem>((eligibility) => ({
    key: `eligibility-${eligibility}`,
    tone: 'neutral',
    icon: <FileCheck2 size={14} aria-hidden="true" />,
    label:
      language === 'ar'
        ? `أهلية شراء: ${humanize(eligibility)}`
        : `Buyer eligibility: ${humanize(eligibility)}`
  }));
}

export default function TrustBadges({
  verificationStatus,
  verificationSource,
  verificationDate,
  verificationExpiryDate,
  mediaQualityStatus,
  buyerEligibility = [],
  variant = 'compact',
  className = ''
}: TrustBadgesProps) {
  const { language } = useLanguage();

  const badges = [
    getVerificationBadge(
      verificationStatus,
      verificationSource,
      verificationDate,
      verificationExpiryDate,
      language
    ),
    getMediaBadge(mediaQualityStatus, language),
    ...getBuyerEligibilityBadges(buyerEligibility, language)
  ].filter(Boolean) as TrustBadgeItem[];

  if (!badges.length) return null;

  return (
    <div
      className={`trust-badges trust-badges--${variant} ${className}`.trim()}
      aria-label={language === 'ar' ? 'علامات الثقة والتحقق' : 'Trust and verification badges'}
    >
      {badges.map((badge) => (
        <span
          className={`trust-badge trust-badge--${badge.tone}`}
          key={badge.key}
          title={badge.detail || badge.label}
        >
          {badge.icon}
          <span>{badge.label}</span>
          {variant === 'full' && badge.detail ? <small>{badge.detail}</small> : null}
        </span>
      ))}
    </div>
  );
}
