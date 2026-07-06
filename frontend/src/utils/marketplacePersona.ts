import type { UserRole } from '../types';

export type MarketplacePersona =
  | 'customer'
  | 'owner'
  | 'activityProvider'
  | 'travelAgency'
  | 'developer'
  | 'admin';

export type MarketplaceWorkspaceKey =
  | 'overview'
  | 'my-bookings'
  | 'payments-receipts'
  | 'saved-alerts'
  | 'valuations'
  | 'transactions'
  | 'contracts-rent'
  | 'notifications'
  | 'account-readiness'
  | 'listings-command'
  | 'lead-inbox'
  | 'viewing-requests'
  | 'media-quality'
  | 'verification'
  | 'performance'
  | 'activities-command'
  | 'booking-requests'
  | 'schedule-capacity'
  | 'reviews-trust'
  | 'travel-packages'
  | 'itineraries'
  | 'group-bookings'
  | 'package-payments'
  | 'supplier-documents'
  | 'developer-profile'
  | 'projects-developments'
  | 'units-inventory'
  | 'launch-readiness'
  | 'buyer-investor-leads'
  | 'documents-verification'
  | 'market-insights'
  | 'admin-operations';

export type MarketplacePersonaCapability = {
  canUseCustomerTools: boolean;
  canManageListings: boolean;
  canManageActivities: boolean;
  canManageTravelPackages: boolean;
  canManageDeveloperProjects: boolean;
  canReviewBookingRequests: boolean;
  canUseMediaQuality: boolean;
  canUseVerification: boolean;
  canUsePerformance: boolean;
  canAccessAdmin: boolean;
};

export type MarketplaceWorkspaceDefinition = {
  key: MarketplaceWorkspaceKey;
  label: {
    en: string;
    ar: string;
  };
  description: {
    en: string;
    ar: string;
  };
};

export type MarketplacePersonaDefinition = {
  persona: MarketplacePersona;
  label: {
    en: string;
    ar: string;
  };
  description: {
    en: string;
    ar: string;
  };
  primaryAction: {
    en: string;
    ar: string;
  };
  capabilities: MarketplacePersonaCapability;
  workspaces: MarketplaceWorkspaceDefinition[];
};

const sharedPersonalWorkspaces: MarketplaceWorkspaceDefinition[] = [
  {
    key: 'my-bookings',
    label: { en: 'My bookings', ar: 'حجوزاتي' },
    description: {
      en: 'Track personal booking requests, payment state, receipts, and cancellation flow.',
      ar: 'متابعة طلبات الحجز الشخصية، حالة الدفع، الإيصالات، وطلبات الإلغاء.'
    }
  },
  {
    key: 'payments-receipts',
    label: { en: 'Payments & receipts', ar: 'المدفوعات والإيصالات' },
    description: {
      en: 'Review pending payments, completed payments, and booking receipts.',
      ar: 'مراجعة المدفوعات المعلقة والمكتملة وإيصالات الحجوزات.'
    }
  },
  {
    key: 'notifications',
    label: { en: 'Notifications', ar: 'التنبيهات' },
    description: {
      en: 'Follow booking, publishing, payment, verification, and trust updates.',
      ar: 'متابعة تحديثات الحجز والنشر والدفع والتحقق والثقة.'
    }
  }
];

const marketplacePersonaDefinitions: Record<MarketplacePersona, MarketplacePersonaDefinition> = {
  customer: {
    persona: 'customer',
    label: { en: 'Customer workspace', ar: 'مساحة العميل' },
    description: {
      en: 'For buyers, renters, travelers, and investors managing requests, saved opportunities, payments, and alerts.',
      ar: 'للمشترين والمستأجرين والمسافرين والمستثمرين لإدارة الطلبات والفرص المحفوظة والمدفوعات والتنبيهات.'
    },
    primaryAction: { en: 'Explore marketplace', ar: 'استكشاف السوق' },
    capabilities: {
      canUseCustomerTools: true,
      canManageListings: false,
      canManageActivities: false,
      canManageTravelPackages: false,
      canManageDeveloperProjects: false,
      canReviewBookingRequests: false,
      canUseMediaQuality: false,
      canUseVerification: false,
      canUsePerformance: false,
      canAccessAdmin: false
    },
    workspaces: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Personal account readiness, recent requests, alerts, and next actions.',
          ar: 'جاهزية الحساب، الطلبات الأخيرة، التنبيهات، والخطوات التالية.'
        }
      },
      ...sharedPersonalWorkspaces,
      {
        key: 'saved-alerts',
        label: { en: 'Saved & alerts', ar: 'المحفوظات والتنبيهات' },
        description: {
          en: 'Saved listings, saved activities, watchlists, and alert preferences.',
          ar: 'العقارات والأنشطة المحفوظة وقوائم المتابعة وتفضيلات التنبيهات.'
        }
      },
      {
        key: 'valuations',
        label: { en: 'Valuations', ar: 'التقييمات' },
        description: {
          en: 'Property valuation requests and investor-readiness tools.',
          ar: 'طلبات تقييم العقارات وأدوات جاهزية المستثمر.'
        }
      },
      {
        key: 'transactions',
        label: { en: 'Transactions', ar: 'المعاملات' },
        description: {
          en: 'Marketplace transactions connected to the account.',
          ar: 'المعاملات المرتبطة بالحساب داخل السوق.'
        }
      },
      {
        key: 'contracts-rent',
        label: { en: 'Contracts & rent', ar: 'العقود والإيجار' },
        description: {
          en: 'Rental contracts, rent schedule, and payment milestones when relevant.',
          ar: 'عقود الإيجار وجدولة الدفعات والمراحل المالية عند الحاجة.'
        }
      },
      {
        key: 'account-readiness',
        label: { en: 'Account readiness', ar: 'جاهزية الحساب' },
        description: {
          en: 'Profile, verification, email status, and trust readiness.',
          ar: 'الملف الشخصي والتحقق وحالة البريد وجاهزية الثقة.'
        }
      }
    ]
  },
  owner: {
    persona: 'owner',
    label: { en: 'Owner / agent workspace', ar: 'مساحة المالك / الوسيط' },
    description: {
      en: 'For real-estate owners and agents managing listings, leads, verification, contracts, and performance.',
      ar: 'للمالكين والوسطاء لإدارة العقارات والعملاء المحتملين والتحقق والعقود والأداء.'
    },
    primaryAction: { en: 'Add listing', ar: 'إضافة عقار' },
    capabilities: {
      canUseCustomerTools: true,
      canManageListings: true,
      canManageActivities: false,
      canManageTravelPackages: false,
      canManageDeveloperProjects: false,
      canReviewBookingRequests: true,
      canUseMediaQuality: true,
      canUseVerification: true,
      canUsePerformance: true,
      canAccessAdmin: false
    },
    workspaces: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Portfolio health, urgent actions, pending approvals, and lead activity.',
          ar: 'صحة المحفظة والإجراءات العاجلة والموافقات المعلقة ونشاط العملاء.'
        }
      },
      {
        key: 'listings-command',
        label: { en: 'Listings command center', ar: 'مركز إدارة العقارات' },
        description: {
          en: 'Manage listing status, required edits, publishing readiness, and pricing.',
          ar: 'إدارة حالة العقارات والتعديلات المطلوبة وجاهزية النشر والتسعير.'
        }
      },
      {
        key: 'lead-inbox',
        label: { en: 'Lead inbox', ar: 'صندوق العملاء المحتملين' },
        description: {
          en: 'Property inquiries, viewing interest, buyer/renter follow-up, and contact actions.',
          ar: 'استفسارات العقارات واهتمام الزيارة ومتابعة المشترين والمستأجرين وإجراءات التواصل.'
        }
      },
      {
        key: 'viewing-requests',
        label: { en: 'Viewing / booking requests', ar: 'طلبات الزيارة / الحجز' },
        description: {
          en: 'Requests that need review, approval, rejection, or scheduling follow-up.',
          ar: 'الطلبات التي تحتاج مراجعة أو قبول أو رفض أو متابعة جدولة.'
        }
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Image coverage, visual quality, missing media, and listing presentation gaps.',
          ar: 'تغطية الصور وجودتها والوسائط الناقصة وفجوات عرض العقار.'
        }
      },
      {
        key: 'verification',
        label: { en: 'Verification', ar: 'التحقق' },
        description: {
          en: 'Ownership documents, verification requests, and trust status.',
          ar: 'مستندات الملكية وطلبات التحقق وحالة الثقة.'
        }
      },
      {
        key: 'contracts-rent',
        label: { en: 'Contracts & rent', ar: 'العقود والإيجار' },
        description: {
          en: 'Rental contract drafts, rent schedules, receipts, and milestones.',
          ar: 'مسودات عقود الإيجار وجداول الدفعات والإيصالات والمراحل.'
        }
      },
      {
        key: 'transactions',
        label: { en: 'Transactions', ar: 'المعاملات' },
        description: {
          en: 'Marketplace transaction progress and counterparties.',
          ar: 'تقدم المعاملات داخل السوق والأطراف المرتبطة بها.'
        }
      },
      {
        key: 'performance',
        label: { en: 'Performance', ar: 'الأداء' },
        description: {
          en: 'Listing visibility, inquiries, booking pressure, and conversion signals.',
          ar: 'ظهور العقارات والاستفسارات وضغط الحجوزات ومؤشرات التحويل.'
        }
      },
      {
        key: 'notifications',
        label: { en: 'Notifications', ar: 'التنبيهات' },
        description: {
          en: 'Publishing, inquiry, booking, verification, and trust updates.',
          ar: 'تحديثات النشر والاستفسارات والحجز والتحقق والثقة.'
        }
      }
    ]
  },
  activityProvider: {
    persona: 'activityProvider',
    label: { en: 'Activity provider workspace', ar: 'مساحة مزود الأنشطة' },
    description: {
      en: 'For local activity providers managing experiences, capacity, bookings, payments, reviews, and media.',
      ar: 'لمزودي الأنشطة المحليين لإدارة التجارب والسعة والحجوزات والمدفوعات والمراجعات والوسائط.'
    },
    primaryAction: { en: 'Add activity', ar: 'إضافة نشاط' },
    capabilities: {
      canUseCustomerTools: true,
      canManageListings: false,
      canManageActivities: true,
      canManageTravelPackages: false,
      canManageDeveloperProjects: false,
      canReviewBookingRequests: true,
      canUseMediaQuality: true,
      canUseVerification: true,
      canUsePerformance: true,
      canAccessAdmin: false
    },
    workspaces: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Activity health, booking pressure, urgent requests, and readiness signals.',
          ar: 'صحة الأنشطة وضغط الحجوزات والطلبات العاجلة ومؤشرات الجاهزية.'
        }
      },
      {
        key: 'activities-command',
        label: { en: 'Activities command center', ar: 'مركز إدارة الأنشطة' },
        description: {
          en: 'Manage experiences, status, pricing, location, highlights, and publishing readiness.',
          ar: 'إدارة التجارب والحالة والتسعير والموقع والمميزات وجاهزية النشر.'
        }
      },
      {
        key: 'booking-requests',
        label: { en: 'Booking requests', ar: 'طلبات الحجز' },
        description: {
          en: 'Approve, reject, or follow up on received activity bookings.',
          ar: 'قبول أو رفض أو متابعة حجوزات الأنشطة المستلمة.'
        }
      },
      {
        key: 'schedule-capacity',
        label: { en: 'Schedule & capacity', ar: 'الجدولة والسعة' },
        description: {
          en: 'Capacity pressure by date, preferred times, guest counts, and availability.',
          ar: 'ضغط السعة حسب التاريخ والأوقات المفضلة وعدد الضيوف والتوفر.'
        }
      },
      {
        key: 'payments-receipts',
        label: { en: 'Payments & receipts', ar: 'المدفوعات والإيصالات' },
        description: {
          en: 'Paid, pending, and failed activity booking payments.',
          ar: 'مدفوعات حجوزات الأنشطة المدفوعة والمعلقة والفاشلة.'
        }
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Image quality, missing highlights, and activity presentation gaps.',
          ar: 'جودة الصور والمميزات الناقصة وفجوات عرض النشاط.'
        }
      },
      {
        key: 'reviews-trust',
        label: { en: 'Reviews & trust', ar: 'المراجعات والثقة' },
        description: {
          en: 'Reviews, reports, and provider trust signals.',
          ar: 'المراجعات والبلاغات ومؤشرات ثقة المزود.'
        }
      },
      {
        key: 'verification',
        label: { en: 'Verification', ar: 'التحقق' },
        description: {
          en: 'Provider documents, verification requests, and trust readiness.',
          ar: 'مستندات المزود وطلبات التحقق وجاهزية الثقة.'
        }
      },
      {
        key: 'performance',
        label: { en: 'Performance', ar: 'الأداء' },
        description: {
          en: 'Activity visibility, booking conversion, and demand signals.',
          ar: 'ظهور الأنشطة وتحويل الحجوزات ومؤشرات الطلب.'
        }
      },
      {
        key: 'notifications',
        label: { en: 'Notifications', ar: 'التنبيهات' },
        description: {
          en: 'Booking, payment, publishing, review, and trust updates.',
          ar: 'تحديثات الحجز والدفع والنشر والمراجعات والثقة.'
        }
      }
    ]
  },
  travelAgency: {
    persona: 'travelAgency',
    label: { en: 'Travel agency workspace', ar: 'مساحة وكالة السفر' },
    description: {
      en: 'For agencies managing outside-Oman packages, itineraries, group requests, suppliers, documents, and payments.',
      ar: 'لوكالات السفر لإدارة باقات خارج عمان والبرامج وطلبات المجموعات والموردين والمستندات والمدفوعات.'
    },
    primaryAction: { en: 'Add travel package', ar: 'إضافة باقة سفر' },
    capabilities: {
      canUseCustomerTools: true,
      canManageListings: false,
      canManageActivities: true,
      canManageTravelPackages: true,
      canManageDeveloperProjects: false,
      canReviewBookingRequests: true,
      canUseMediaQuality: true,
      canUseVerification: true,
      canUsePerformance: true,
      canAccessAdmin: false
    },
    workspaces: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Package health, booking pressure, missing travel details, and urgent actions.',
          ar: 'صحة الباقات وضغط الحجوزات وتفاصيل السفر الناقصة والإجراءات العاجلة.'
        }
      },
      {
        key: 'travel-packages',
        label: { en: 'Travel packages', ar: 'باقات السفر' },
        description: {
          en: 'Outside-Oman packages, pricing, regions, inclusions, and publishing state.',
          ar: 'باقات خارج عمان والتسعير والمناطق والمشتملات وحالة النشر.'
        }
      },
      {
        key: 'itineraries',
        label: { en: 'Itineraries', ar: 'برامج الرحلات' },
        description: {
          en: 'Flight, hotel, transfer, destination, and package-day structure.',
          ar: 'الرحلات والفنادق والتنقلات والوجهات وهيكل أيام الباقة.'
        }
      },
      {
        key: 'group-bookings',
        label: { en: 'Group booking requests', ar: 'طلبات حجز المجموعات' },
        description: {
          en: 'Traveler requests, guest counts, preferred dates, and follow-up actions.',
          ar: 'طلبات المسافرين وعدد الضيوف والتواريخ المفضلة وإجراءات المتابعة.'
        }
      },
      {
        key: 'package-payments',
        label: { en: 'Package payments', ar: 'مدفوعات الباقات' },
        description: {
          en: 'Travel package payment status, receipts, and checkout follow-up.',
          ar: 'حالة مدفوعات باقات السفر والإيصالات ومتابعة الدفع.'
        }
      },
      {
        key: 'supplier-documents',
        label: { en: 'Supplier / document readiness', ar: 'جاهزية الموردين والمستندات' },
        description: {
          en: 'Agency documents, supplier information, proof requirements, and compliance readiness.',
          ar: 'مستندات الوكالة ومعلومات الموردين ومتطلبات الإثبات والجاهزية التنظيمية.'
        }
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Destination imagery, package photos, and trust-building visuals.',
          ar: 'صور الوجهات والباقات والوسائط التي تبني الثقة.'
        }
      },
      {
        key: 'reviews-trust',
        label: { en: 'Reviews & trust', ar: 'المراجعات والثقة' },
        description: {
          en: 'Agency reviews, reports, trust signals, and customer confidence.',
          ar: 'مراجعات الوكالة والبلاغات ومؤشرات الثقة وطمأنة العملاء.'
        }
      },
      {
        key: 'notifications',
        label: { en: 'Notifications', ar: 'التنبيهات' },
        description: {
          en: 'Booking, payment, package, document, and trust updates.',
          ar: 'تحديثات الحجز والدفع والباقات والمستندات والثقة.'
        }
      }
    ]
  },
  developer: {
    persona: 'developer',
    label: { en: 'Developer company workspace', ar: 'مساحة شركة التطوير' },
    description: {
      en: 'For development companies managing projects, units, launch readiness, investor leads, documents, and market signals.',
      ar: 'لشركات التطوير لإدارة المشاريع والوحدات وجاهزية الإطلاق والعملاء المستثمرين والمستندات ومؤشرات السوق.'
    },
    primaryAction: { en: 'Manage projects', ar: 'إدارة المشاريع' },
    capabilities: {
      canUseCustomerTools: false,
      canManageListings: false,
      canManageActivities: false,
      canManageTravelPackages: false,
      canManageDeveloperProjects: true,
      canReviewBookingRequests: false,
      canUseMediaQuality: true,
      canUseVerification: true,
      canUsePerformance: true,
      canAccessAdmin: false
    },
    workspaces: [
      {
        key: 'overview',
        label: { en: 'Overview', ar: 'نظرة عامة' },
        description: {
          en: 'Project readiness, investor interest, missing documents, and launch actions.',
          ar: 'جاهزية المشاريع واهتمام المستثمرين والمستندات الناقصة وإجراءات الإطلاق.'
        }
      },
      {
        key: 'developer-profile',
        label: { en: 'Developer profile', ar: 'ملف المطور' },
        description: {
          en: 'Company identity, trust profile, public developer details, and contact readiness.',
          ar: 'هوية الشركة وملف الثقة وبيانات المطور العامة وجاهزية التواصل.'
        }
      },
      {
        key: 'projects-developments',
        label: { en: 'Projects / developments', ar: 'المشاريع / التطويرات' },
        description: {
          en: 'Project portfolio, launch state, locations, price ranges, and publishing readiness.',
          ar: 'محفظة المشاريع وحالة الإطلاق والمواقع ونطاقات الأسعار وجاهزية النشر.'
        }
      },
      {
        key: 'units-inventory',
        label: { en: 'Units inventory', ar: 'مخزون الوحدات' },
        description: {
          en: 'Available units, buyer eligibility, floor plans, handover dates, and pricing.',
          ar: 'الوحدات المتاحة وأهلية المشترين والمخططات ومواعيد التسليم والتسعير.'
        }
      },
      {
        key: 'launch-readiness',
        label: { en: 'Project launch readiness', ar: 'جاهزية إطلاق المشروع' },
        description: {
          en: 'Missing media, documents, unit data, pricing, and approval requirements before launch.',
          ar: 'الوسائط والمستندات وبيانات الوحدات والتسعير ومتطلبات الموافقة قبل الإطلاق.'
        }
      },
      {
        key: 'buyer-investor-leads',
        label: { en: 'Buyer / investor leads', ar: 'عملاء الشراء / الاستثمار' },
        description: {
          en: 'Investor interest, buyer inquiries, eligibility signals, and sales follow-up.',
          ar: 'اهتمام المستثمرين واستفسارات المشترين ومؤشرات الأهلية ومتابعة البيع.'
        }
      },
      {
        key: 'documents-verification',
        label: { en: 'Documents / verification', ar: 'المستندات / التحقق' },
        description: {
          en: 'Company documents, project approvals, verification state, and trust requirements.',
          ar: 'مستندات الشركة وموافقات المشاريع وحالة التحقق ومتطلبات الثقة.'
        }
      },
      {
        key: 'media-quality',
        label: { en: 'Media quality', ar: 'جودة الوسائط' },
        description: {
          en: 'Project imagery, renders, plans, gallery coverage, and visual quality.',
          ar: 'صور المشاريع والرندرات والمخططات وتغطية المعرض والجودة البصرية.'
        }
      },
      {
        key: 'market-insights',
        label: { en: 'Market insights', ar: 'رؤى السوق' },
        description: {
          en: 'Market signals, demand context, pricing comparison, and investor positioning.',
          ar: 'مؤشرات السوق وسياق الطلب ومقارنة الأسعار وتموضع المستثمرين.'
        }
      },
      {
        key: 'transactions',
        label: { en: 'Transactions', ar: 'المعاملات' },
        description: {
          en: 'Buyer/investor transaction progress connected to projects or units.',
          ar: 'تقدم معاملات المشترين والمستثمرين المرتبطة بالمشاريع أو الوحدات.'
        }
      },
      {
        key: 'notifications',
        label: { en: 'Notifications', ar: 'التنبيهات' },
        description: {
          en: 'Project, lead, verification, document, and marketplace updates.',
          ar: 'تحديثات المشاريع والعملاء والتحقق والمستندات والسوق.'
        }
      }
    ]
  },
  admin: {
    persona: 'admin',
    label: { en: 'Admin operations cockpit', ar: 'مركز عمليات الإدارة' },
    description: {
      en: 'For marketplace operators managing approvals, publishing, media review, trust, payments, bookings, and system health.',
      ar: 'لفريق إدارة السوق لإدارة الموافقات والنشر ومراجعة الوسائط والثقة والمدفوعات والحجوزات وصحة النظام.'
    },
    primaryAction: { en: 'Open admin cockpit', ar: 'فتح مركز الإدارة' },
    capabilities: {
      canUseCustomerTools: false,
      canManageListings: true,
      canManageActivities: true,
      canManageTravelPackages: true,
      canManageDeveloperProjects: true,
      canReviewBookingRequests: true,
      canUseMediaQuality: true,
      canUseVerification: true,
      canUsePerformance: true,
      canAccessAdmin: true
    },
    workspaces: [
      {
        key: 'admin-operations',
        label: { en: 'Admin operations', ar: 'عمليات الإدارة' },
        description: {
          en: 'Approvals, media quality review, bookings, payments, trust, users, partners, and system health.',
          ar: 'الموافقات ومراجعة جودة الوسائط والحجوزات والمدفوعات والثقة والمستخدمون والشركاء وصحة النظام.'
        }
      }
    ]
  }
};

export function getMarketplacePersona(role?: UserRole | string | null): MarketplacePersona {
  if (role === 'ADMIN') return 'admin';
  if (role === 'DEVELOPER') return 'developer';
  if (role === 'TRAVEL_AGENCY') return 'travelAgency';
  if (role === 'ACTIVITY_PROVIDER') return 'activityProvider';
  if (role === 'OWNER') return 'owner';

  return 'customer';
}

export function getMarketplacePersonaDefinition(role?: UserRole | string | null) {
  return marketplacePersonaDefinitions[getMarketplacePersona(role)];
}

export function getMarketplacePersonaCapabilities(role?: UserRole | string | null) {
  return getMarketplacePersonaDefinition(role).capabilities;
}

export function getMarketplacePersonaWorkspaces(role?: UserRole | string | null) {
  return getMarketplacePersonaDefinition(role).workspaces;
}

export function getMarketplacePersonaLabel(role?: UserRole | string | null, language: 'en' | 'ar' = 'en') {
  return getMarketplacePersonaDefinition(role).label[language];
}

export function getMarketplacePersonaDescription(
  role?: UserRole | string | null,
  language: 'en' | 'ar' = 'en'
) {
  return getMarketplacePersonaDefinition(role).description[language];
}

export type MarketplacePersonaPrimaryAction = {
  key:
    | 'explore-marketplace'
    | 'saved-alerts'
    | 'my-bookings'
    | 'add-listing'
    | 'manage-listings'
    | 'add-activity'
    | 'booking-requests'
    | 'add-travel-package'
    | 'travel-packages'
    | 'add-project'
    | 'developer-profile'
    | 'units-inventory'
    | 'admin-cockpit'
    | 'admin-approvals';
  to: string;
  label: {
    en: string;
    ar: string;
  };
  description: {
    en: string;
    ar: string;
  };
};

const marketplacePersonaPrimaryActions: Record<MarketplacePersona, MarketplacePersonaPrimaryAction[]> = {
  customer: [
    {
      key: 'explore-marketplace',
      to: '/listings',
      label: { en: 'Explore marketplace', ar: 'استكشاف السوق' },
      description: {
        en: 'Browse listings, projects, activities, developers, travel agencies, and investor opportunities.',
        ar: 'تصفح العقارات والمشاريع والأنشطة والمطورين ووكالات السفر وفرص المستثمرين.'
      }
    },
    {
      key: 'saved-alerts',
      to: '/dashboard?workspace=saved-alerts',
      label: { en: 'Saved & alerts', ar: 'المحفوظات والتنبيهات' },
      description: {
        en: 'Return to saved opportunities, watchlists, and alerts.',
        ar: 'العودة للفرص المحفوظة وقوائم المتابعة والتنبيهات.'
      }
    },
    {
      key: 'my-bookings',
      to: '/dashboard?workspace=my-bookings',
      label: { en: 'My bookings', ar: 'حجوزاتي' },
      description: {
        en: 'Track booking requests, payment state, and receipts.',
        ar: 'متابعة طلبات الحجز وحالة الدفع والإيصالات.'
      }
    }
  ],
  owner: [
    {
      key: 'add-listing',
      to: '/add-listing',
      label: { en: 'Add listing', ar: 'إضافة عقار' },
      description: {
        en: 'Publish real-estate inventory with readiness guidance.',
        ar: 'نشر مخزون عقاري مع إرشادات الجاهزية.'
      }
    },
    {
      key: 'manage-listings',
      to: '/dashboard?workspace=listings-command',
      label: { en: 'Manage listings', ar: 'إدارة العقارات' },
      description: {
        en: 'Review listing status, leads, media, verification, and contracts.',
        ar: 'مراجعة حالة العقارات والعملاء والوسائط والتحقق والعقود.'
      }
    }
  ],
  activityProvider: [
    {
      key: 'add-activity',
      to: '/add-activity',
      label: { en: 'Add activity', ar: 'إضافة نشاط' },
      description: {
        en: 'Create local experiences with schedule, capacity, and media readiness.',
        ar: 'إنشاء تجارب محلية مع جاهزية الجدولة والسعة والوسائط.'
      }
    },
    {
      key: 'booking-requests',
      to: '/dashboard?workspace=booking-requests',
      label: { en: 'Booking requests', ar: 'طلبات الحجز' },
      description: {
        en: 'Approve, reject, or follow up on customer requests.',
        ar: 'قبول أو رفض أو متابعة طلبات العملاء.'
      }
    }
  ],
  travelAgency: [
    {
      key: 'add-travel-package',
      to: '/add-activity',
      label: { en: 'Add travel package', ar: 'إضافة باقة سفر' },
      description: {
        en: 'Create outside-Oman packages, itineraries, and group-ready offers.',
        ar: 'إنشاء باقات خارج عمان وبرامج وعروض جاهزة للمجموعات.'
      }
    },
    {
      key: 'travel-packages',
      to: '/dashboard?workspace=travel-packages',
      label: { en: 'Travel packages', ar: 'باقات السفر' },
      description: {
        en: 'Manage package readiness, documents, suppliers, and payments.',
        ar: 'إدارة جاهزية الباقات والمستندات والموردين والمدفوعات.'
      }
    }
  ],
  developer: [
    {
      key: 'add-project',
      to: '/add-project',
      label: { en: 'Add project', ar: 'إضافة مشروع' },
      description: {
        en: 'Create a development project with media, inventory, and launch readiness.',
        ar: 'إنشاء مشروع تطويري مع الوسائط والمخزون وجاهزية الإطلاق.'
      }
    },
    {
      key: 'developer-profile',
      to: '/dashboard?workspace=projects-developments',
      label: { en: 'Manage projects', ar: 'إدارة المشاريع' },
      description: {
        en: 'Manage developer profile, projects, documents, leads, and launch readiness.',
        ar: 'إدارة ملف المطور والمشاريع والمستندات والعملاء وجاهزية الإطلاق.'
      }
    },
    {
      key: 'units-inventory',
      to: '/dashboard?workspace=units-inventory',
      label: { en: 'Units inventory', ar: 'مخزون الوحدات' },
      description: {
        en: 'Connect approved units and inventory to public projects.',
        ar: 'ربط الوحدات والمخزون المعتمد بالمشاريع العامة.'
      }
    }
  ],
  admin: [
    {
      key: 'admin-cockpit',
      to: '/admin',
      label: { en: 'Admin cockpit', ar: 'مركز الإدارة' },
      description: {
        en: 'Review marketplace operations, approvals, trust, payments, users, and system health.',
        ar: 'مراجعة عمليات السوق والموافقات والثقة والمدفوعات والمستخدمين وصحة النظام.'
      }
    },
    {
      key: 'admin-approvals',
      to: '/admin?workspace=approvals',
      label: { en: 'Approvals', ar: 'الموافقات' },
      description: {
        en: 'Open publishing and verification approval queues.',
        ar: 'فتح قوائم موافقات النشر والتحقق.'
      }
    }
  ]
};

export function getMarketplacePersonaPrimaryActions(
  role?: UserRole | string | null,
  language: 'en' | 'ar' = 'en'
) {
  const actions = marketplacePersonaPrimaryActions[getMarketplacePersona(role)];

  return actions.map((action) => ({
    ...action,
    text: action.label[language],
    helper: action.description[language]
  }));
}
