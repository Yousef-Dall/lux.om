import { BadgeCheck } from 'lucide-react';

import PolicyPage, { type PolicyPageCopy } from './PolicyPage';

const en: PolicyPageCopy = {
  eyebrow: 'Verification',
  title: 'Verification Policy',
  description:
    'This policy explains how lux.om reviews verification requests, trust badges, provider snapshots, and verification concerns.',
  lastUpdated: 'Last updated: June 2026',
  reviewNote: 'Trust badge policy',
  contactCta: 'Ask about verification',
  contactText: 'Contact lux.om if a verification badge, provider claim, or document request seems incorrect.',
  relatedTitle: 'Related policies',
  relatedLinks: [
    { to: '/trust-safety', label: 'Trust & Safety', description: 'How concerns and reports are reviewed.' },
    { to: '/privacy', label: 'Privacy Policy', description: 'How verification data may be handled.' },
    { to: '/terms', label: 'Terms of Use', description: 'Marketplace user responsibilities.' }
  ],
  sections: [
    {
      title: 'What verification means',
      body:
        'Verification is a marketplace trust signal that certain information was reviewed by lux.om, an admin, or another supported verification source. It is not a guarantee of future performance, legal title, investment return, or transaction outcome.',
      bullets: [
        'Verified status may apply to users, listings, developers, travel agencies, or activities.',
        'Verification may expire or require renewed review.',
        'Verification badges can be removed when information changes or risk is discovered.'
      ]
    },
    {
      title: 'Information reviewed',
      body:
        'Depending on the verification type, lux.om may review company details, contact details, owner/provider relationship, listing information, official references, expiry dates, or other supporting evidence.',
      bullets: [
        'Users should provide accurate and current verification information.',
        'Do not upload unnecessary sensitive data or public identity numbers.',
        'Fake, altered, or misleading documents may lead to account action.'
      ]
    },
    {
      title: 'Review decisions',
      body:
        'Verification requests may be approved, rejected, marked for more information, or escalated. Risky or unclear submissions may require admin notes and additional checks.',
      bullets: [
        'A rejected verification request does not always mean the provider is fraudulent.',
        'An approved verification request does not remove the need for user due diligence.',
        'lux.om may notify users about verification decisions and trust badge changes.'
      ]
    },
    {
      title: 'Reporting verification concerns',
      body:
        'Visitors and users may report suspicious badges, outdated claims, fake documents, impersonation, or provider misrepresentation through public report tools or contact channels.'
    }
  ]
};

const ar: PolicyPageCopy = {
  eyebrow: 'التحقق',
  title: 'سياسة التحقق',
  description:
    'توضح هذه السياسة كيف تراجع lux.om طلبات التحقق وشارات الثقة ولقطات المزودين ومخاوف التحقق.',
  lastUpdated: 'آخر تحديث: يونيو 2026',
  reviewNote: 'سياسة شارات الثقة',
  contactCta: 'السؤال عن التحقق',
  contactText: 'تواصل مع lux.om إذا بدت شارة تحقق أو ادعاء مزود أو طلب مستند غير صحيح.',
  relatedTitle: 'سياسات ذات صلة',
  relatedLinks: [
    { to: '/trust-safety', label: 'الثقة والسلامة', description: 'كيف تتم مراجعة المخاوف والبلاغات.' },
    { to: '/privacy', label: 'سياسة الخصوصية', description: 'كيف يمكن التعامل مع بيانات التحقق.' },
    { to: '/terms', label: 'شروط الاستخدام', description: 'مسؤوليات مستخدمي السوق.' }
  ],
  sections: [
    {
      title: 'ماذا يعني التحقق',
      body:
        'التحقق هو إشارة ثقة في السوق تعني أن معلومات معينة تمت مراجعتها من lux.om أو الأدمن أو مصدر تحقق مدعوم آخر. لا يمثل التحقق ضماناً للأداء المستقبلي أو الملكية القانونية أو عائد الاستثمار أو نتيجة المعاملة.',
      bullets: [
        'قد ينطبق التحقق على المستخدمين أو الإعلانات أو المطورين أو وكالات السفر أو الأنشطة.',
        'قد تنتهي صلاحية التحقق أو يحتاج إلى مراجعة جديدة.',
        'يمكن إزالة شارات التحقق عند تغير المعلومات أو اكتشاف مخاطر.'
      ]
    },
    {
      title: 'المعلومات التي تتم مراجعتها',
      body:
        'حسب نوع التحقق، قد تراجع lux.om بيانات الشركة أو التواصل أو علاقة المالك أو المزود أو بيانات الإعلان أو المراجع الرسمية أو تواريخ الانتهاء أو أدلة داعمة أخرى.',
      bullets: [
        'يجب على المستخدمين تقديم معلومات تحقق دقيقة وحديثة.',
        'لا ترفع بيانات حساسة غير ضرورية أو أرقام هوية عامة.',
        'المستندات المزيفة أو المعدلة أو المضللة قد تؤدي إلى إجراءات على الحساب.'
      ]
    },
    {
      title: 'قرارات المراجعة',
      body:
        'قد تتم الموافقة على طلبات التحقق أو رفضها أو طلب معلومات إضافية أو تصعيدها. الطلبات عالية المخاطر أو غير الواضحة قد تحتاج إلى ملاحظات إدارية وفحوصات إضافية.',
      bullets: [
        'رفض طلب التحقق لا يعني دائماً أن المزود احتيالي.',
        'الموافقة على التحقق لا تلغي حاجة المستخدم إلى التحقق الشخصي.',
        'قد ترسل lux.om إشعارات بخصوص قرارات التحقق وتغييرات شارات الثقة.'
      ]
    },
    {
      title: 'الإبلاغ عن مخاوف التحقق',
      body:
        'يمكن للزوار والمستخدمين الإبلاغ عن الشارات المشبوهة أو الادعاءات القديمة أو المستندات المزيفة أو انتحال الهوية أو تضليل المزود من خلال أدوات البلاغات العامة أو قنوات التواصل.'
    }
  ]
};

export default function VerificationPolicy() {
  return <PolicyPage en={en} ar={ar} icon={BadgeCheck} />;
}
