import type { ReactElement } from 'react';

import {
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  FileCheck2,
  Globe2,
  ShieldCheck,
  Sparkles,
  Users2
} from 'lucide-react';

import { useLanguage } from '../i18n/LanguageContext';

import TrustBadges from './TrustBadges';

type PartnerType = 'developer' | 'travelAgency';
type CredibilityTone = 'ready' | 'accent' | 'neutral' | 'review';

type PartnerCredibilityPanelProps = {
  providerType: PartnerType;
  name: string;
  verified?: boolean;
  featured?: boolean;
  verificationStatus?: string | null;
  verificationSource?: string | null;
  verificationDate?: string | null;
  verificationExpiryDate?: string | null;
  establishedYear?: number;
  publicItemCount?: number;
  publicItemLabel: string;
  specialties?: readonly string[];
  contactChannels?: {
    phone?: boolean;
    email?: boolean;
    website?: boolean;
    whatsapp?: boolean;
  };
  className?: string;
};

type CredibilityItem = {
  key: string;
  label: string;
  detail: string;
  tone: CredibilityTone;
  icon: ReactElement;
};

function getContactCount(contactChannels: PartnerCredibilityPanelProps['contactChannels']) {
  if (!contactChannels) return 0;

  return [
    contactChannels.phone,
    contactChannels.email,
    contactChannels.website,
    contactChannels.whatsapp
  ].filter(Boolean).length;
}

export default function PartnerCredibilityPanel({
  providerType,
  name,
  verified = false,
  featured = false,
  verificationStatus,
  verificationSource,
  verificationDate,
  verificationExpiryDate,
  establishedYear,
  publicItemCount = 0,
  publicItemLabel,
  specialties = [],
  contactChannels,
  className = ''
}: PartnerCredibilityPanelProps) {
  const { language } = useLanguage();
  const contactCount = getContactCount(contactChannels);
  const isArabic = language === 'ar';
  const partnerLabel =
    providerType === 'developer'
      ? isArabic
        ? 'المطور'
        : 'developer'
      : isArabic
        ? 'الوكالة'
        : 'agency';

  const verificationItem: CredibilityItem = verified
    ? {
        key: 'verified',
        tone: 'ready',
        icon: <ShieldCheck size={17} aria-hidden="true" />,
        label: isArabic ? 'تحقق واضح' : 'Verified profile',
        detail: isArabic
          ? 'تمت مراجعة حالة التحقق داخل منصة lux.om.'
          : 'Verification status is visible and reviewed on lux.om.'
      }
    : {
        key: 'review',
        tone: 'review',
        icon: <FileCheck2 size={17} aria-hidden="true" />,
        label: isArabic ? 'قابل للمراجعة' : 'Reviewable profile',
        detail: isArabic
          ? 'راجعي شارات التحقق والتفاصيل قبل اتخاذ قرار.'
          : 'Review badges and details before making a decision.'
      };

  const items: CredibilityItem[] = [
    verificationItem,
    ...(featured
      ? [
          {
            key: 'featured',
            tone: 'accent' as const,
            icon: <Sparkles size={17} aria-hidden="true" />,
            label: isArabic ? 'شريك مميز' : 'Featured partner',
            detail: isArabic
              ? 'يحصل على ظهور أعلى ضمن شبكة شركاء lux.om.'
              : 'Highlighted across the lux.om partner network.'
          }
        ]
      : []),
    ...(establishedYear
      ? [
          {
            key: 'established',
            tone: 'neutral' as const,
            icon: <CalendarCheck2 size={17} aria-hidden="true" />,
            label: isArabic ? 'سجل تشغيلي' : 'Operating history',
            detail: isArabic
              ? `تأسس عام ${establishedYear}.`
              : `Established in ${establishedYear}.`
          }
        ]
      : []),
    {
      key: 'public-items',
      tone: publicItemCount > 0 ? 'ready' : 'neutral',
      icon: <Users2 size={17} aria-hidden="true" />,
      label: publicItemLabel,
      detail: isArabic
        ? `${publicItemCount} عناصر منشورة مرتبطة بهذا الملف.`
        : `${publicItemCount} public items connected to this profile.`
    },
    {
      key: 'contact',
      tone: contactCount >= 2 ? 'ready' : 'neutral',
      icon: <Globe2 size={17} aria-hidden="true" />,
      label: isArabic ? 'قنوات تواصل' : 'Contact channels',
      detail: isArabic
        ? `${contactCount} قنوات تواصل متاحة.`
        : `${contactCount} contact channels available.`
    },
    ...(specialties.length > 0
      ? [
          {
            key: 'specialties',
            tone: 'neutral' as const,
            icon: <CheckCircle2 size={17} aria-hidden="true" />,
            label: isArabic ? 'تخصص واضح' : 'Clear specialization',
            detail: specialties.slice(0, 3).join(' · ')
          }
        ]
      : [])
  ];

  return (
    <section
      className={`partner-credibility-panel ${className}`.trim()}
      aria-label={isArabic ? `مؤشرات الثقة لـ ${name}` : `Trust signals for ${name}`}
    >
      <div className="partner-credibility-panel__header">
        <span className="partner-credibility-panel__icon">
          <BadgeCheck size={22} aria-hidden="true" />
        </span>

        <div>
          <p className="eyebrow">
            {isArabic ? 'ملخص الثقة' : 'Credibility summary'}
          </p>
          <h3>
            {isArabic
              ? `ما الذي يجعل ${partnerLabel} أوضح للمتعاملين؟`
              : `Why this ${partnerLabel} is easier to evaluate`}
          </h3>
          <p>
            {isArabic
              ? 'تجمع هذه البطاقة إشارات التحقق، النشاط العام، وقنوات التواصل حتى لا يضطر المستخدم للبحث عنها في الصفحة.'
              : 'This card groups verification, public activity, and contact signals so users can evaluate the partner quickly.'}
          </p>
        </div>
      </div>

      <TrustBadges
        verificationStatus={verificationStatus}
        verificationSource={verificationSource}
        verificationDate={verificationDate}
        verificationExpiryDate={verificationExpiryDate}
        variant="full"
        className="partner-credibility-panel__badges"
      />

      <div className="partner-credibility-panel__grid">
        {items.map((item) => (
          <article className={`partner-credibility-item partner-credibility-item--${item.tone}`} key={item.key}>
            <span>{item.icon}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
