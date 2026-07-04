import type { UserRole } from '../types';
import {
  getMarketplacePersona,
  type MarketplacePersona,
  type MarketplaceWorkspaceKey
} from './marketplacePersona';

export type DashboardContentLanguage = 'en' | 'ar';

type LocalizedText = {
  en: string;
  ar: string;
};

export type PersonaDashboardPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

export type PersonaDashboardMetricKey =
  | 'requests'
  | 'bookings'
  | 'payments'
  | 'saved'
  | 'listings'
  | 'activities'
  | 'packages'
  | 'projects'
  | 'units'
  | 'leads'
  | 'documents'
  | 'media'
  | 'verification'
  | 'performance'
  | 'notifications';

export type PersonaDashboardActionKey =
  | 'explore-marketplace'
  | 'add-listing'
  | 'add-activity'
  | 'add-travel-package'
  | 'manage-projects'
  | 'review-bookings'
  | 'open-admin'
  | 'complete-verification'
  | 'review-media'
  | 'view-payments';

export type PersonaDashboardTab = {
  key: MarketplaceWorkspaceKey;
  label: LocalizedText;
  description: LocalizedText;
  emptyTitle: LocalizedText;
  emptyDescription: LocalizedText;
  priority: PersonaDashboardPriority;
};

export type PersonaDashboardMetric = {
  key: PersonaDashboardMetricKey;
  label: LocalizedText;
  helper: LocalizedText;
};

export type PersonaDashboardAction = {
  key: PersonaDashboardActionKey;
  to: string;
  label: LocalizedText;
  helper: LocalizedText;
};

export type PersonaDashboardReadinessItem = {
  key: string;
  label: LocalizedText;
  description: LocalizedText;
  priority: PersonaDashboardPriority;
};

export type PersonaDashboardDefinition = {
  persona: MarketplacePersona;
  hero: {
    eyebrow: LocalizedText;
    title: LocalizedText;
    description: LocalizedText;
  };
  primaryActions: PersonaDashboardAction[];
  metrics: PersonaDashboardMetric[];
  tabs: PersonaDashboardTab[];
  readiness: PersonaDashboardReadinessItem[];
};

export type LocalizedPersonaDashboardDefinition = {
  persona: MarketplacePersona;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
  };
  primaryActions: Array<PersonaDashboardAction & { text: string; helperText: string }>;
  metrics: Array<PersonaDashboardMetric & { text: string; helperText: string }>;
  tabs: Array<
    PersonaDashboardTab & {
      text: string;
      helperText: string;
      emptyStateTitle: string;
      emptyStateDescription: string;
    }
  >;
  readiness: Array<PersonaDashboardReadinessItem & { text: string; helperText: string }>;
};

const sharedNotificationsTab: PersonaDashboardTab = {
  key: 'notifications',
  label: { en: 'Notifications', ar: 'التنبيهات' },
  description: {
    en: 'Booking, payment, publishing, verification, trust, and system updates.',
    ar: 'تحديثات الحجز والدفع والنشر والتحقق والثقة والنظام.'
  },
  emptyTitle: { en: 'No notifications yet', ar: 'لا توجد تنبيهات حالياً' },
  emptyDescription: {
    en: 'Important marketplace updates will appear here.',
    ar: 'ستظهر هنا تحديثات السوق المهمة.'
  },
  priority: 'medium'
};

const sharedVerificationReadiness: PersonaDashboardReadinessItem = {
  key: 'verification',
  label: { en: 'Verification readiness', ar: 'جاهزية التحقق' },
  description: {
    en: 'Complete documents and trust checks before pushing high-value marketplace activity.',
    ar: 'استكمل المستندات وفحوصات الثقة قبل تفعيل نشاطات السوق عالية القيمة.'
  },
  priority: 'high'
};

const sharedMediaReadiness: PersonaDashboardReadinessItem = {
  key: 'media-quality',
  label: { en: 'Media quality', ar: 'جودة الوسائط' },
  description: {
    en: 'Use strong images, complete galleries, and clear presentation before publishing.',
    ar: 'استخدم صوراً قوية ومعارض مكتملة وعرضاً واضحاً قبل النشر.'
  },
  priority: 'medium'
};

export const personaDashboardDefinitions = {
  customer: {
    persona: 'customer',
    hero: {
      eyebrow: { en: 'Personal marketplace hub', ar: 'مركزك الشخصي في السوق' },
      title: {
        en: 'Track your opportunities, bookings, payments, and alerts.',
        ar: 'تابع الفرص والحجوزات والمدفوعات والتنبيهات الخاصة بك.'
      },
      description: {
        en: 'A focused space for buyers, renters, travelers, and investors to manage every active request across lux.om.',
        ar: 'مساحة مركزة للمشترين والمستأجرين والمسافرين والمستثمرين لإدارة كل طلب نشط داخل lux.om.'
      }
    },
    primaryActions: [
      {
        key: 'explore-marketplace',
        to: '/listings',
        label: { en: 'Explore marketplace', ar: 'استكشاف السوق' },
        helper: {
          en: 'Browse real estate, activities, developers, and travel agencies.',
          ar: 'تصفح العقارات والأنشطة والمطورين ووكالات السفر.'
        }
      },
      {
        key: 'view-payments',
        to: '/dashboard',
        label: { en: 'Review payments', ar: 'مراجعة المدفوعات' },
        helper: {
          en: 'Check pending payments, receipts, and confirmed bookings.',
          ar: 'راجع المدفوعات المعلقة والإيصالات والحجوزات المؤكدة.'
        }
      }
    ],
    metrics: [
      {
        key: 'requests',
        label: { en: 'Requests', ar: 'الطلبات' },
        helper: { en: 'Inquiries and booking requests', ar: 'الاستفسارات وطلبات الحجز' }
      },
      {
        key: 'payments',
        label: { en: 'Payments', ar: 'المدفوعات' },
        helper: { en: 'Pending and completed payments', ar: 'المدفوعات المعلقة والمكتملة' }
      },
      {
        key: 'saved',
        label: { en: 'Saved', ar: 'المحفوظات' },
        helper: { en: 'Saved listings, activities, and alerts', ar: 'العقارات والأنشطة والتنبيهات المحفوظة' }
      },
      {
        key: 'notifications',
        label: { en: 'Notifications', ar: 'التنبيهات' },
        helper: { en: 'Important account updates', ar: 'تحديثات الحساب المهمة' }
      }
    ],
    tabs: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Account status, next actions, recent requests, and alerts.',
          ar: 'حالة الحساب والخطوات التالية والطلبات الأخيرة والتنبيهات.'
        },
        emptyTitle: { en: 'Your marketplace activity starts here', ar: 'يبدأ نشاطك في السوق من هنا' },
        emptyDescription: {
          en: 'Explore listings, activities, developers, and travel opportunities to start building your workspace.',
          ar: 'استكشف العقارات والأنشطة والمطورين وفرص السفر لتبدأ بناء مساحة عملك.'
        },
        priority: 'critical'
      },
      {
        key: 'my-bookings',
        label: { en: 'My bookings', ar: 'حجوزاتي' },
        description: {
          en: 'Booking timeline, payment status, receipts, and cancellation requests.',
          ar: 'مسار الحجز وحالة الدفع والإيصالات وطلبات الإلغاء.'
        },
        emptyTitle: { en: 'No bookings yet', ar: 'لا توجد حجوزات بعد' },
        emptyDescription: {
          en: 'Bookings from activities and marketplace requests will appear here.',
          ar: 'ستظهر هنا حجوزات الأنشطة وطلبات السوق.'
        },
        priority: 'high'
      },
      {
        key: 'payments-receipts',
        label: { en: 'Payments & receipts', ar: 'المدفوعات والإيصالات' },
        description: {
          en: 'Payment status, receipts, refunds, and booking checkout actions.',
          ar: 'حالة الدفع والإيصالات والاستردادات وإجراءات الدفع للحجوزات.'
        },
        emptyTitle: { en: 'No payments to review', ar: 'لا توجد مدفوعات للمراجعة' },
        emptyDescription: {
          en: 'Payment details appear after a paid booking or transaction starts.',
          ar: 'تظهر تفاصيل الدفع بعد بدء حجز أو معاملة مدفوعة.'
        },
        priority: 'high'
      },
      {
        key: 'saved-alerts',
        label: { en: 'Saved & alerts', ar: 'المحفوظات والتنبيهات' },
        description: {
          en: 'Saved listings, saved activities, watchlists, and alert preferences.',
          ar: 'العقارات والأنشطة المحفوظة وقوائم المتابعة وتفضيلات التنبيهات.'
        },
        emptyTitle: { en: 'Nothing saved yet', ar: 'لا توجد عناصر محفوظة بعد' },
        emptyDescription: {
          en: 'Save listings, activities, developers, and opportunities to compare later.',
          ar: 'احفظ العقارات والأنشطة والمطورين والفرص لمقارنتها لاحقاً.'
        },
        priority: 'medium'
      },
      {
        key: 'valuations',
        label: { en: 'Valuations', ar: 'التقييمات' },
        description: {
          en: 'Property valuation requests and investor-readiness tools.',
          ar: 'طلبات تقييم العقارات وأدوات جاهزية المستثمر.'
        },
        emptyTitle: { en: 'No valuation requests yet', ar: 'لا توجد طلبات تقييم بعد' },
        emptyDescription: {
          en: 'Request valuations when you need stronger pricing context.',
          ar: 'اطلب التقييمات عندما تحتاج سياقاً أقوى للتسعير.'
        },
        priority: 'medium'
      },
      {
        key: 'transactions',
        label: { en: 'Transactions', ar: 'المعاملات' },
        description: {
          en: 'Marketplace transactions connected to your account.',
          ar: 'المعاملات المرتبطة بحسابك داخل السوق.'
        },
        emptyTitle: { en: 'No transactions yet', ar: 'لا توجد معاملات بعد' },
        emptyDescription: {
          en: 'Transaction workflows appear when a deal or structured marketplace process begins.',
          ar: 'تظهر مسارات المعاملات عند بدء صفقة أو عملية منظمة داخل السوق.'
        },
        priority: 'medium'
      },
      {
        key: 'contracts-rent',
        label: { en: 'Contracts & rent', ar: 'العقود والإيجار' },
        description: {
          en: 'Rental contracts, schedules, rent payments, and milestones.',
          ar: 'عقود الإيجار والجداول ومدفوعات الإيجار والمراحل.'
        },
        emptyTitle: { en: 'No contracts yet', ar: 'لا توجد عقود بعد' },
        emptyDescription: {
          en: 'Contract and rent tools appear when a rental workflow starts.',
          ar: 'تظهر أدوات العقود والإيجار عند بدء مسار تأجير.'
        },
        priority: 'medium'
      },
      sharedNotificationsTab
    ],
    readiness: [
      {
        key: 'email-profile',
        label: { en: 'Account readiness', ar: 'جاهزية الحساب' },
        description: {
          en: 'Verify your email and keep contact details ready for requests and payments.',
          ar: 'فعّل البريد وحافظ على بيانات التواصل جاهزة للطلبات والمدفوعات.'
        },
        priority: 'high'
      }
    ]
  },

  owner: {
    persona: 'owner',
    hero: {
      eyebrow: { en: 'Real-estate command center', ar: 'مركز إدارة العقارات' },
      title: {
        en: 'Manage listings, leads, verification, contracts, and performance.',
        ar: 'أدر العقارات والعملاء والتحقق والعقود والأداء.'
      },
      description: {
        en: 'A focused workspace for owners and agents to publish inventory, respond to demand, and keep every listing launch-ready.',
        ar: 'مساحة مركزة للمالكين والوسطاء لنشر العقارات والرد على الطلب والحفاظ على جاهزية كل عقار.'
      }
    },
    primaryActions: [
      {
        key: 'add-listing',
        to: '/add-listing',
        label: { en: 'Add listing', ar: 'إضافة عقار' },
        helper: {
          en: 'Create or update real-estate inventory.',
          ar: 'أنشئ أو حدّث مخزون العقارات.'
        }
      },
      {
        key: 'complete-verification',
        to: '/dashboard',
        label: { en: 'Complete verification', ar: 'استكمال التحقق' },
        helper: {
          en: 'Prepare documents and ownership trust signals.',
          ar: 'جهّز المستندات ومؤشرات الثقة والملكية.'
        }
      }
    ],
    metrics: [
      {
        key: 'listings',
        label: { en: 'Listings', ar: 'العقارات' },
        helper: { en: 'Published, pending, and rejected listings', ar: 'العقارات المنشورة والمعلقة والمرفوضة' }
      },
      {
        key: 'leads',
        label: { en: 'Leads', ar: 'العملاء المحتملون' },
        helper: { en: 'Inquiries and viewing interest', ar: 'الاستفسارات واهتمام الزيارة' }
      },
      {
        key: 'verification',
        label: { en: 'Verification', ar: 'التحقق' },
        helper: { en: 'Ownership and trust readiness', ar: 'جاهزية الملكية والثقة' }
      },
      {
        key: 'performance',
        label: { en: 'Performance', ar: 'الأداء' },
        helper: { en: 'Visibility and conversion signals', ar: 'مؤشرات الظهور والتحويل' }
      }
    ],
    tabs: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Portfolio health, urgent actions, pending approvals, and lead activity.',
          ar: 'صحة المحفظة والإجراءات العاجلة والموافقات المعلقة ونشاط العملاء.'
        },
        emptyTitle: { en: 'Your real-estate workspace is ready', ar: 'مساحة العقارات جاهزة' },
        emptyDescription: {
          en: 'Add listings and complete readiness checks to start receiving demand.',
          ar: 'أضف العقارات واستكمل فحوصات الجاهزية لبدء استقبال الطلب.'
        },
        priority: 'critical'
      },
      {
        key: 'listings-command',
        label: { en: 'Listings command center', ar: 'مركز إدارة العقارات' },
        description: {
          en: 'Listing status, edits, media, pricing, publishing readiness, and actions.',
          ar: 'حالة العقارات والتعديلات والوسائط والتسعير وجاهزية النشر والإجراءات.'
        },
        emptyTitle: { en: 'No listings yet', ar: 'لا توجد عقارات بعد' },
        emptyDescription: {
          en: 'Add your first listing to start building your portfolio.',
          ar: 'أضف أول عقار لبدء بناء محفظتك.'
        },
        priority: 'critical'
      },
      {
        key: 'lead-inbox',
        label: { en: 'Lead inbox', ar: 'صندوق العملاء المحتملين' },
        description: {
          en: 'Property inquiries, contact actions, viewing interest, and buyer/renter follow-up.',
          ar: 'استفسارات العقارات وإجراءات التواصل واهتمام الزيارة ومتابعة المشترين والمستأجرين.'
        },
        emptyTitle: { en: 'No leads yet', ar: 'لا يوجد عملاء محتملون بعد' },
        emptyDescription: {
          en: 'Leads appear when customers inquire, save, or request a viewing.',
          ar: 'يظهر العملاء المحتملون عند الاستفسار أو الحفظ أو طلب الزيارة.'
        },
        priority: 'high'
      },
      {
        key: 'viewing-requests',
        label: { en: 'Viewing / booking requests', ar: 'طلبات الزيارة / الحجز' },
        description: {
          en: 'Requests that need review, approval, rejection, or scheduling follow-up.',
          ar: 'طلبات تحتاج مراجعة أو قبول أو رفض أو متابعة جدولة.'
        },
        emptyTitle: { en: 'No viewing requests yet', ar: 'لا توجد طلبات زيارة بعد' },
        emptyDescription: {
          en: 'Requests connected to your listings will appear here.',
          ar: 'ستظهر هنا الطلبات المرتبطة بعقاراتك.'
        },
        priority: 'high'
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Image coverage, presentation gaps, and listing media readiness.',
          ar: 'تغطية الصور وفجوات العرض وجاهزية وسائط العقار.'
        },
        emptyTitle: { en: 'No media issues detected', ar: 'لا توجد مشاكل وسائط حالياً' },
        emptyDescription: {
          en: 'Media guidance appears when listings need stronger presentation.',
          ar: 'تظهر إرشادات الوسائط عندما يحتاج العقار إلى عرض أقوى.'
        },
        priority: 'medium'
      },
      {
        key: 'verification',
        label: { en: 'Verification', ar: 'التحقق' },
        description: {
          en: 'Ownership documents, verification requests, and trust status.',
          ar: 'مستندات الملكية وطلبات التحقق وحالة الثقة.'
        },
        emptyTitle: { en: 'No verification requests yet', ar: 'لا توجد طلبات تحقق بعد' },
        emptyDescription: {
          en: 'Submit documents to increase trust and unlock stronger marketplace confidence.',
          ar: 'قدّم المستندات لزيادة الثقة وتعزيز موثوقية السوق.'
        },
        priority: 'high'
      },
      {
        key: 'contracts-rent',
        label: { en: 'Contracts & rent', ar: 'العقود والإيجار' },
        description: {
          en: 'Rental contracts, rent schedules, receipts, and registration milestones.',
          ar: 'عقود الإيجار وجداول الدفعات والإيصالات ومراحل التسجيل.'
        },
        emptyTitle: { en: 'No contract workflows yet', ar: 'لا توجد مسارات عقود بعد' },
        emptyDescription: {
          en: 'Contract tools appear when a rental or transaction workflow begins.',
          ar: 'تظهر أدوات العقود عند بدء مسار تأجير أو معاملة.'
        },
        priority: 'medium'
      },
      {
        key: 'performance',
        label: { en: 'Performance', ar: 'الأداء' },
        description: {
          en: 'Listing visibility, inquiry pressure, pricing context, and conversion signals.',
          ar: 'ظهور العقارات وضغط الاستفسارات وسياق التسعير ومؤشرات التحويل.'
        },
        emptyTitle: { en: 'Performance data is building', ar: 'يتم بناء بيانات الأداء' },
        emptyDescription: {
          en: 'Performance insights become stronger as listings receive traffic and requests.',
          ar: 'تصبح رؤى الأداء أقوى مع حصول العقارات على زيارات وطلبات.'
        },
        priority: 'medium'
      },
      sharedNotificationsTab
    ],
    readiness: [sharedVerificationReadiness, sharedMediaReadiness]
  },

  activityProvider: {
    persona: 'activityProvider',
    hero: {
      eyebrow: { en: 'Activity operations workspace', ar: 'مساحة عمليات الأنشطة' },
      title: {
        en: 'Run experiences, bookings, capacity, payments, reviews, and trust.',
        ar: 'أدر التجارب والحجوزات والسعة والمدفوعات والمراجعات والثقة.'
      },
      description: {
        en: 'A daily operating cockpit for local experience providers managing demand and service quality.',
        ar: 'مركز تشغيل يومي لمزودي التجارب المحليين لإدارة الطلب وجودة الخدمة.'
      }
    },
    primaryActions: [
      {
        key: 'add-activity',
        to: '/add-activity',
        label: { en: 'Add activity', ar: 'إضافة نشاط' },
        helper: {
          en: 'Create or update local experiences.',
          ar: 'أنشئ أو حدّث التجارب المحلية.'
        }
      },
      {
        key: 'review-bookings',
        to: '/dashboard',
        label: { en: 'Review bookings', ar: 'مراجعة الحجوزات' },
        helper: {
          en: 'Approve, reject, or follow up on customer requests.',
          ar: 'اقبل أو ارفض أو تابع طلبات العملاء.'
        }
      }
    ],
    metrics: [
      {
        key: 'activities',
        label: { en: 'Activities', ar: 'الأنشطة' },
        helper: { en: 'Published and pending experiences', ar: 'التجارب المنشورة والمعلقة' }
      },
      {
        key: 'bookings',
        label: { en: 'Bookings', ar: 'الحجوزات' },
        helper: { en: 'Requests and upcoming demand', ar: 'الطلبات والطلب القادم' }
      },
      {
        key: 'payments',
        label: { en: 'Payments', ar: 'المدفوعات' },
        helper: { en: 'Paid, pending, and failed payments', ar: 'المدفوعات المدفوعة والمعلقة والفاشلة' }
      },
      {
        key: 'performance',
        label: { en: 'Performance', ar: 'الأداء' },
        helper: { en: 'Demand, conversion, and capacity signals', ar: 'مؤشرات الطلب والتحويل والسعة' }
      }
    ],
    tabs: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Activity health, booking pressure, urgent requests, and readiness signals.',
          ar: 'صحة الأنشطة وضغط الحجوزات والطلبات العاجلة ومؤشرات الجاهزية.'
        },
        emptyTitle: { en: 'Your activity workspace is ready', ar: 'مساحة الأنشطة جاهزة' },
        emptyDescription: {
          en: 'Add your first activity and complete media/readiness checks.',
          ar: 'أضف أول نشاط واستكمل فحوصات الوسائط والجاهزية.'
        },
        priority: 'critical'
      },
      {
        key: 'activities-command',
        label: { en: 'Activities command center', ar: 'مركز إدارة الأنشطة' },
        description: {
          en: 'Experience status, pricing, location, media, and publishing readiness.',
          ar: 'حالة التجارب والتسعير والموقع والوسائط وجاهزية النشر.'
        },
        emptyTitle: { en: 'No activities yet', ar: 'لا توجد أنشطة بعد' },
        emptyDescription: {
          en: 'Add an activity to start accepting demand.',
          ar: 'أضف نشاطاً للبدء في استقبال الطلب.'
        },
        priority: 'critical'
      },
      {
        key: 'booking-requests',
        label: { en: 'Booking requests', ar: 'طلبات الحجز' },
        description: {
          en: 'Approve, reject, message, or follow up on received bookings.',
          ar: 'قبول أو رفض أو مراسلة أو متابعة الحجوزات المستلمة.'
        },
        emptyTitle: { en: 'No booking requests yet', ar: 'لا توجد طلبات حجز بعد' },
        emptyDescription: {
          en: 'Requests connected to your activities will appear here.',
          ar: 'ستظهر هنا الطلبات المرتبطة بأنشطتك.'
        },
        priority: 'high'
      },
      {
        key: 'schedule-capacity',
        label: { en: 'Schedule & capacity', ar: 'الجدولة والسعة' },
        description: {
          en: 'Capacity pressure by date, preferred times, guests, and availability.',
          ar: 'ضغط السعة حسب التاريخ والأوقات المفضلة والضيوف والتوفر.'
        },
        emptyTitle: { en: 'No capacity pressure yet', ar: 'لا يوجد ضغط على السعة حالياً' },
        emptyDescription: {
          en: 'Capacity insights appear as bookings arrive.',
          ar: 'تظهر رؤى السعة مع وصول الحجوزات.'
        },
        priority: 'high'
      },
      {
        key: 'payments-receipts',
        label: { en: 'Payments & receipts', ar: 'المدفوعات والإيصالات' },
        description: {
          en: 'Booking payments, receipts, failed payments, and payout readiness.',
          ar: 'مدفوعات الحجوزات والإيصالات والمدفوعات الفاشلة وجاهزية التحويل.'
        },
        emptyTitle: { en: 'No payments yet', ar: 'لا توجد مدفوعات بعد' },
        emptyDescription: {
          en: 'Paid booking records will appear here.',
          ar: 'ستظهر هنا سجلات الحجوزات المدفوعة.'
        },
        priority: 'high'
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Activity photos, trust visuals, missing highlights, and presentation quality.',
          ar: 'صور الأنشطة ووسائط الثقة والمميزات الناقصة وجودة العرض.'
        },
        emptyTitle: { en: 'No media gaps detected', ar: 'لا توجد فجوات وسائط حالياً' },
        emptyDescription: {
          en: 'Media quality guidance appears when activities need stronger visuals.',
          ar: 'تظهر إرشادات جودة الوسائط عندما تحتاج الأنشطة إلى صور أقوى.'
        },
        priority: 'medium'
      },
      {
        key: 'reviews-trust',
        label: { en: 'Reviews & trust', ar: 'المراجعات والثقة' },
        description: {
          en: 'Reviews, reports, provider trust signals, and customer confidence.',
          ar: 'المراجعات والبلاغات ومؤشرات ثقة المزود وطمأنة العملاء.'
        },
        emptyTitle: { en: 'No reviews yet', ar: 'لا توجد مراجعات بعد' },
        emptyDescription: {
          en: 'Reviews and trust signals appear after customers interact with your experiences.',
          ar: 'تظهر المراجعات ومؤشرات الثقة بعد تفاعل العملاء مع تجاربك.'
        },
        priority: 'medium'
      },
      sharedNotificationsTab
    ],
    readiness: [sharedVerificationReadiness, sharedMediaReadiness]
  },

  travelAgency: {
    persona: 'travelAgency',
    hero: {
      eyebrow: { en: 'Travel agency cockpit', ar: 'مركز وكالة السفر' },
      title: {
        en: 'Manage packages, itineraries, group bookings, documents, and trust.',
        ar: 'أدر الباقات والبرامج وحجوزات المجموعات والمستندات والثقة.'
      },
      description: {
        en: 'A premium workspace for agencies selling outside-Oman travel packages with complete operational readiness.',
        ar: 'مساحة عمل فاخرة لوكالات السفر التي تبيع باقات خارج عمان مع جاهزية تشغيلية كاملة.'
      }
    },
    primaryActions: [
      {
        key: 'add-travel-package',
        to: '/add-activity',
        label: { en: 'Add travel package', ar: 'إضافة باقة سفر' },
        helper: {
          en: 'Create outside-Oman packages with itinerary, hotel, and transfer details.',
          ar: 'أنشئ باقات خارج عمان مع تفاصيل البرنامج والفندق والتنقلات.'
        }
      },
      {
        key: 'review-bookings',
        to: '/dashboard',
        label: { en: 'Review group requests', ar: 'مراجعة طلبات المجموعات' },
        helper: {
          en: 'Follow up on travelers, preferred dates, guests, and package payments.',
          ar: 'تابع المسافرين والتواريخ المفضلة والضيوف ومدفوعات الباقات.'
        }
      }
    ],
    metrics: [
      {
        key: 'packages',
        label: { en: 'Packages', ar: 'الباقات' },
        helper: { en: 'Outside-Oman package inventory', ar: 'مخزون باقات خارج عمان' }
      },
      {
        key: 'bookings',
        label: { en: 'Group requests', ar: 'طلبات المجموعات' },
        helper: { en: 'Travelers, guests, and follow-up', ar: 'المسافرون والضيوف والمتابعة' }
      },
      {
        key: 'documents',
        label: { en: 'Documents', ar: 'المستندات' },
        helper: { en: 'Agency and supplier readiness', ar: 'جاهزية الوكالة والموردين' }
      },
      {
        key: 'payments',
        label: { en: 'Package payments', ar: 'مدفوعات الباقات' },
        helper: { en: 'Paid, pending, and failed checkout', ar: 'الدفع المكتمل والمعلق والفاشل' }
      }
    ],
    tabs: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Package health, missing travel details, booking pressure, and urgent actions.',
          ar: 'صحة الباقات وتفاصيل السفر الناقصة وضغط الحجوزات والإجراءات العاجلة.'
        },
        emptyTitle: { en: 'Your travel agency cockpit is ready', ar: 'مركز وكالة السفر جاهز' },
        emptyDescription: {
          en: 'Add packages and complete itinerary/document readiness.',
          ar: 'أضف الباقات واستكمل جاهزية البرامج والمستندات.'
        },
        priority: 'critical'
      },
      {
        key: 'travel-packages',
        label: { en: 'Travel packages', ar: 'باقات السفر' },
        description: {
          en: 'Outside-Oman package inventory, pricing, inclusions, and publishing state.',
          ar: 'مخزون باقات خارج عمان والتسعير والمشتملات وحالة النشر.'
        },
        emptyTitle: { en: 'No travel packages yet', ar: 'لا توجد باقات سفر بعد' },
        emptyDescription: {
          en: 'Create a package to start receiving traveler demand.',
          ar: 'أنشئ باقة لبدء استقبال طلبات المسافرين.'
        },
        priority: 'critical'
      },
      {
        key: 'itineraries',
        label: { en: 'Itineraries', ar: 'برامج الرحلات' },
        description: {
          en: 'Flights, hotels, transfers, destinations, package days, and inclusions.',
          ar: 'الرحلات والفنادق والتنقلات والوجهات وأيام الباقة والمشتملات.'
        },
        emptyTitle: { en: 'No itineraries completed yet', ar: 'لم تكتمل البرامج بعد' },
        emptyDescription: {
          en: 'Itinerary readiness helps customers trust and compare packages.',
          ar: 'جاهزية البرنامج تساعد العملاء على الثقة والمقارنة.'
        },
        priority: 'high'
      },
      {
        key: 'group-bookings',
        label: { en: 'Group booking requests', ar: 'طلبات حجز المجموعات' },
        description: {
          en: 'Traveler requests, group size, preferred dates, and contact follow-up.',
          ar: 'طلبات المسافرين وحجم المجموعة والتواريخ المفضلة ومتابعة التواصل.'
        },
        emptyTitle: { en: 'No group requests yet', ar: 'لا توجد طلبات مجموعات بعد' },
        emptyDescription: {
          en: 'Group requests connected to your travel packages will appear here.',
          ar: 'ستظهر هنا طلبات المجموعات المرتبطة بباقاتك.'
        },
        priority: 'high'
      },
      {
        key: 'package-payments',
        label: { en: 'Package payments', ar: 'مدفوعات الباقات' },
        description: {
          en: 'Payment status, receipts, checkout follow-up, and refund context.',
          ar: 'حالة الدفع والإيصالات ومتابعة الدفع وسياق الاسترداد.'
        },
        emptyTitle: { en: 'No package payments yet', ar: 'لا توجد مدفوعات باقات بعد' },
        emptyDescription: {
          en: 'Package payment records appear after paid requests begin.',
          ar: 'تظهر سجلات مدفوعات الباقات بعد بدء الطلبات المدفوعة.'
        },
        priority: 'high'
      },
      {
        key: 'supplier-documents',
        label: { en: 'Supplier / document readiness', ar: 'جاهزية الموردين والمستندات' },
        description: {
          en: 'Agency documents, supplier proof, package compliance, and trust readiness.',
          ar: 'مستندات الوكالة وإثباتات الموردين والامتثال وجاهزية الثقة.'
        },
        emptyTitle: { en: 'No document gaps detected', ar: 'لا توجد فجوات مستندات حالياً' },
        emptyDescription: {
          en: 'Document readiness helps the marketplace review and promote packages.',
          ar: 'جاهزية المستندات تساعد السوق على مراجعة الباقات والترويج لها.'
        },
        priority: 'high'
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Destination imagery, package visuals, proof media, and trust-building presentation.',
          ar: 'صور الوجهات ووسائط الباقات وإثباتات العرض وبناء الثقة.'
        },
        emptyTitle: { en: 'No media issues detected', ar: 'لا توجد مشاكل وسائط حالياً' },
        emptyDescription: {
          en: 'Media guidance appears when packages need stronger visual confidence.',
          ar: 'تظهر إرشادات الوسائط عندما تحتاج الباقات إلى ثقة بصرية أقوى.'
        },
        priority: 'medium'
      },
      sharedNotificationsTab
    ],
    readiness: [sharedVerificationReadiness, sharedMediaReadiness]
  },

  developer: {
    persona: 'developer',
    hero: {
      eyebrow: { en: 'Developer company workspace', ar: 'مساحة شركة التطوير' },
      title: {
        en: 'Manage projects, units, investor leads, documents, and launch readiness.',
        ar: 'أدر المشاريع والوحدات والعملاء المستثمرين والمستندات وجاهزية الإطلاق.'
      },
      description: {
        en: 'A dedicated command center for development companies. No activity tools, no generic provider clutter — only project, unit, trust, and investor workflows.',
        ar: 'مركز مخصص لشركات التطوير. بدون أدوات أنشطة أو فوضى مزودين — فقط المشاريع والوحدات والثقة ومسارات المستثمرين.'
      }
    },
    primaryActions: [
      {
        key: 'manage-projects',
        to: '/dashboard',
        label: { en: 'Manage projects', ar: 'إدارة المشاريع' },
        helper: {
          en: 'Prepare developer profile, project inventory, units, and launch state.',
          ar: 'جهّز ملف المطور ومخزون المشاريع والوحدات وحالة الإطلاق.'
        }
      },
      {
        key: 'complete-verification',
        to: '/dashboard',
        label: { en: 'Review documents', ar: 'مراجعة المستندات' },
        helper: {
          en: 'Track company, project, and approval documentation.',
          ar: 'تابع مستندات الشركة والمشروع والموافقات.'
        }
      }
    ],
    metrics: [
      {
        key: 'projects',
        label: { en: 'Projects', ar: 'المشاريع' },
        helper: { en: 'Development portfolio', ar: 'محفظة التطوير' }
      },
      {
        key: 'units',
        label: { en: 'Units', ar: 'الوحدات' },
        helper: { en: 'Inventory, pricing, and handover status', ar: 'المخزون والتسعير وحالة التسليم' }
      },
      {
        key: 'leads',
        label: { en: 'Investor leads', ar: 'عملاء المستثمرين' },
        helper: { en: 'Buyer and investor demand', ar: 'طلب المشترين والمستثمرين' }
      },
      {
        key: 'documents',
        label: { en: 'Documents', ar: 'المستندات' },
        helper: { en: 'Company and project readiness', ar: 'جاهزية الشركة والمشروع' }
      }
    ],
    tabs: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Project readiness, investor interest, document gaps, and launch actions.',
          ar: 'جاهزية المشاريع واهتمام المستثمرين وفجوات المستندات وإجراءات الإطلاق.'
        },
        emptyTitle: { en: 'Your developer workspace is ready', ar: 'مساحة المطور جاهزة' },
        emptyDescription: {
          en: 'Prepare profile, projects, units, documents, and launch readiness.',
          ar: 'جهّز الملف والمشاريع والوحدات والمستندات وجاهزية الإطلاق.'
        },
        priority: 'critical'
      },
      {
        key: 'developer-profile',
        label: { en: 'Developer profile', ar: 'ملف المطور' },
        description: {
          en: 'Company identity, public profile, trust story, and contact readiness.',
          ar: 'هوية الشركة والملف العام وقصة الثقة وجاهزية التواصل.'
        },
        emptyTitle: { en: 'Developer profile needs setup', ar: 'ملف المطور يحتاج إعداداً' },
        emptyDescription: {
          en: 'A strong developer profile builds investor confidence.',
          ar: 'ملف مطور قوي يبني ثقة المستثمرين.'
        },
        priority: 'critical'
      },
      {
        key: 'projects-developments',
        label: { en: 'Projects / developments', ar: 'المشاريع / التطويرات' },
        description: {
          en: 'Project portfolio, locations, launch state, price ranges, and public readiness.',
          ar: 'محفظة المشاريع والمواقع وحالة الإطلاق ونطاقات الأسعار وجاهزية العرض.'
        },
        emptyTitle: { en: 'No projects yet', ar: 'لا توجد مشاريع بعد' },
        emptyDescription: {
          en: 'Project inventory will power developer discovery and investor demand.',
          ar: 'مخزون المشاريع سيدعم اكتشاف المطور وطلب المستثمرين.'
        },
        priority: 'critical'
      },
      {
        key: 'units-inventory',
        label: { en: 'Units inventory', ar: 'مخزون الوحدات' },
        description: {
          en: 'Available units, floor plans, eligibility, prices, and handover dates.',
          ar: 'الوحدات المتاحة والمخططات والأهلية والأسعار ومواعيد التسليم.'
        },
        emptyTitle: { en: 'No units configured yet', ar: 'لم يتم إعداد الوحدات بعد' },
        emptyDescription: {
          en: 'Unit-level detail helps buyers and investors compare opportunities.',
          ar: 'تفاصيل الوحدات تساعد المشترين والمستثمرين على مقارنة الفرص.'
        },
        priority: 'high'
      },
      {
        key: 'launch-readiness',
        label: { en: 'Project launch readiness', ar: 'جاهزية إطلاق المشروع' },
        description: {
          en: 'Missing media, documents, unit data, pricing, and approval requirements.',
          ar: 'الوسائط والمستندات وبيانات الوحدات والتسعير ومتطلبات الموافقة الناقصة.'
        },
        emptyTitle: { en: 'Launch readiness not started', ar: 'لم تبدأ جاهزية الإطلاق بعد' },
        emptyDescription: {
          en: 'Use readiness checks before publishing major projects.',
          ar: 'استخدم فحوصات الجاهزية قبل نشر المشاريع الكبيرة.'
        },
        priority: 'high'
      },
      {
        key: 'buyer-investor-leads',
        label: { en: 'Buyer / investor leads', ar: 'عملاء الشراء / الاستثمار' },
        description: {
          en: 'Investor interest, buyer inquiries, eligibility signals, and sales follow-up.',
          ar: 'اهتمام المستثمرين واستفسارات المشترين ومؤشرات الأهلية ومتابعة البيع.'
        },
        emptyTitle: { en: 'No investor leads yet', ar: 'لا يوجد عملاء مستثمرون بعد' },
        emptyDescription: {
          en: 'Investor leads appear as projects gain visibility.',
          ar: 'يظهر العملاء المستثمرون مع زيادة ظهور المشاريع.'
        },
        priority: 'high'
      },
      {
        key: 'documents-verification',
        label: { en: 'Documents / verification', ar: 'المستندات / التحقق' },
        description: {
          en: 'Company documents, project approvals, verification state, and trust requirements.',
          ar: 'مستندات الشركة وموافقات المشاريع وحالة التحقق ومتطلبات الثقة.'
        },
        emptyTitle: { en: 'No documents submitted yet', ar: 'لم يتم تقديم مستندات بعد' },
        emptyDescription: {
          en: 'Documents help admin review, approve, and promote developer projects.',
          ar: 'المستندات تساعد الإدارة على مراجعة واعتماد وترويج مشاريع المطور.'
        },
        priority: 'high'
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Project imagery, renders, plans, gallery coverage, and visual confidence.',
          ar: 'صور المشاريع والرندرات والمخططات وتغطية المعرض والثقة البصرية.'
        },
        emptyTitle: { en: 'No media quality gaps detected', ar: 'لا توجد فجوات جودة وسائط حالياً' },
        emptyDescription: {
          en: 'Project visuals and plans should be complete before launch.',
          ar: 'يجب اكتمال صور ومخططات المشروع قبل الإطلاق.'
        },
        priority: 'medium'
      },
      {
        key: 'market-insights',
        label: { en: 'Market insights', ar: 'رؤى السوق' },
        description: {
          en: 'Demand context, pricing comparison, buyer signals, and investor positioning.',
          ar: 'سياق الطلب ومقارنة الأسعار ومؤشرات المشترين وتموضع المستثمرين.'
        },
        emptyTitle: { en: 'Market signals are building', ar: 'يتم بناء مؤشرات السوق' },
        emptyDescription: {
          en: 'Insights become stronger as projects and demand grow.',
          ar: 'تصبح الرؤى أقوى مع نمو المشاريع والطلب.'
        },
        priority: 'medium'
      },
      sharedNotificationsTab
    ],
    readiness: [sharedVerificationReadiness, sharedMediaReadiness]
  },

  admin: {
    persona: 'admin',
    hero: {
      eyebrow: { en: 'Marketplace operations cockpit', ar: 'مركز عمليات السوق' },
      title: {
        en: 'Review approvals, trust, media, bookings, payments, users, and system health.',
        ar: 'راجع الموافقات والثقة والوسائط والحجوزات والمدفوعات والمستخدمين وصحة النظام.'
      },
      description: {
        en: 'The admin dashboard should route operators into the dedicated admin cockpit, not mix admin tools into customer workspaces.',
        ar: 'يجب أن يوجه داشبورد الإدارة الفريق إلى مركز الإدارة المخصص بدون خلط أدوات الإدارة بمساحات العملاء.'
      }
    },
    primaryActions: [
      {
        key: 'open-admin',
        to: '/admin',
        label: { en: 'Open admin cockpit', ar: 'فتح مركز الإدارة' },
        helper: {
          en: 'Manage approvals, trust, media quality, finance, users, and system health.',
          ar: 'إدارة الموافقات والثقة وجودة الوسائط والمالية والمستخدمين وصحة النظام.'
        }
      }
    ],
    metrics: [
      {
        key: 'documents',
        label: { en: 'Approvals', ar: 'الموافقات' },
        helper: { en: 'Publishing and verification queues', ar: 'قوائم النشر والتحقق' }
      },
      {
        key: 'media',
        label: { en: 'Media review', ar: 'مراجعة الوسائط' },
        helper: { en: 'Quality and enhancement queue', ar: 'قائمة الجودة والتحسين' }
      },
      {
        key: 'payments',
        label: { en: 'Finance', ar: 'المالية' },
        helper: { en: 'Payments, refunds, payouts, and ledger', ar: 'المدفوعات والاستردادات والتحويلات والسجل' }
      },
      {
        key: 'notifications',
        label: { en: 'System health', ar: 'صحة النظام' },
        helper: { en: 'Email, security, and operations health', ar: 'صحة البريد والأمان والعمليات' }
      }
    ],
    tabs: [
      {
        key: 'admin-operations',
        label: { en: 'Admin operations', ar: 'عمليات الإدارة' },
        description: {
          en: 'Approvals, publishing, media quality, bookings, payments, trust, users, partners, and system health.',
          ar: 'الموافقات والنشر وجودة الوسائط والحجوزات والمدفوعات والثقة والمستخدمون والشركاء وصحة النظام.'
        },
        emptyTitle: { en: 'Admin cockpit is ready', ar: 'مركز الإدارة جاهز' },
        emptyDescription: {
          en: 'Use the dedicated admin cockpit for marketplace operations.',
          ar: 'استخدم مركز الإدارة المخصص لعمليات السوق.'
        },
        priority: 'critical'
      }
    ],
    readiness: []
  }
} satisfies Record<MarketplacePersona, PersonaDashboardDefinition>;

function localizeText(text: LocalizedText, language: DashboardContentLanguage) {
  return text[language];
}

export function getPersonaDashboardDefinition(role?: UserRole | string | null) {
  return personaDashboardDefinitions[getMarketplacePersona(role)];
}

export function getPersonaDashboardContent(
  role?: UserRole | string | null,
  language: DashboardContentLanguage = 'en'
): LocalizedPersonaDashboardDefinition {
  const definition = getPersonaDashboardDefinition(role);

  return {
    persona: definition.persona,
    hero: {
      eyebrow: localizeText(definition.hero.eyebrow, language),
      title: localizeText(definition.hero.title, language),
      description: localizeText(definition.hero.description, language)
    },
    primaryActions: definition.primaryActions.map((action) => ({
      ...action,
      text: localizeText(action.label, language),
      helperText: localizeText(action.helper, language)
    })),
    metrics: definition.metrics.map((metric) => ({
      ...metric,
      text: localizeText(metric.label, language),
      helperText: localizeText(metric.helper, language)
    })),
    tabs: definition.tabs.map((tab) => ({
      ...tab,
      text: localizeText(tab.label, language),
      helperText: localizeText(tab.description, language),
      emptyStateTitle: localizeText(tab.emptyTitle, language),
      emptyStateDescription: localizeText(tab.emptyDescription, language)
    })),
    readiness: definition.readiness.map((item) => ({
      ...item,
      text: localizeText(item.label, language),
      helperText: localizeText(item.description, language)
    }))
  };
}

export function getPersonaDashboardTabs(
  role?: UserRole | string | null,
  language: DashboardContentLanguage = 'en'
) {
  return getPersonaDashboardContent(role, language).tabs;
}

export function getPersonaDashboardPrimaryActions(
  role?: UserRole | string | null,
  language: DashboardContentLanguage = 'en'
) {
  return getPersonaDashboardContent(role, language).primaryActions;
}
