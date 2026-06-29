import type { UserRole } from '../types';

type SupportedLanguage = 'en' | 'ar';

const roleCopy: Record<
  UserRole,
  Record<SupportedLanguage, { label: string; description: string }>
> = {
  USER: {
    en: {
      label: 'User account',
      description: 'Can browse, inquire, book, pay, save opportunities, and manage personal requests.'
    },
    ar: {
      label: 'حساب مستخدم',
      description: 'يمكنه التصفح والاستفسار والحجز والدفع وحفظ الفرص وإدارة الطلبات الشخصية.'
    }
  },
  OWNER: {
    en: {
      label: 'Owner / agent account',
      description: 'Can submit listings, manage portfolio items, receive inquiries, and handle booking requests.'
    },
    ar: {
      label: 'حساب مالك / وسيط',
      description: 'يمكنه إضافة العقارات وإدارة المحفظة واستقبال الاستفسارات والتعامل مع طلبات الحجز.'
    }
  },
  ACTIVITY_PROVIDER: {
    en: {
      label: 'Activity provider account',
      description: 'Can submit activities, manage experiences, and approve or reject activity booking requests.'
    },
    ar: {
      label: 'حساب مزود أنشطة',
      description: 'يمكنه إضافة الأنشطة وإدارة التجارب وقبول أو رفض طلبات حجز الأنشطة.'
    }
  },
  DEVELOPER: {
    en: {
      label: 'Developer account',
      description: 'Can represent development projects and keep developer profile information organized.'
    },
    ar: {
      label: 'حساب مطور عقاري',
      description: 'يمكنه تمثيل المشاريع العقارية وتنظيم بيانات ملف المطور.'
    }
  },
  ADMIN: {
    en: {
      label: 'Admin account',
      description: 'Can manage publishing, reviews, bookings, marketplace operations, and trust workflows.'
    },
    ar: {
      label: 'حساب إدارة',
      description: 'يمكنه إدارة النشر والمراجعات والحجوزات وعمليات السوق وسير الثقة.'
    }
  }
};

function normalizeLanguage(language: string): SupportedLanguage {
  return language === 'ar' ? 'ar' : 'en';
}

function normalizeRole(role?: UserRole | string | null): UserRole {
  if (
    role === 'OWNER' ||
    role === 'ACTIVITY_PROVIDER' ||
    role === 'DEVELOPER' ||
    role === 'ADMIN'
  ) {
    return role;
  }

  return 'USER';
}

export function getAccountRoleLabel(role?: UserRole | string | null, language = 'en') {
  return roleCopy[normalizeRole(role)][normalizeLanguage(language)].label;
}

export function getAccountRoleDescription(role?: UserRole | string | null, language = 'en') {
  return roleCopy[normalizeRole(role)][normalizeLanguage(language)].description;
}

export function isMarketplaceOperatorRole(role?: UserRole | string | null) {
  return role === 'OWNER' || role === 'ACTIVITY_PROVIDER' || role === 'ADMIN';
}
