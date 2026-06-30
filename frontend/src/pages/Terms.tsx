import { FileText } from 'lucide-react';

import PolicyPage, { type PolicyPageCopy } from './PolicyPage';

const en: PolicyPageCopy = {
  eyebrow: 'Legal',
  title: 'Terms of Use',
  description:
    'These terms explain how users, owners, providers, developers, travel agencies, and admins should use lux.om as a curated marketplace.',
  lastUpdated: 'Last updated: June 2026',
  reviewNote: 'Public marketplace policy',
  contactCta: 'Contact lux.om',
  contactText: 'Questions about these terms or a marketplace issue can be sent to the lux.om team.',
  relatedTitle: 'Related policies',
  relatedLinks: [
    { to: '/privacy', label: 'Privacy Policy', description: 'How marketplace data is handled.' },
    { to: '/trust-safety', label: 'Trust & Safety', description: 'Reporting, moderation, and user safety.' },
    { to: '/refund-policy', label: 'Refund Policy', description: 'How paid booking refunds are reviewed.' }
  ],
  sections: [
    {
      title: 'Marketplace role',
      body:
        'lux.om provides a digital marketplace for discovering properties, stays, activities, travel agencies, developers, and related services in Oman. Unless clearly stated otherwise, lux.om is not the seller, landlord, buyer, tenant, travel operator, or legal representative in user transactions.',
      bullets: [
        'Providers are responsible for the accuracy of their listings, prices, availability, and service descriptions.',
        'Customers are responsible for reviewing listing details, booking terms, and provider requirements before committing.',
        'lux.om may review, moderate, verify, hide, suspend, or remove content when needed to protect the marketplace.'
      ]
    },
    {
      title: 'Accounts and eligibility',
      body:
        'Users must provide accurate account information and keep login details secure. Account roles may include customer, owner, activity provider, developer, travel agency, or admin.',
      bullets: [
        'Users may not impersonate another person or company.',
        'Users may not use lux.om for unlawful, misleading, abusive, or fraudulent activity.',
        'lux.om may suspend accounts that create trust, payment, safety, or legal risk.'
      ]
    },
    {
      title: 'Listings, activities, and provider content',
      body:
        'Marketplace content must be accurate, lawful, and supported by the provider. Content may be reviewed before publishing and may be removed if it is misleading, unsafe, duplicate, or incomplete.',
      bullets: [
        'Photos, titles, prices, addresses, availability, cancellation rules, and package details should be kept current.',
        'Providers should not upload sensitive personal documents into public descriptions or images.',
        'Verified badges are trust signals, not a guarantee of future performance or transaction outcome.'
      ]
    },
    {
      title: 'Bookings, payments, and transactions',
      body:
        'Booking requests, provider approvals, hosted checkout flows, payment status, cancellations, and refunds are managed through marketplace workflows. Some bookings may require admin or provider review before payment or confirmation.',
      bullets: [
        'A booking request is not always a final confirmed booking.',
        'Payment processing may be provided by third-party payment providers.',
        'Refunds and cancellations are handled under the cancellation and refund policies shown on lux.om.'
      ]
    },
    {
      title: 'Disputes and marketplace actions',
      body:
        'lux.om may review disputes, reports, verification concerns, payment concerns, or safety issues. The team may request additional information and may limit marketplace access while a case is reviewed.',
      bullets: [
        'Users should keep communication respectful and provide truthful evidence.',
        'Abusive reports, fake documents, fake reviews, or fraudulent claims may lead to account action.',
        'Emergency, police, court, immigration, property registry, or government matters must be handled with the relevant authority.'
      ]
    },
    {
      title: 'Changes to these terms',
      body:
        'lux.om may update these terms as the platform, services, payment flows, verification processes, or legal requirements evolve. Continued use of the platform after an update means the user accepts the updated terms.'
    }
  ]
};

const ar: PolicyPageCopy = {
  eyebrow: 'قانوني',
  title: 'شروط الاستخدام',
  description:
    'توضح هذه الشروط كيفية استخدام lux.om كمنصة سوق مختارة للمستخدمين والملاك والمزودين والمطورين ووكالات السفر.',
  lastUpdated: 'آخر تحديث: يونيو 2026',
  reviewNote: 'سياسة عامة للمنصة',
  contactCta: 'تواصل مع lux.om',
  contactText: 'يمكن إرسال الأسئلة المتعلقة بهذه الشروط أو أي مشكلة في السوق إلى فريق lux.om.',
  relatedTitle: 'سياسات ذات صلة',
  relatedLinks: [
    { to: '/privacy', label: 'سياسة الخصوصية', description: 'كيف يتم التعامل مع بيانات السوق.' },
    { to: '/trust-safety', label: 'الثقة والسلامة', description: 'الإبلاغ والمراجعة وحماية المستخدمين.' },
    { to: '/refund-policy', label: 'سياسة الاسترداد', description: 'كيف تتم مراجعة استرداد المدفوعات.' }
  ],
  sections: [
    {
      title: 'دور المنصة',
      body:
        'توفر lux.om سوقاً رقمياً لاكتشاف العقارات والإقامات والأنشطة ووكالات السفر والمطورين والخدمات المرتبطة بها في عُمان. ما لم يذكر خلاف ذلك بوضوح، فإن lux.om ليست البائع أو المؤجر أو المشتري أو المستأجر أو مشغل الرحلة أو الممثل القانوني في معاملات المستخدمين.',
      bullets: [
        'المزودون مسؤولون عن دقة الإعلانات والأسعار والتوفر ووصف الخدمات.',
        'العملاء مسؤولون عن مراجعة تفاصيل الإعلان وشروط الحجز ومتطلبات المزود قبل الالتزام.',
        'يمكن لـ lux.om مراجعة أو تعديل أو إخفاء أو تعليق أو إزالة المحتوى لحماية السوق.'
      ]
    },
    {
      title: 'الحسابات والأهلية',
      body:
        'يجب على المستخدمين تقديم معلومات حساب صحيحة والحفاظ على سرية بيانات الدخول. قد تشمل أدوار الحساب العميل أو المالك أو مزود النشاط أو المطور أو وكالة السفر أو الأدمن.',
      bullets: [
        'لا يجوز انتحال شخصية فرد أو شركة أخرى.',
        'لا يجوز استخدام lux.om لأي نشاط غير قانوني أو مضلل أو مسيء أو احتيالي.',
        'يمكن لـ lux.om تعليق الحسابات التي تخلق مخاطر ثقة أو دفع أو سلامة أو مخاطر قانونية.'
      ]
    },
    {
      title: 'الإعلانات والأنشطة ومحتوى المزودين',
      body:
        'يجب أن يكون محتوى السوق دقيقاً وقانونياً ومدعوماً من المزود. قد تتم مراجعة المحتوى قبل النشر وقد تتم إزالته إذا كان مضللاً أو غير آمن أو مكرراً أو ناقصاً.',
      bullets: [
        'يجب تحديث الصور والعناوين والأسعار والعناوين والتوفر وشروط الإلغاء وتفاصيل الباقات.',
        'ينبغي عدم رفع مستندات شخصية حساسة داخل الوصف أو الصور العامة.',
        'شارات التحقق هي إشارات ثقة وليست ضماناً للأداء المستقبلي أو نتيجة المعاملة.'
      ]
    },
    {
      title: 'الحجوزات والمدفوعات والمعاملات',
      body:
        'تتم إدارة طلبات الحجز وموافقات المزودين والدفع وحالة المدفوعات والإلغاءات والاسترداد من خلال مسارات المنصة. بعض الحجوزات قد تحتاج إلى مراجعة من المزود أو الإدارة قبل الدفع أو التأكيد.',
      bullets: [
        'طلب الحجز ليس دائماً حجزاً مؤكداً نهائياً.',
        'قد تتم معالجة المدفوعات من خلال مزودي دفع خارجيين.',
        'تخضع الإلغاءات والاستردادات لسياسات الإلغاء والاسترداد المنشورة على lux.om.'
      ]
    },
    {
      title: 'النزاعات وإجراءات السوق',
      body:
        'يمكن لـ lux.om مراجعة النزاعات والبلاغات ومخاوف التحقق والدفع والسلامة. قد يطلب الفريق معلومات إضافية وقد يحد من الوصول إلى السوق أثناء المراجعة.',
      bullets: [
        'يجب أن يكون التواصل محترماً وأن تكون الأدلة المقدمة صحيحة.',
        'البلاغات المسيئة أو المستندات المزورة أو المراجعات الوهمية أو الادعاءات الاحتيالية قد تؤدي إلى إجراءات على الحساب.',
        'المسائل الطارئة أو الشرطية أو القضائية أو الحكومية يجب التعامل معها مع الجهة المختصة.'
      ]
    },
    {
      title: 'تحديث الشروط',
      body:
        'قد تقوم lux.om بتحديث هذه الشروط مع تطور المنصة أو الخدمات أو الدفع أو التحقق أو المتطلبات القانونية. استمرار استخدام المنصة بعد التحديث يعني قبول الشروط المحدثة.'
    }
  ]
};

export default function Terms() {
  return <PolicyPage en={en} ar={ar} icon={FileText} />;
}
