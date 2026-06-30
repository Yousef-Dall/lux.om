import { AlertTriangle } from 'lucide-react';

import PolicyPage, { type PolicyPageCopy } from './PolicyPage';

const en: PolicyPageCopy = {
  eyebrow: 'Trust & safety',
  title: 'Trust & Safety Policy',
  description:
    'This policy explains how lux.om reviews marketplace risk, reports, verification concerns, unsafe content, and account abuse.',
  lastUpdated: 'Last updated: June 2026',
  reviewNote: 'Marketplace protection policy',
  contactCta: 'Report a concern',
  contactText: 'Use contact or in-page report tools when you see suspicious, unsafe, misleading, or abusive marketplace activity.',
  relatedTitle: 'Related policies',
  relatedLinks: [
    { to: '/verification-policy', label: 'Verification Policy', description: 'How badges and verification reviews work.' },
    { to: '/terms', label: 'Terms of Use', description: 'Marketplace user responsibilities.' },
    { to: '/privacy', label: 'Privacy Policy', description: 'How report and review data is handled.' }
  ],
  sections: [
    {
      title: 'Manual review and moderation',
      body:
        'lux.om may manually review listings, activities, profiles, reviews, verification requests, and trust reports. Review actions may include approval, rejection, hiding, suspension, escalation, or removal.',
      bullets: [
        'The team may ask for more context before making a final decision.',
        'Urgent risks may be acted on before all details are reviewed.',
        'Moderation decisions are based on marketplace safety, accuracy, and user trust.'
      ]
    },
    {
      title: 'Reporting concerns',
      body:
        'Users and visitors can report suspicious providers, misleading claims, fake verification, unsafe services, abusive content, or marketplace misuse.',
      bullets: [
        'Reports should include clear, truthful, and relevant details.',
        'Do not include full payment card numbers or unnecessary identity document numbers in report messages.',
        'False, abusive, or retaliatory reports may lead to account action.'
      ]
    },
    {
      title: 'Prohibited marketplace behavior',
      body:
        'lux.om does not allow fraud, impersonation, fake documents, fake reviews, abusive communication, unsafe services, misleading pricing, duplicate spam content, or attempts to bypass platform protections.',
      bullets: [
        'Providers must not misrepresent ownership, agency authority, availability, or package inclusions.',
        'Users must not pressure others to move payments or sensitive communication into unsafe channels.',
        'Accounts may be suspended when conduct creates trust, payment, safety, or legal risk.'
      ]
    },
    {
      title: 'Safety guidance',
      body:
        'Users should verify key details before visiting a property, paying for a booking, sharing documents, or entering a contract. lux.om marketplace tools are designed to reduce risk, not replace personal due diligence.',
      bullets: [
        'Use official payment and booking workflows when available.',
        'Meet in safe locations and verify provider identity when needed.',
        'Use qualified legal, property, travel, or financial professionals for high-value decisions.'
      ]
    }
  ]
};

const ar: PolicyPageCopy = {
  eyebrow: 'الثقة والسلامة',
  title: 'سياسة الثقة والسلامة',
  description:
    'توضح هذه السياسة كيف تراجع lux.om مخاطر السوق والبلاغات ومخاوف التحقق والمحتوى غير الآمن وإساءة استخدام الحسابات.',
  lastUpdated: 'آخر تحديث: يونيو 2026',
  reviewNote: 'سياسة حماية السوق',
  contactCta: 'الإبلاغ عن مشكلة',
  contactText: 'استخدم صفحة التواصل أو أدوات الإبلاغ داخل الصفحات عند وجود نشاط مشبوه أو غير آمن أو مضلل أو مسيء.',
  relatedTitle: 'سياسات ذات صلة',
  relatedLinks: [
    { to: '/verification-policy', label: 'سياسة التحقق', description: 'كيف تعمل الشارات ومراجعات التحقق.' },
    { to: '/terms', label: 'شروط الاستخدام', description: 'مسؤوليات مستخدمي السوق.' },
    { to: '/privacy', label: 'سياسة الخصوصية', description: 'كيف يتم التعامل مع بيانات البلاغات والمراجعات.' }
  ],
  sections: [
    {
      title: 'المراجعة اليدوية والإشراف',
      body:
        'قد تراجع lux.om يدوياً الإعلانات والأنشطة والملفات الشخصية والمراجعات وطلبات التحقق وبلاغات الثقة. قد تشمل الإجراءات الموافقة أو الرفض أو الإخفاء أو التعليق أو التصعيد أو الإزالة.',
      bullets: [
        'قد يطلب الفريق سياقاً إضافياً قبل اتخاذ القرار النهائي.',
        'قد يتم التعامل مع المخاطر العاجلة قبل اكتمال جميع التفاصيل.',
        'تعتمد قرارات الإشراف على السلامة والدقة وثقة المستخدمين.'
      ]
    },
    {
      title: 'الإبلاغ عن المخاوف',
      body:
        'يمكن للمستخدمين والزوار الإبلاغ عن المزودين المشبوهين أو الادعاءات المضللة أو التحقق الوهمي أو الخدمات غير الآمنة أو المحتوى المسيء أو إساءة استخدام السوق.',
      bullets: [
        'يجب أن تتضمن البلاغات تفاصيل واضحة وصحيحة وذات صلة.',
        'لا تدرج أرقام بطاقات الدفع الكاملة أو أرقام مستندات الهوية غير الضرورية في البلاغ.',
        'البلاغات الكاذبة أو المسيئة أو الانتقامية قد تؤدي إلى إجراءات على الحساب.'
      ]
    },
    {
      title: 'السلوك المحظور',
      body:
        'لا تسمح lux.om بالاحتيال أو انتحال الهوية أو المستندات المزيفة أو المراجعات الوهمية أو التواصل المسيء أو الخدمات غير الآمنة أو الأسعار المضللة أو المحتوى المكرر المزعج أو محاولة تجاوز حماية المنصة.',
      bullets: [
        'لا يجوز للمزودين تضليل المستخدمين بخصوص الملكية أو الصلاحية أو التوفر أو ما تشمل الباقات.',
        'لا يجوز الضغط على الآخرين لنقل الدفع أو التواصل الحساس إلى قنوات غير آمنة.',
        'قد يتم تعليق الحسابات عند وجود مخاطر ثقة أو دفع أو سلامة أو مخاطر قانونية.'
      ]
    },
    {
      title: 'إرشادات السلامة',
      body:
        'يجب على المستخدمين التحقق من التفاصيل الأساسية قبل زيارة عقار أو دفع حجز أو مشاركة مستندات أو الدخول في عقد. أدوات lux.om تقلل المخاطر لكنها لا تغني عن التحقق الشخصي.',
      bullets: [
        'استخدم مسارات الدفع والحجز الرسمية عندما تكون متاحة.',
        'اجتمع في أماكن آمنة وتحقق من هوية المزود عند الحاجة.',
        'استعن بمتخصصين قانونيين أو عقاريين أو سياحيين أو ماليين للقرارات عالية القيمة.'
      ]
    }
  ]
};

export default function TrustSafety() {
  return <PolicyPage en={en} ar={ar} icon={AlertTriangle} />;
}
