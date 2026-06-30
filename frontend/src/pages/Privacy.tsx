import { ShieldCheck } from 'lucide-react';

import PolicyPage, { type PolicyPageCopy } from './PolicyPage';

const en: PolicyPageCopy = {
  eyebrow: 'Privacy',
  title: 'Privacy Policy',
  description:
    'This policy explains the main categories of information lux.om may collect, use, protect, and retain while operating the marketplace.',
  lastUpdated: 'Last updated: June 2026',
  reviewNote: 'Data protection policy',
  contactCta: 'Contact lux.om',
  contactText: 'For privacy questions or data requests, contact the lux.om team.',
  relatedTitle: 'Related policies',
  relatedLinks: [
    { to: '/terms', label: 'Terms of Use', description: 'Rules for using the marketplace.' },
    { to: '/verification-policy', label: 'Verification Policy', description: 'How verification information is reviewed.' },
    { to: '/trust-safety', label: 'Trust & Safety', description: 'How safety reports are handled.' }
  ],
  sections: [
    {
      title: 'Information users provide',
      body:
        'lux.om may collect account, profile, contact, role, listing, activity, booking, verification, report, review, and marketplace communication information submitted by users.',
      bullets: [
        'Account details may include name, email, role, company name, and security preferences.',
        'Marketplace details may include property, activity, developer, travel agency, booking, and payment status information.',
        'Verification and trust reports may include supporting details submitted for manual review.'
      ]
    },
    {
      title: 'How information is used',
      body:
        'Information is used to operate the marketplace, authenticate users, publish approved content, manage bookings, support payments, deliver notifications, review trust and safety issues, and improve platform reliability.',
      bullets: [
        'Transactional emails may be sent for account security, verification, bookings, payments, cancellations, and trust/safety outcomes.',
        'Optional email preferences may be managed from the profile email preferences section.',
        'Admin tools may show operational summaries needed to support the marketplace.'
      ]
    },
    {
      title: 'Sharing and service providers',
      body:
        'lux.om may share limited information with service providers that help operate the platform, such as hosting, database, email delivery, payment, analytics, or support tools.',
      bullets: [
        'Payment providers may process payment details under their own security and compliance processes.',
        'lux.om should not ask users to place card numbers or full identity documents in public messages or descriptions.',
        'Information may be shared when required by law, safety needs, dispute review, or platform protection.'
      ]
    },
    {
      title: 'Security and retention',
      body:
        'lux.om uses technical and operational controls to reduce risk, but no online platform can guarantee absolute security. Operational logs and audit records may be retained only as long as needed for security, compliance, support, and marketplace operations.',
      bullets: [
        'Email delivery audit events are subject to retention cleanup.',
        'Password reset, email change, and account security workflows use time-limited tokens or audit events.',
        'Users should keep account credentials secure and report suspicious activity quickly.'
      ]
    },
    {
      title: 'User choices',
      body:
        'Users can update profile information, manage optional email preferences, and contact lux.om about privacy questions. Some operational, security, payment, or legal records may need to be retained even after a request.'
    }
  ]
};

const ar: PolicyPageCopy = {
  eyebrow: 'الخصوصية',
  title: 'سياسة الخصوصية',
  description:
    'توضح هذه السياسة الفئات الرئيسية للمعلومات التي قد تجمعها lux.om أو تستخدمها أو تحميها أو تحتفظ بها أثناء تشغيل السوق.',
  lastUpdated: 'آخر تحديث: يونيو 2026',
  reviewNote: 'سياسة حماية البيانات',
  contactCta: 'تواصل مع lux.om',
  contactText: 'لأسئلة الخصوصية أو طلبات البيانات، تواصل مع فريق lux.om.',
  relatedTitle: 'سياسات ذات صلة',
  relatedLinks: [
    { to: '/terms', label: 'شروط الاستخدام', description: 'قواعد استخدام السوق.' },
    { to: '/verification-policy', label: 'سياسة التحقق', description: 'كيف تتم مراجعة معلومات التحقق.' },
    { to: '/trust-safety', label: 'الثقة والسلامة', description: 'كيف يتم التعامل مع بلاغات السلامة.' }
  ],
  sections: [
    {
      title: 'المعلومات التي يقدمها المستخدمون',
      body:
        'قد تجمع lux.om معلومات الحساب والملف الشخصي والتواصل والدور والإعلانات والأنشطة والحجوزات والتحقق والبلاغات والمراجعات والتواصل داخل السوق.',
      bullets: [
        'قد تشمل بيانات الحساب الاسم والبريد الإلكتروني والدور واسم الشركة وتفضيلات الأمان.',
        'قد تشمل بيانات السوق معلومات العقارات والأنشطة والمطورين ووكالات السفر والحجوزات وحالة الدفع.',
        'قد تشمل بيانات التحقق والبلاغات تفاصيل داعمة يتم تقديمها للمراجعة اليدوية.'
      ]
    },
    {
      title: 'كيفية استخدام المعلومات',
      body:
        'تستخدم المعلومات لتشغيل السوق وتوثيق المستخدمين ونشر المحتوى المعتمد وإدارة الحجوزات ودعم المدفوعات وإرسال الإشعارات ومراجعة قضايا الثقة والسلامة وتحسين موثوقية المنصة.',
      bullets: [
        'قد يتم إرسال رسائل بريدية خاصة بأمان الحساب والتحقق والحجوزات والمدفوعات والإلغاءات ونتائج الثقة والسلامة.',
        'يمكن إدارة تفضيلات البريد الاختيارية من قسم تفضيلات البريد في الملف الشخصي.',
        'قد تعرض أدوات الأدمن ملخصات تشغيلية لازمة لدعم السوق.'
      ]
    },
    {
      title: 'المشاركة ومزودو الخدمة',
      body:
        'قد تشارك lux.om معلومات محدودة مع مزودي الخدمة الذين يساعدون في تشغيل المنصة، مثل الاستضافة وقاعدة البيانات والبريد والدفع والتحليلات والدعم.',
      bullets: [
        'قد يعالج مزودو الدفع بيانات المدفوعات وفق إجراءاتهم الأمنية والامتثالية.',
        'لا ينبغي وضع أرقام البطاقات أو مستندات الهوية الكاملة في الرسائل أو الأوصاف العامة.',
        'قد تتم مشاركة المعلومات عند الحاجة القانونية أو السلامة أو مراجعة النزاعات أو حماية المنصة.'
      ]
    },
    {
      title: 'الأمان والاحتفاظ',
      body:
        'تستخدم lux.om ضوابط تقنية وتشغيلية لتقليل المخاطر، لكن لا توجد منصة إلكترونية تضمن الأمان المطلق. قد يتم الاحتفاظ بالسجلات التشغيلية وسجلات التدقيق فقط للمدة اللازمة للأمان والامتثال والدعم وتشغيل السوق.',
      bullets: [
        'تخضع سجلات تسليم البريد لسياسة تنظيف واحتفاظ.',
        'تستخدم مسارات إعادة تعيين كلمة المرور وتغيير البريد وأمان الحساب رموزاً محدودة المدة أو سجلات تدقيق.',
        'يجب على المستخدمين حماية بيانات الدخول والإبلاغ سريعاً عن أي نشاط مشبوه.'
      ]
    },
    {
      title: 'خيارات المستخدم',
      body:
        'يمكن للمستخدمين تحديث معلومات الملف الشخصي وإدارة تفضيلات البريد الاختيارية والتواصل مع lux.om بخصوص أسئلة الخصوصية. بعض السجلات التشغيلية أو الأمنية أو القانونية قد يلزم الاحتفاظ بها حتى بعد الطلب.'
    }
  ]
};

export default function Privacy() {
  return <PolicyPage en={en} ar={ar} icon={ShieldCheck} />;
}
