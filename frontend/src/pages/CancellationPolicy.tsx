import { CalendarX2 } from 'lucide-react';

import PolicyPage, { type PolicyPageCopy } from './PolicyPage';

const en: PolicyPageCopy = {
  eyebrow: 'Bookings',
  title: 'Cancellation Policy',
  description:
    'This policy explains how booking cancellations are handled across property stays, activities, and travel packages on lux.om.',
  lastUpdated: 'Last updated: June 2026',
  reviewNote: 'Marketplace booking policy',
  contactCta: 'Ask about a cancellation',
  contactText: 'Contact lux.om when a cancellation needs marketplace review or admin support.',
  relatedTitle: 'Related policies',
  relatedLinks: [
    { to: '/refund-policy', label: 'Refund Policy', description: 'How refunds are reviewed after cancellation.' },
    { to: '/terms', label: 'Terms of Use', description: 'General marketplace rules.' },
    { to: '/trust-safety', label: 'Trust & Safety', description: 'Report unsafe or misleading booking behavior.' }
  ],
  sections: [
    {
      title: 'Before provider approval',
      body:
        'A booking request may be pending until the provider approves it. Pending requests may be easier to cancel because no final service commitment may have been made yet.',
      bullets: [
        'Customers should cancel as early as possible when plans change.',
        'Providers should respond quickly so customers understand the booking status.',
        'lux.om may keep audit records of cancellation requests and responses.'
      ]
    },
    {
      title: 'After provider approval',
      body:
        'After provider approval, cancellation rules may depend on the listing, activity, travel package, timing, payment status, and provider terms shown during booking.',
      bullets: [
        'Late cancellations may be non-refundable or partially refundable.',
        'No-shows may be treated differently from early cancellation requests.',
        'Providers must apply their published cancellation terms fairly and consistently.'
      ]
    },
    {
      title: 'Provider cancellation',
      body:
        'Providers should avoid cancelling confirmed bookings except when necessary. If a provider cancels, they should explain the reason and support a fair alternative, reschedule, or refund review.',
      bullets: [
        'Repeated provider cancellations may affect marketplace trust signals.',
        'Unsafe, unavailable, or materially changed services should be reported promptly.',
        'lux.om may review provider cancellation patterns.'
      ]
    },
    {
      title: 'Travel packages and third-party rules',
      body:
        'Outside-Oman packages, flights, hotels, tours, or third-party services may have separate supplier rules. Those supplier rules may limit cancellation, refund, reschedule, or name-change options.'
    }
  ]
};

const ar: PolicyPageCopy = {
  eyebrow: 'الحجوزات',
  title: 'سياسة الإلغاء',
  description:
    'توضح هذه السياسة كيف يتم التعامل مع إلغاء الحجوزات في الإقامات والأنشطة وباقات السفر على lux.om.',
  lastUpdated: 'آخر تحديث: يونيو 2026',
  reviewNote: 'سياسة حجوزات السوق',
  contactCta: 'السؤال عن إلغاء',
  contactText: 'تواصل مع lux.om عندما يحتاج الإلغاء إلى مراجعة السوق أو دعم الإدارة.',
  relatedTitle: 'سياسات ذات صلة',
  relatedLinks: [
    { to: '/refund-policy', label: 'سياسة الاسترداد', description: 'كيف تتم مراجعة الاسترداد بعد الإلغاء.' },
    { to: '/terms', label: 'شروط الاستخدام', description: 'قواعد السوق العامة.' },
    { to: '/trust-safety', label: 'الثقة والسلامة', description: 'الإبلاغ عن سلوك حجز غير آمن أو مضلل.' }
  ],
  sections: [
    {
      title: 'قبل موافقة المزود',
      body:
        'قد يبقى طلب الحجز معلقاً حتى يوافق المزود. قد يكون إلغاء الطلبات المعلقة أسهل لأن الالتزام النهائي بالخدمة قد لا يكون قد تم بعد.',
      bullets: [
        'يجب على العملاء الإلغاء مبكراً قدر الإمكان عند تغير الخطط.',
        'يجب على المزودين الرد بسرعة حتى يفهم العملاء حالة الحجز.',
        'قد تحتفظ lux.om بسجلات تدقيق لطلبات الإلغاء والردود.'
      ]
    },
    {
      title: 'بعد موافقة المزود',
      body:
        'بعد موافقة المزود، قد تعتمد قواعد الإلغاء على الإعلان أو النشاط أو باقة السفر أو التوقيت أو حالة الدفع أو شروط المزود المعروضة أثناء الحجز.',
      bullets: [
        'قد تكون الإلغاءات المتأخرة غير قابلة للاسترداد أو قابلة للاسترداد جزئياً.',
        'عدم الحضور قد يعامل بشكل مختلف عن طلبات الإلغاء المبكرة.',
        'يجب على المزودين تطبيق شروط الإلغاء المنشورة بشكل عادل ومتسق.'
      ]
    },
    {
      title: 'إلغاء المزود',
      body:
        'ينبغي للمزودين تجنب إلغاء الحجوزات المؤكدة إلا عند الضرورة. إذا ألغى المزود، يجب توضيح السبب ودعم بديل عادل أو إعادة جدولة أو مراجعة استرداد.',
      bullets: [
        'الإلغاءات المتكررة من المزود قد تؤثر على إشارات الثقة في السوق.',
        'يجب الإبلاغ بسرعة عن الخدمات غير الآمنة أو غير المتاحة أو المتغيرة جوهرياً.',
        'قد تراجع lux.om أنماط إلغاء المزودين.'
      ]
    },
    {
      title: 'باقات السفر وقواعد الأطراف الثالثة',
      body:
        'قد تكون لباقات خارج عُمان أو الرحلات أو الفنادق أو الجولات أو خدمات الأطراف الثالثة قواعد منفصلة. قد تحد هذه القواعد من خيارات الإلغاء أو الاسترداد أو إعادة الجدولة أو تغيير الاسم.'
    }
  ]
};

export default function CancellationPolicy() {
  return <PolicyPage en={en} ar={ar} icon={CalendarX2} />;
}
