import { ReceiptText } from 'lucide-react';

import PolicyPage, { type PolicyPageCopy } from './PolicyPage';

const en: PolicyPageCopy = {
  eyebrow: 'Payments',
  title: 'Refund Policy',
  description:
    'This policy explains how refund requests are reviewed for marketplace bookings and paid activity or travel transactions.',
  lastUpdated: 'Last updated: June 2026',
  reviewNote: 'Marketplace payment policy',
  contactCta: 'Ask about a refund',
  contactText: 'Contact lux.om when a refund requires marketplace review or payment status clarification.',
  relatedTitle: 'Related policies',
  relatedLinks: [
    { to: '/cancellation-policy', label: 'Cancellation Policy', description: 'When cancellations may affect refund eligibility.' },
    { to: '/terms', label: 'Terms of Use', description: 'General marketplace responsibilities.' },
    { to: '/trust-safety', label: 'Trust & Safety', description: 'Report misleading or unsafe payment behavior.' }
  ],
  sections: [
    {
      title: 'Refund eligibility',
      body:
        'Refund eligibility depends on the booking type, provider approval status, cancellation timing, payment status, published provider terms, and any third-party supplier rules.',
      bullets: [
        'Pending unpaid requests generally do not require a refund.',
        'Approved paid bookings may require provider or admin review before refund completion.',
        'Non-refundable supplier or provider terms may limit refund options.'
      ]
    },
    {
      title: 'Payment processor timing',
      body:
        'When a refund is approved, the payment provider or bank may take additional time to return funds. lux.om may show refund status, but actual settlement timing can depend on external payment systems.'
    },
    {
      title: 'Fees, partial refunds, and disputes',
      body:
        'Some refunds may be partial due to supplier rules, cancellation timing, consumed services, bank or payment provider fees, or marketplace dispute findings.',
      bullets: [
        'Users should not file false chargebacks or duplicate refund claims.',
        'lux.om may request supporting evidence before making an admin decision.',
        'Fraud, abuse, or unsafe conduct may affect refund handling.'
      ]
    },
    {
      title: 'Provider responsibility',
      body:
        'Providers must keep cancellation and refund terms accurate and must not promise refunds they cannot honor. Material changes, unavailable services, or provider-side cancellations should be handled fairly.'
    }
  ]
};

const ar: PolicyPageCopy = {
  eyebrow: 'المدفوعات',
  title: 'سياسة الاسترداد',
  description:
    'توضح هذه السياسة كيف تتم مراجعة طلبات الاسترداد لحجوزات السوق ومعاملات الأنشطة أو السفر المدفوعة.',
  lastUpdated: 'آخر تحديث: يونيو 2026',
  reviewNote: 'سياسة دفع السوق',
  contactCta: 'السؤال عن استرداد',
  contactText: 'تواصل مع lux.om عندما يحتاج الاسترداد إلى مراجعة السوق أو توضيح حالة الدفع.',
  relatedTitle: 'سياسات ذات صلة',
  relatedLinks: [
    { to: '/cancellation-policy', label: 'سياسة الإلغاء', description: 'متى قد يؤثر الإلغاء على أهلية الاسترداد.' },
    { to: '/terms', label: 'شروط الاستخدام', description: 'مسؤوليات السوق العامة.' },
    { to: '/trust-safety', label: 'الثقة والسلامة', description: 'الإبلاغ عن سلوك دفع مضلل أو غير آمن.' }
  ],
  sections: [
    {
      title: 'أهلية الاسترداد',
      body:
        'تعتمد أهلية الاسترداد على نوع الحجز وحالة موافقة المزود وتوقيت الإلغاء وحالة الدفع وشروط المزود المنشورة وقواعد أي مورد خارجي.',
      bullets: [
        'الطلبات المعلقة غير المدفوعة غالباً لا تحتاج إلى استرداد.',
        'الحجوزات المدفوعة والمعتمدة قد تحتاج إلى مراجعة المزود أو الإدارة قبل اكتمال الاسترداد.',
        'الشروط غير القابلة للاسترداد من المورد أو المزود قد تحد من خيارات الاسترداد.'
      ]
    },
    {
      title: 'توقيت مزود الدفع',
      body:
        'عند الموافقة على الاسترداد، قد يحتاج مزود الدفع أو البنك إلى وقت إضافي لإرجاع الأموال. قد تعرض lux.om حالة الاسترداد، لكن توقيت التسوية الفعلي يعتمد على أنظمة دفع خارجية.'
    },
    {
      title: 'الرسوم والاسترداد الجزئي والنزاعات',
      body:
        'قد يكون بعض الاسترداد جزئياً بسبب قواعد المورد أو توقيت الإلغاء أو الخدمات المستخدمة أو رسوم البنك أو مزود الدفع أو نتائج مراجعة النزاع داخل السوق.',
      bullets: [
        'لا يجوز تقديم اعتراضات دفع كاذبة أو طلبات استرداد مكررة.',
        'قد تطلب lux.om أدلة داعمة قبل اتخاذ قرار إداري.',
        'الاحتيال أو الإساءة أو السلوك غير الآمن قد يؤثر على معالجة الاسترداد.'
      ]
    },
    {
      title: 'مسؤولية المزود',
      body:
        'يجب على المزودين إبقاء شروط الإلغاء والاسترداد دقيقة وعدم وعد المستخدمين باسترداد لا يمكن تنفيذه. يجب التعامل بعدل مع التغييرات الجوهرية أو الخدمات غير المتاحة أو الإلغاءات من طرف المزود.'
    }
  ]
};

export default function RefundPolicy() {
  return <PolicyPage en={en} ar={ar} icon={ReceiptText} />;
}
