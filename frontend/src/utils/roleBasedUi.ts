import type { UserRole } from '../types';
import { getMarketplacePersona } from './marketplacePersona';

export type RoleAwareAction = {
  key: string;
  to: string;
  label: string;
  description: string;
  intent: 'primary' | 'secondary' | 'soft';
};

export type RoleAwarePanel = {
  eyebrow: string;
  title: string;
  description: string;
  actions: RoleAwareAction[];
  checklist: string[];
};

export type RoleAwareLink = {
  key: string;
  to: string;
  label: string;
};

type Locale = 'en' | 'ar';

function localize<T>(language: Locale, en: T, ar: T) {
  return language === 'ar' ? ar : en;
}

export function getRoleAwareFooterCta(
  role?: UserRole | string | null,
  language: Locale = 'en',
  isAuthenticated = false
): RoleAwarePanel {
  const persona = getMarketplacePersona(role);

  if (!isAuthenticated) {
    return localize<RoleAwarePanel>(
      language,
      {
        eyebrow: 'Owners, providers, and developers',
        title: 'Bring premium opportunities to lux.om',
        description:
          'Create the right account type for your marketplace role: property owner, activity provider, travel agency, or developer company.',
        actions: [
          {
            key: 'join-owner',
            to: '/register?role=OWNER',
            label: 'List a property',
            description: 'Create an owner or agent account.',
            intent: 'primary'
          },
          {
            key: 'join-activity-provider',
            to: '/register?role=ACTIVITY_PROVIDER',
            label: 'List an activity',
            description: 'Create an activity provider account.',
            intent: 'secondary'
          },
          {
            key: 'join-travel-agency',
            to: '/register?role=TRAVEL_AGENCY',
            label: 'Join as travel agency',
            description: 'Manage travel packages and agency trust.',
            intent: 'secondary'
          },
          {
            key: 'join-developer',
            to: '/register?role=DEVELOPER',
            label: 'Partner as developer',
            description: 'Manage projects, units, and investor leads.',
            intent: 'secondary'
          }
        ],
        checklist: []
      },
      {
        eyebrow: 'للملاك والمزودين والمطورين',
        title: 'اعرض فرصك المميزة على lux.om',
        description:
          'أنشئ نوع الحساب المناسب لدورك في السوق: مالك عقار، مزود أنشطة، وكالة سفر، أو شركة تطوير.',
        actions: [
          {
            key: 'join-owner',
            to: '/register?role=OWNER',
            label: 'إدراج عقار',
            description: 'إنشاء حساب مالك أو وسيط.',
            intent: 'primary'
          },
          {
            key: 'join-activity-provider',
            to: '/register?role=ACTIVITY_PROVIDER',
            label: 'إدراج نشاط',
            description: 'إنشاء حساب مزود أنشطة.',
            intent: 'secondary'
          },
          {
            key: 'join-travel-agency',
            to: '/register?role=TRAVEL_AGENCY',
            label: 'انضم كوكالة سفر',
            description: 'إدارة باقات السفر وثقة الوكالة.',
            intent: 'secondary'
          },
          {
            key: 'join-developer',
            to: '/register?role=DEVELOPER',
            label: 'شراكة مطور عقاري',
            description: 'إدارة المشاريع والوحدات والعملاء المستثمرين.',
            intent: 'secondary'
          }
        ],
        checklist: []
      }
    );
  }

  if (persona === 'customer') {
    return localize<RoleAwarePanel>(
      language,
      {
        eyebrow: 'Your marketplace',
        title: 'Continue exploring, saving, booking, and tracking opportunities.',
        description:
          'Customer accounts focus on discovery, saved opportunities, booking requests, payments, and notifications — no provider tools mixed in.',
        actions: [
          {
            key: 'browse-listings',
            to: '/listings',
            label: 'Browse listings',
            description: 'Find properties and stays.',
            intent: 'primary'
          },
          {
            key: 'browse-activities',
            to: '/activities',
            label: 'Browse activities',
            description: 'Explore activities and packages.',
            intent: 'secondary'
          },
          {
            key: 'open-dashboard',
            to: '/dashboard?workspace=saved-alerts',
            label: 'Saved & alerts',
            description: 'Review saved opportunities.',
            intent: 'secondary'
          }
        ],
        checklist: []
      },
      {
        eyebrow: 'سوقك الشخصي',
        title: 'تابع التصفح والحفظ والحجز ومتابعة الفرص.',
        description:
          'حسابات العملاء مخصصة للاكتشاف والفرص المحفوظة وطلبات الحجز والمدفوعات والتنبيهات — بدون خلط أدوات المزودين.',
        actions: [
          {
            key: 'browse-listings',
            to: '/listings',
            label: 'تصفح العقارات',
            description: 'ابحث عن العقارات والإقامات.',
            intent: 'primary'
          },
          {
            key: 'browse-activities',
            to: '/activities',
            label: 'تصفح الأنشطة',
            description: 'استكشف الأنشطة والباقات.',
            intent: 'secondary'
          },
          {
            key: 'open-dashboard',
            to: '/dashboard?workspace=saved-alerts',
            label: 'المحفوظات والتنبيهات',
            description: 'راجع الفرص المحفوظة.',
            intent: 'secondary'
          }
        ],
        checklist: []
      }
    );
  }

  if (persona === 'owner') {
    return localize<RoleAwarePanel>(
      language,
      {
        eyebrow: 'Owner workspace',
        title: 'Manage real-estate inventory and lead readiness.',
        description:
          'Owner accounts should see property tools, verification, media quality, contracts, and booking or viewing requests.',
        actions: [
          {
            key: 'add-listing',
            to: '/add-listing',
            label: 'Add listing',
            description: 'Create a property listing.',
            intent: 'primary'
          },
          {
            key: 'manage-listings',
            to: '/dashboard?workspace=listings-command',
            label: 'Manage listings',
            description: 'Review listing readiness.',
            intent: 'secondary'
          },
          {
            key: 'verification',
            to: '/dashboard?workspace=verification',
            label: 'Verification',
            description: 'Prepare ownership trust.',
            intent: 'secondary'
          }
        ],
        checklist: []
      },
      {
        eyebrow: 'مساحة المالك',
        title: 'أدر مخزون العقارات وجاهزية العملاء.',
        description:
          'حسابات الملاك يجب أن ترى أدوات العقارات والتحقق وجودة الوسائط والعقود وطلبات الحجز أو الزيارة.',
        actions: [
          {
            key: 'add-listing',
            to: '/add-listing',
            label: 'إضافة عقار',
            description: 'إنشاء إعلان عقاري.',
            intent: 'primary'
          },
          {
            key: 'manage-listings',
            to: '/dashboard?workspace=listings-command',
            label: 'إدارة العقارات',
            description: 'مراجعة جاهزية العقارات.',
            intent: 'secondary'
          },
          {
            key: 'verification',
            to: '/dashboard?workspace=verification',
            label: 'التحقق',
            description: 'تجهيز ثقة الملكية.',
            intent: 'secondary'
          }
        ],
        checklist: []
      }
    );
  }

  if (persona === 'activityProvider') {
    return localize<RoleAwarePanel>(
      language,
      {
        eyebrow: 'Activity provider workspace',
        title: 'Manage activities, capacity, bookings, and media quality.',
        description:
          'Activity providers should see activity tools, booking requests, schedule and capacity, reviews, trust, and performance.',
        actions: [
          {
            key: 'add-activity',
            to: '/add-activity',
            label: 'Add activity',
            description: 'Create a local activity.',
            intent: 'primary'
          },
          {
            key: 'manage-activities',
            to: '/dashboard?workspace=activities-command',
            label: 'Manage activities',
            description: 'Review activity readiness.',
            intent: 'secondary'
          },
          {
            key: 'booking-requests',
            to: '/dashboard?workspace=booking-requests',
            label: 'Booking requests',
            description: 'Review customer requests.',
            intent: 'secondary'
          }
        ],
        checklist: []
      },
      {
        eyebrow: 'مساحة مزود الأنشطة',
        title: 'أدر الأنشطة والسعة والحجوزات وجودة الوسائط.',
        description:
          'مزودو الأنشطة يجب أن يروا أدوات الأنشطة وطلبات الحجز والجدولة والسعة والمراجعات والثقة والأداء.',
        actions: [
          {
            key: 'add-activity',
            to: '/add-activity',
            label: 'إضافة نشاط',
            description: 'إنشاء نشاط محلي.',
            intent: 'primary'
          },
          {
            key: 'manage-activities',
            to: '/dashboard?workspace=activities-command',
            label: 'إدارة الأنشطة',
            description: 'مراجعة جاهزية النشاط.',
            intent: 'secondary'
          },
          {
            key: 'booking-requests',
            to: '/dashboard?workspace=booking-requests',
            label: 'طلبات الحجز',
            description: 'مراجعة طلبات العملاء.',
            intent: 'secondary'
          }
        ],
        checklist: []
      }
    );
  }

  if (persona === 'travelAgency') {
    return localize<RoleAwarePanel>(
      language,
      {
        eyebrow: 'Travel agency workspace',
        title: 'Manage packages, itineraries, group requests, and supplier readiness.',
        description:
          'Travel agencies should see package tools, itinerary readiness, group bookings, supplier documents, and package payments.',
        actions: [
          {
            key: 'add-package',
            to: '/add-activity',
            label: 'Add travel package',
            description: 'Create an outside-Oman package.',
            intent: 'primary'
          },
          {
            key: 'travel-packages',
            to: '/dashboard?workspace=travel-packages',
            label: 'Travel packages',
            description: 'Manage package readiness.',
            intent: 'secondary'
          },
          {
            key: 'supplier-documents',
            to: '/dashboard?workspace=supplier-documents',
            label: 'Supplier documents',
            description: 'Track supplier readiness.',
            intent: 'secondary'
          }
        ],
        checklist: []
      },
      {
        eyebrow: 'مساحة وكالة السفر',
        title: 'أدِر الباقات والبرامج وطلبات المجموعات وجاهزية الموردين.',
        description:
          'وكالات السفر يجب أن ترى أدوات الباقات وجاهزية البرامج وحجوزات المجموعات ومستندات الموردين ومدفوعات الباقات.',
        actions: [
          {
            key: 'add-package',
            to: '/add-activity',
            label: 'إضافة باقة سفر',
            description: 'إنشاء باقة خارج عُمان.',
            intent: 'primary'
          },
          {
            key: 'travel-packages',
            to: '/dashboard?workspace=travel-packages',
            label: 'باقات السفر',
            description: 'إدارة جاهزية الباقات.',
            intent: 'secondary'
          },
          {
            key: 'supplier-documents',
            to: '/dashboard?workspace=supplier-documents',
            label: 'مستندات الموردين',
            description: 'متابعة جاهزية الموردين.',
            intent: 'secondary'
          }
        ],
        checklist: []
      }
    );
  }

  if (persona === 'developer') {
    return localize<RoleAwarePanel>(
      language,
      {
        eyebrow: 'Developer company workspace',
        title: 'Manage projects, units, documents, and investor leads.',
        description:
          'Developer accounts should see project tools, unit inventory, launch readiness, documents, investor leads, and market insight workflows.',
        actions: [
          {
            key: 'add-project',
            to: '/add-project',
            label: 'Add project',
            description: 'Create a development project.',
            intent: 'primary'
          },
          {
            key: 'manage-projects',
            to: '/dashboard?workspace=projects-developments',
            label: 'Manage projects',
            description: 'Review project readiness.',
            intent: 'secondary'
          },
          {
            key: 'units-inventory',
            to: '/dashboard?workspace=units-inventory',
            label: 'Units inventory',
            description: 'Manage linked units.',
            intent: 'secondary'
          }
        ],
        checklist: []
      },
      {
        eyebrow: 'مساحة شركة التطوير',
        title: 'أدر المشاريع والوحدات والمستندات والعملاء المستثمرين.',
        description:
          'حسابات المطورين يجب أن ترى أدوات المشاريع ومخزون الوحدات وجاهزية الإطلاق والمستندات والعملاء المستثمرين ومؤشرات السوق.',
        actions: [
          {
            key: 'add-project',
            to: '/add-project',
            label: 'إضافة مشروع',
            description: 'إنشاء مشروع تطويري.',
            intent: 'primary'
          },
          {
            key: 'manage-projects',
            to: '/dashboard?workspace=projects-developments',
            label: 'إدارة المشاريع',
            description: 'مراجعة جاهزية المشاريع.',
            intent: 'secondary'
          },
          {
            key: 'units-inventory',
            to: '/dashboard?workspace=units-inventory',
            label: 'مخزون الوحدات',
            description: 'إدارة الوحدات المرتبطة.',
            intent: 'secondary'
          }
        ],
        checklist: []
      }
    );
  }

  return localize<RoleAwarePanel>(
    language,
    {
      eyebrow: 'Admin operations',
      title: 'Review marketplace operations from the admin cockpit.',
      description:
        'Admin accounts should use approval, trust, media, finance, user, and system health tools in the admin workspace.',
      actions: [
        {
          key: 'admin-cockpit',
          to: '/admin',
          label: 'Open admin cockpit',
          description: 'Review marketplace operations.',
          intent: 'primary'
        },
        {
          key: 'admin-approvals',
          to: '/admin?workspace=approvals',
          label: 'Approvals',
          description: 'Review publishing queues.',
          intent: 'secondary'
        }
      ],
      checklist: []
    },
    {
      eyebrow: 'عمليات الإدارة',
      title: 'راجع عمليات السوق من مركز الإدارة.',
      description:
        'حسابات الإدارة يجب أن تستخدم أدوات الموافقات والثقة والوسائط والمالية والمستخدمين وصحة النظام في مساحة الإدارة.',
      actions: [
        {
          key: 'admin-cockpit',
          to: '/admin',
          label: 'فتح مركز الإدارة',
          description: 'مراجعة عمليات السوق.',
          intent: 'primary'
        },
        {
          key: 'admin-approvals',
          to: '/admin?workspace=approvals',
          label: 'الموافقات',
          description: 'مراجعة قوائم النشر.',
          intent: 'secondary'
        }
      ],
      checklist: []
    }
  );
}

export function getRoleAwareHomeReadinessPanel(
  role?: UserRole | string | null,
  language: Locale = 'en',
  isAuthenticated = false
): RoleAwarePanel {
  const panel = getRoleAwareFooterCta(role, language, isAuthenticated);
  const persona = getMarketplacePersona(role);

  if (!isAuthenticated) {
    return {
      ...panel,
      checklist: localize<string[]>(
        language,
        [
          'Choose the right role before creating inventory',
          'Add clear pricing, media, and location context',
          'Prepare verification and partner contact details',
          'Use dashboard readiness before admin review'
        ],
        [
          'اختر الدور الصحيح قبل إنشاء المحتوى',
          'أضف تسعيراً ووسائط وموقعاً واضحاً',
          'جهّز بيانات التحقق والتواصل للشريك',
          'استخدم جاهزية لوحة التحكم قبل مراجعة الإدارة'
        ]
      )
    };
  }

  if (persona === 'customer') {
    return {
      ...panel,
      checklist: localize<string[]>(
        language,
        [
          'Save properties, projects, and activities to compare later',
          'Track bookings, payments, and receipts in your dashboard',
          'Use trust badges and media guidance before contacting providers',
          'Report concerns from public detail pages when something looks wrong'
        ],
        [
          'احفظ العقارات والمشاريع والأنشطة للمقارنة لاحقاً',
          'تابع الحجوزات والمدفوعات والإيصالات في لوحة التحكم',
          'استخدم شارات الثقة وإرشادات الوسائط قبل التواصل مع المزودين',
          'أبلغ عن المخاوف من صفحات التفاصيل عند وجود مشكلة'
        ]
      )
    };
  }

  if (persona === 'admin') {
    return {
      ...panel,
      checklist: localize<string[]>(
        language,
        [
          'Review approval queues and media warnings',
          'Monitor trust reports and email delivery health',
          'Keep user, finance, booking, and system workflows separated',
          'Use role workspaces to verify public UI boundaries'
        ],
        [
          'راجع قوائم الموافقات وتحذيرات الوسائط',
          'راقب بلاغات الثقة وصحة تسليم البريد',
          'أبقِ مسارات المستخدمين والمالية والحجوزات والنظام منفصلة',
          'استخدم مساحات الأدوار للتحقق من حدود الواجهة العامة'
        ]
      )
    };
  }

  return {
    ...panel,
    checklist: localize<string[]>(
      language,
      [
        'Complete role-specific profile and verification details',
        'Add strong media and clear pricing or package structure',
        'Review readiness warnings before submitting for admin approval',
        'Use only the tools that match this account type'
      ],
      [
        'أكمل بيانات الملف والتحقق المناسبة للدور',
        'أضف وسائط قوية وتسعيراً أو هيكلة باقة واضحة',
        'راجع تحذيرات الجاهزية قبل الإرسال للمراجعة الإدارية',
        'استخدم فقط الأدوات المناسبة لنوع هذا الحساب'
      ]
    )
  };
}

export function getRoleAwareFooterWorkspaceLinks(
  role?: UserRole | string | null,
  language: Locale = 'en',
  isAuthenticated = false
): { heading: string; links: RoleAwareLink[] } {
  const persona = getMarketplacePersona(role);

  if (!isAuthenticated) {
    return localize<{ heading: string; links: RoleAwareLink[] }>(
      language,
      {
        heading: 'Owners & partners',
        links: [
          { key: 'join-owner', to: '/register?role=OWNER', label: 'List a property' },
          { key: 'join-activity', to: '/register?role=ACTIVITY_PROVIDER', label: 'List an activity' },
          { key: 'join-agency', to: '/register?role=TRAVEL_AGENCY', label: 'Join as travel agency' },
          { key: 'join-developer', to: '/register?role=DEVELOPER', label: 'Partner as developer' },
          { key: 'dashboard', to: '/dashboard', label: 'Dashboard' }
        ]
      },
      {
        heading: 'الملاك والشركاء',
        links: [
          { key: 'join-owner', to: '/register?role=OWNER', label: 'إدراج عقار' },
          { key: 'join-activity', to: '/register?role=ACTIVITY_PROVIDER', label: 'إدراج نشاط' },
          { key: 'join-agency', to: '/register?role=TRAVEL_AGENCY', label: 'انضم كوكالة سفر' },
          { key: 'join-developer', to: '/register?role=DEVELOPER', label: 'شراكة مطور عقاري' },
          { key: 'dashboard', to: '/dashboard', label: 'لوحة التحكم' }
        ]
      }
    );
  }

  if (persona === 'customer') {
    return localize<{ heading: string; links: RoleAwareLink[] }>(
      language,
      {
        heading: 'Your marketplace',
        links: [
          { key: 'dashboard', to: '/dashboard', label: 'Dashboard' },
          { key: 'saved', to: '/dashboard?workspace=saved-alerts', label: 'Saved & alerts' },
          { key: 'bookings', to: '/dashboard?workspace=my-bookings', label: 'My bookings' },
          { key: 'notifications', to: '/notifications', label: 'Notifications' },
          { key: 'profile', to: '/profile', label: 'Profile settings' }
        ]
      },
      {
        heading: 'سوقك الشخصي',
        links: [
          { key: 'dashboard', to: '/dashboard', label: 'لوحة التحكم' },
          { key: 'saved', to: '/dashboard?workspace=saved-alerts', label: 'المحفوظات والتنبيهات' },
          { key: 'bookings', to: '/dashboard?workspace=my-bookings', label: 'حجوزاتي' },
          { key: 'notifications', to: '/notifications', label: 'التنبيهات' },
          { key: 'profile', to: '/profile', label: 'إعدادات الملف' }
        ]
      }
    );
  }

  const panel = getRoleAwareFooterCta(role, language, isAuthenticated);
  const links = panel.actions.map((action) => ({
    key: action.key,
    to: action.to,
    label: action.label
  }));

  links.push(
    localize<RoleAwareLink>(
      language,
      { key: 'dashboard', to: '/dashboard', label: 'Dashboard' },
      { key: 'dashboard', to: '/dashboard', label: 'لوحة التحكم' }
    )
  );

  return {
    heading: panel.eyebrow,
    links
  };
}
