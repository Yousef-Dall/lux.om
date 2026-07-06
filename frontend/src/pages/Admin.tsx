import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  Inbox,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  XCircle
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  createAdminDeveloper,
  createAdminTravelAgency,
  deleteAdminDeveloper,
  deleteAdminTravelAgency,
  exportAdminBookingsCsv,
  exportAdminFinanceCsv,
  getAdminActivities,
  getAdminBookings,
  getAdminDevelopers,
  getAdminFinance,
  getAdminInquiries,
  getAdminListings,
  getAdminTravelAgencies,
  updateAdminActivityStatus,
  updateAdminBookingPaymentStatus,
  updateAdminBookingStatus,
  updateAdminDeveloper,
  updateAdminListingStatus,
  updateAdminTravelAgency,
  type AdminFinance,
  type AdminReportFilters,
  type UpdateDeveloperPayload,
  type UpdateTravelAgencyPayload
} from '../api/admin';
import type { ApiBooking, BookingStatus, PaymentStatus } from '../api/bookings';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import Stage8AdminCommandCenter from '../components/Stage8AdminCommandCenter';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  ActivityStatus,
  ApiActivity,
  ApiDeveloperCompany,
  ApiListing,
  ApiTravelAgency,
  Inquiry,
  ListingStatus
} from '../types';
import AdminOperationsTrustPanel from '../components/AdminOperationsTrustPanel';
import AdminEmailDeliveryHealthPanel from '../components/AdminEmailDeliveryHealthPanel';
import AdminSystemHealthPanel from '../components/AdminSystemHealthPanel';
import AdminDeveloperProjectReviewPanel from '../components/AdminDeveloperProjectReviewPanel';

function getListingTitle(listing: ApiListing, language: 'en' | 'ar') {
  if (language === 'ar') {
    return listing.titleAr || listing.titleEn || listing.title;
  }

  return listing.titleEn || listing.titleAr || listing.title;
}

function getListingLocation(listing: ApiListing, language: 'en' | 'ar') {
  if (language === 'ar') {
    return listing.locationAr || listing.locationEn || listing.location;
  }

  return listing.locationEn || listing.locationAr || listing.location;
}

function getListingType(listing: ApiListing, language: 'en' | 'ar') {
  if (language === 'ar') {
    return listing.typeAr || listing.typeEn || listing.type;
  }

  return listing.typeEn || listing.typeAr || listing.type;
}

function getActivityTitle(activity: ApiActivity, language: 'en' | 'ar') {
  if (language === 'ar') {
    return activity.titleAr || activity.titleEn;
  }

  return activity.titleEn || activity.titleAr || '';
}

function getActivityLocation(activity: ApiActivity, language: 'en' | 'ar') {
  if (language === 'ar') {
    return activity.locationAr || activity.locationEn;
  }

  return activity.locationEn || activity.locationAr || '';
}

function getActivityCategory(activity: ApiActivity, language: 'en' | 'ar') {
  if (language === 'ar') {
    return activity.categoryAr || activity.categoryEn;
  }

  return activity.categoryEn || activity.categoryAr || '';
}

function getActivityProvider(activity: ApiActivity, language: 'en' | 'ar') {
  const agencyName =
    language === 'ar'
      ? activity.travelAgency?.nameAr || activity.travelAgency?.nameEn
      : activity.travelAgency?.nameEn || activity.travelAgency?.nameAr;

  const providerName =
    language === 'ar'
      ? activity.providerAr || activity.providerEn
      : activity.providerEn || activity.providerAr;

  return agencyName || providerName || 'Activity provider';
}

function getAgencyName(agency: ApiTravelAgency, language: 'en' | 'ar') {
  if (language === 'ar') {
    return agency.nameAr || agency.nameEn;
  }

  return agency.nameEn || agency.nameAr || '';
}

function getAgencyHeadquarters(agency: ApiTravelAgency, language: 'en' | 'ar') {
  if (language === 'ar') {
    return agency.headquartersAr || agency.headquartersEn || '';
  }

  return agency.headquartersEn || agency.headquartersAr || '';
}

function getDeveloperName(
  developer: ApiDeveloperCompany,
  language: 'en' | 'ar'
) {
  if (language === 'ar') {
    return developer.nameAr || developer.nameEn;
  }

  return developer.nameEn || developer.nameAr || '';
}

function getDeveloperHeadquarters(
  developer: ApiDeveloperCompany,
  language: 'en' | 'ar'
) {
  if (language === 'ar') {
    return developer.headquartersAr || developer.headquartersEn || '';
  }

  return developer.headquartersEn || developer.headquartersAr || '';
}

function getListingQualityScore(listing: ApiListing, index: number) {
  let score = 70;

  if (listing.images?.length || listing.image) score += 8;
  if (listing.amenities?.length) score += 6;
  if (listing.descriptionEn || listing.description) score += 6;
  if (listing.developer) score += 5;
  if (listing.nearestLandmark) score += 3;
  if (listing.developer?.featured) score += 5;

  return Math.min(98, Math.max(72, score - index));
}

function getActivityQualityScore(activity: ApiActivity, index: number) {
  let score = 72;

  if (activity.images?.length) score += 8;
  if (activity.highlights?.length) score += 6;
  if (activity.descriptionEn) score += 6;
  if (activity.travelAgency) score += 5;
  if (activity.nearestLandmark) score += 3;
  if (activity.travelAgency?.featured) score += 5;

  return Math.min(98, Math.max(72, score - index));
}

function isApprovedStatus(status?: string) {
  return status === 'APPROVED';
}

function isPendingStatus(status?: string) {
  return status === 'PENDING' || !status;
}

type ReviewStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

type AdminWorkspaceKey =
  | 'approvals'
  | 'command'
  | 'health'
  | 'summary'
  | 'finance'
  | 'bookings'
  | 'partners'
  | 'reviewDetails';

const adminSectionWorkspaceMap: Partial<Record<string, AdminWorkspaceKey>> = {
  'admin-approvals-workspace': 'approvals',
  'admin-approvals': 'approvals',
  'admin-developer-projects': 'approvals',
  'admin-command-center': 'command',
  'admin-health': 'health',
  'admin-overview-metrics': 'summary',
  'admin-finance-section': 'finance',
  'admin-bookings-section': 'bookings',
  'admin-partners-section': 'partners',
  'admin-review-detail-queues': 'reviewDetails'
};

const adminWorkspaceKeys: AdminWorkspaceKey[] = [
  'approvals',
  'command',
  'health',
  'summary',
  'finance',
  'bookings',
  'partners',
  'reviewDetails'
];

function parseAdminWorkspace(value: string | null): AdminWorkspaceKey | null {
  if (!value) return null;

  return adminWorkspaceKeys.includes(value as AdminWorkspaceKey)
    ? (value as AdminWorkspaceKey)
    : null;
}

const reviewStatusFilters: ReviewStatusFilter[] = [
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED'
];

function matchesReviewStatus(status: string | undefined, filter: ReviewStatusFilter) {
  if (filter === 'ALL') return true;
  if (filter === 'PENDING') return isPendingStatus(status);

  return status === filter;
}

function getPublishingStatusPriority(status?: string) {
  if (isPendingStatus(status)) return 0;
  if (status === 'REJECTED') return 1;
  if (status === 'APPROVED') return 2;

  return 3;
}



function getAdminBookingTitle(booking: ApiBooking, language: 'en' | 'ar') {
  if (booking.activity) {
    return language === 'ar'
      ? booking.activity.titleAr || booking.activity.titleEn
      : booking.activity.titleEn || booking.activity.titleAr || '';
  }

  if (booking.listing) {
    return language === 'ar'
      ? booking.listing.titleAr || booking.listing.titleEn || booking.listing.title
      : booking.listing.titleEn || booking.listing.titleAr || booking.listing.title;
  }

  return language === 'ar' ? 'حجز' : 'Booking';
}

function getAdminBookingSubtitle(booking: ApiBooking, language: 'en' | 'ar') {
  if (booking.activity) {
    return language === 'ar'
      ? booking.activity.locationAr || booking.activity.locationEn
      : booking.activity.locationEn || booking.activity.locationAr || '';
  }

  if (booking.listing) {
    return language === 'ar'
      ? booking.listing.locationAr || booking.listing.locationEn || booking.listing.location
      : booking.listing.locationEn || booking.listing.locationAr || booking.listing.location;
  }

  return '';
}

function getAdminBookingKind(booking: ApiBooking, language: 'en' | 'ar') {
  if (booking.activity) {
    if (booking.activity.travelRegion === 'OUTSIDE_OMAN') {
      return language === 'ar' ? 'باقة سفر' : 'Travel package';
    }

    return language === 'ar' ? 'نشاط' : 'Activity';
  }

  if (booking.listing) {
    return language === 'ar' ? 'عقار' : 'Listing';
  }

  return language === 'ar' ? 'حجز' : 'Booking';
}

function formatAdminBookingDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function formatAdminBookingDateTime(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function getAdminBookingEventLabel(type: string, language: 'en' | 'ar') {
  const labels: Record<string, { en: string; ar: string }> = {
    BOOKING_CREATED: {
      en: 'Booking request created',
      ar: 'تم إنشاء طلب الحجز'
    },
    OWNER_APPROVED: {
      en: 'Provider approved',
      ar: 'وافق المنظم'
    },
    OWNER_REJECTED: {
      en: 'Provider rejected',
      ar: 'رفض المنظم'
    },
    ADMIN_CONFIRMED: {
      en: 'Admin confirmed',
      ar: 'أكدت الإدارة'
    },
    CANCELLED: {
      en: 'Booking cancelled',
      ar: 'تم إلغاء الحجز'
    },
    PAYMENT_SESSION_CREATED: {
      en: 'Payment session created',
      ar: 'تم إنشاء جلسة الدفع'
    },
    PAYMENT_PAID: {
      en: 'Payment completed',
      ar: 'تم الدفع'
    },
    PAYMENT_FAILED: {
      en: 'Payment failed',
      ar: 'فشل الدفع'
    }
  };

  const label = labels[type];

  if (!label) return type.replaceAll('_', ' ').toLowerCase();

  return language === 'ar' ? label.ar : label.en;
}

function getAdminPaymentAmount(booking: ApiBooking) {
  const amount = Number(booking.payment?.amount ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}


function formatAdminFinanceAmount(
  value: number | string | null | undefined,
  language: 'en' | 'ar'
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat(language === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: 'OMR',
    maximumFractionDigits: 3
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatAdminPaymentAmount(booking: ApiBooking) {
  const amount = getAdminPaymentAmount(booking);

  if (amount <= 0) return '—';

  const currency =
    booking.activity?.priceCurrency ||
    booking.listing?.priceCurrency ||
    'OMR';

  return `${currency} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function getBookingTone(status?: string) {
  if (status === 'OWNER_APPROVED' || status === 'ADMIN_CONFIRMED' || status === 'PAID') {
    return 'approved';
  }

  if (
    status === 'OWNER_REJECTED' ||
    status === 'CANCELLED' ||
    status === 'FAILED' ||
    status === 'REFUNDED'
  ) {
    return 'rejected';
  }

  return 'pending';
}

function BookingToneIcon({ status }: { status?: string }) {
  const tone = getBookingTone(status);

  if (tone === 'approved') {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }

  if (tone === 'rejected') {
    return <XCircle size={14} aria-hidden="true" />;
  }

  return <Clock3 size={14} aria-hidden="true" />;
}

const initialAgencyForm = {
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  headquartersEn: '',
  headquartersAr: '',
  logo: '',
  phone: '',
  email: '',
  website: '',
  establishedYear: '',
  verified: true,
  featured: false
};

const initialDeveloperForm = {
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  headquartersEn: '',
  headquartersAr: '',
  logo: '',
  phone: '',
  email: '',
  website: '',
  establishedYear: '',
  verified: true,
  featured: false
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export default function Admin() {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();

  useDocumentTitle('Admin');

  const [listings, setListings] = useState<ApiListing[]>([]);
  const [activities, setActivities] = useState<ApiActivity[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [finance, setFinance] = useState<AdminFinance | null>(null);
const [travelAgencies, setTravelAgencies] = useState<ApiTravelAgency[]>([]);
const [developers, setDevelopers] = useState<ApiDeveloperCompany[]>([]);

const [agencyForm, setAgencyForm] = useState(initialAgencyForm);
const [developerForm, setDeveloperForm] = useState(initialDeveloperForm);

const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState('');
const [updatingId, setUpdatingId] = useState('');
const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>('ALL');
const [adminBookingStatusFilter, setAdminBookingStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');
const [adminPaymentStatusFilter, setAdminPaymentStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
const [adminPayoutFilter, setAdminPayoutFilter] = useState<'ALL' | 'READY' | 'BLOCKED'>('ALL');
const [adminReportFrom, setAdminReportFrom] = useState('');
const [adminReportTo, setAdminReportTo] = useState('');
const [exportingReport, setExportingReport] = useState<'bookings' | 'finance' | ''>('');

const [creatingAgency, setCreatingAgency] = useState(false);
const [agencyFormError, setAgencyFormError] = useState('');
const [agencyFormSuccess, setAgencyFormSuccess] = useState('');

const [creatingDeveloper, setCreatingDeveloper] = useState(false);
const [developerFormError, setDeveloperFormError] = useState('');
const [developerFormSuccess, setDeveloperFormSuccess] = useState('');
const [activeAdminWorkspace, setActiveAdminWorkspace] = useState<AdminWorkspaceKey>('approvals');
  

  const copy =
    language === 'ar'
      ? {
        noDevelopers: 'لا توجد شركات تطوير حالياً.',
deleteDeveloper: 'حذف شركة التطوير؟',
        developerManagement: 'إدارة شركات التطوير',
developerManagementText: 'أضف شركات تطوير موثقة واربطها بالعقارات.',
createDeveloper: 'إضافة شركة تطوير',
creatingDeveloper: 'جاري إنشاء الشركة...',
developerCreated: 'تم إنشاء شركة التطوير بنجاح.',
developerDetails: 'بيانات شركة التطوير',
developerDetailsText: 'أدخل هوية الشركة ومعلوماتها الأساسية.',
developerName: 'اسم الشركة بالإنجليزي',
developerNameAr: 'اسم الشركة بالعربي',
verifiedDeveloper: 'شركة موثقة',
featuredDeveloper: 'شركة مميزة',
verifiedDeveloperHelp: 'إظهار الشركة كشريك تطوير موثق على المنصة.',
featuredDeveloperHelp: 'إبراز الشركة في أقسام المطورين والمحتوى المختار.',
        agencyDetails: 'بيانات الوكالة',
agencyDetailsText: 'أدخل الاسم والمعلومات الأساسية للوكالة.',
englishContent: 'المحتوى الإنجليزي',
arabicContent: 'المحتوى العربي',
contactDetails: 'بيانات التواصل',
publishingSettings: 'إعدادات النشر',
verifiedHelp: 'إظهار الوكالة كشريك موثق على المنصة.',
featuredHelp: 'إبراز الوكالة في الأقسام والمحتوى المختار.',
agencyCreated: 'تم إنشاء وكالة السفر بنجاح.',
requiredField: 'مطلوب',
          marketplaceControl: 'إدارة السوق',
          heroTitle: 'حافظ على جودة كل عقار ونشاط قبل النشر.',
          heroText:
            'راجع العقارات، الأنشطة، وكالات السفر، الاستفسارات، وحالة النشر قبل ظهور أي محتوى للعامة.',
          qualityGate: 'بوابة الجودة مفعلة',
          publicReadyListings: 'عقارات منشورة',
          waitingForReview: 'بانتظار المراجعة',
          featured: 'مميز',
          homepageHighlights: 'ظاهر في الصفحة الرئيسية',
          needsAttention: 'يحتاج انتباهاً',
          missingVerification: 'عناصر قيد المراجعة',
          reviewQueue: 'قائمة المراجعة',
          reviewFilter: 'فلترة قائمة المراجعة',
          allStatuses: 'كل الحالات',
          pendingOnly: 'قيد المراجعة',
          approvedOnly: 'مقبول',
          rejectedOnly: 'مرفوض',
          sendToPending: 'إرجاع للمراجعة',
          rejectionNote: 'سبب الرفض',
          listingQueue: 'مراجعة العقارات',
          viewMarketplace: 'عرض السوق',
          quality: 'الجودة',
          action: 'الإجراء',
          approve: 'قبول',
          reject: 'رفض',
          approved: 'مقبول',
          rejected: 'مرفوض',
          pending: 'قيد المراجعة',
          privateOwner: 'مالك خاص',
          activitiesQueue: 'مراجعة الأنشطة',
          inquiriesQueue: 'الاستفسارات',
          featuredActivities: 'أنشطة مميزة',
travelAgencies: 'وكالات السفر',
verifiedDevelopers: 'شركات تطوير موثقة',
          agencyManagement: 'إدارة وكالات السفر',
          agencyManagementText: 'أضف وكالات سفر موثقة واربطها بالأنشطة.',
          createAgency: 'إضافة وكالة سفر',
          agencyName: 'اسم الوكالة بالإنجليزي',
          agencyNameAr: 'اسم الوكالة بالعربي',
          description: 'الوصف',
          descriptionAr: 'الوصف بالعربي',
          headquarters: 'المقر',
          headquartersAr: 'المقر بالعربي',
          logo: 'رابط الشعار',
          phone: 'الهاتف',
          email: 'البريد الإلكتروني',
          website: 'الموقع الإلكتروني',
          establishedYear: 'سنة التأسيس',
          verifiedAgency: 'موثقة',
          featuredAgency: 'مميزة',
          create: 'إنشاء',
          creating: 'جاري الإنشاء...',
          noAgencies: 'لا توجد وكالات سفر حالياً.',
          deleteAgency: 'حذف الوكالة؟',
          loading: 'جاري تحميل لوحة الإدارة...',
          error: 'تعذر تحميل بيانات الإدارة. تأكدي أن الخادم يعمل ثم حاولي مرة أخرى.',
          noListings: 'لا توجد عقارات للمراجعة.',
          noActivities: 'لا توجد أنشطة للمراجعة.',
          noInquiries: 'لا توجد استفسارات حالياً.',
          rejectReason: 'سبب الرفض؟',
          defaultRejectReason: 'المحتوى يحتاج تعديلات قبل النشر.',
          inquiryType: 'النوع',
          message: 'الرسالة',
          contact: 'التواصل',
          createdAt: 'تاريخ الإرسال',
          developers: 'شركات التطوير'
        }
      : {
        noDevelopers: 'No developer companies yet.',
deleteDeveloper: 'Delete this developer company?',
        developerManagement: 'Developer company management',
developerManagementText: 'Create verified developer companies and connect them to properties.',
createDeveloper: 'Create developer company',
creatingDeveloper: 'Creating company...',
developerCreated: 'Developer company created successfully.',
developerDetails: 'Developer company details',
developerDetailsText: 'Enter the company identity and essential business information.',
developerName: 'Company name',
developerNameAr: 'Company Arabic name',
verifiedDeveloper: 'Verified developer',
featuredDeveloper: 'Featured developer',
verifiedDeveloperHelp: 'Display this company as a verified development partner.',
featuredDeveloperHelp: 'Allow the company to appear in featured developer sections.',
        agencyDetails: 'Agency details',
agencyDetailsText: 'Enter the agency identity and essential business information.',
englishContent: 'English content',
arabicContent: 'Arabic content',
contactDetails: 'Contact details',
publishingSettings: 'Publishing settings',
verifiedHelp: 'Display this agency as a verified platform partner.',
featuredHelp: 'Allow the agency to appear in featured marketplace sections.',
agencyCreated: 'Travel agency created successfully.',
requiredField: 'Required',
          marketplaceControl: 'Marketplace control',
          heroTitle: 'Keep every public listing and activity polished, complete, and trustworthy.',
          heroText:
            'Review listings, activities, travel agencies, inquiries, and approval readiness before anything goes live.',
          qualityGate: 'Quality gate active',
          publicReadyListings: 'Public-ready listings',
          waitingForReview: 'Waiting for review',
          featured: 'Featured',
          homepageHighlights: 'Highlighted on homepage',
          needsAttention: 'Needs attention',
          missingVerification: 'Items waiting for review',
          reviewQueue: 'Review queue',
          reviewFilter: 'Filter review queue',
          allStatuses: 'All statuses',
          pendingOnly: 'Pending',
          approvedOnly: 'Approved',
          rejectedOnly: 'Rejected',
          sendToPending: 'Move back to pending',
          rejectionNote: 'Rejection note',
          listingQueue: 'Listing queue',
          viewMarketplace: 'View marketplace',
          quality: 'Quality',
          action: 'Action',
          approve: 'Approve',
          reject: 'Reject',
          approved: 'Approved',
          rejected: 'Rejected',
          pending: 'Pending',
          privateOwner: 'Private owner',
          activitiesQueue: 'Activity queue',
          inquiriesQueue: 'Inquiries',
          featuredActivities: 'Featured activities',
travelAgencies: 'Travel agencies',
developers: 'Developer companies',
verifiedDevelopers: 'Verified developers',
          agencyManagement: 'Travel agency management',
          agencyManagementText: 'Create verified travel agencies and connect them to activities.',
          createAgency: 'Create travel agency',
          agencyName: 'Agency name',
          agencyNameAr: 'Agency Arabic name',
          description: 'Description',
          descriptionAr: 'Arabic description',
          headquarters: 'Headquarters',
          headquartersAr: 'Arabic headquarters',
          logo: 'Logo URL',
          phone: 'Phone',
          email: 'Email',
          website: 'Website',
          establishedYear: 'Established year',
          verifiedAgency: 'Verified',
          featuredAgency: 'Featured',
          create: 'Create',
          creating: 'Creating...',
          noAgencies: 'No travel agencies yet.',
          deleteAgency: 'Delete this agency?',
          loading: 'Loading admin dashboard...',
          error: 'Could not load admin data. Make sure the backend is running and try again.',
          noListings: 'No listings to review.',
          noActivities: 'No activities to review.',
          noInquiries: 'No inquiries yet.',
          rejectReason: 'Reason for rejection?',
          defaultRejectReason: 'This submission needs edits before it can be published.',
          inquiryType: 'Type',
          message: 'Message',
          contact: 'Contact',
          createdAt: 'Created at'
        };


  const adminFinanceCopy =
    language === 'ar'
      ? {
          title: 'دفتر المالية',
          subtitle: 'تابع المدفوعات، العمولات، المبالغ المستردة، وجاهزية مستحقات المنظمين.',
          totalPaid: 'إجمالي المدفوع',
          pendingAmount: 'بانتظار الدفع',
          refundedAmount: 'مسترد',
          failedAmount: 'فشل الدفع',
          platformCommission: 'عمولة المنصة',
          paidCommission: 'عمولة مدفوعة',
          payoutReady: 'جاهز للصرف',
          payoutBlocked: 'محجوز للمراجعة',
          ledger: 'سجل المدفوعات',
          booking: 'الحجز',
          provider: 'المنظم',
          customer: 'العميل',
          status: 'الحالة',
          amount: 'المبلغ',
          commission: 'العمولة',
          payout: 'مستحق المنظم',
          noFinance: 'لا توجد مدفوعات بعد.',
          filters: 'فلاتر التقارير',
          allBookingStatuses: 'كل حالات الحجز',
          allPaymentStatuses: 'كل حالات الدفع',
          allPayouts: 'كل حالات الصرف',
          payoutReadyOnly: 'جاهز للصرف فقط',
          payoutBlockedOnly: 'محجوز للمراجعة فقط',
          fromDate: 'من تاريخ',
          toDate: 'إلى تاريخ',
          exportBookings: 'تصدير الحجوزات CSV',
          exportFinance: 'تصدير المالية CSV',
          exporting: 'جاري التصدير...'
        }
      : {
          title: 'Finance ledger',
          subtitle: 'Track payments, commissions, refunds, and provider payout readiness.',
          totalPaid: 'Total paid',
          pendingAmount: 'Pending payment',
          refundedAmount: 'Refunded',
          failedAmount: 'Failed',
          platformCommission: 'Platform commission',
          paidCommission: 'Paid commission',
          payoutReady: 'Payout ready',
          payoutBlocked: 'Blocked for review',
          ledger: 'Payment ledger',
          booking: 'Booking',
          provider: 'Provider',
          customer: 'Customer',
          status: 'Status',
          amount: 'Amount',
          commission: 'Commission',
          payout: 'Provider payout',
          noFinance: 'No payments yet.',
          filters: 'Report filters',
          allBookingStatuses: 'All booking statuses',
          allPaymentStatuses: 'All payment statuses',
          allPayouts: 'All payout states',
          payoutReadyOnly: 'Payout ready only',
          payoutBlockedOnly: 'Blocked only',
          fromDate: 'From date',
          toDate: 'To date',
          exportBookings: 'Export bookings CSV',
          exportFinance: 'Export finance CSV',
          exporting: 'Exporting...'
        };

  const bookingCopy =
    language === 'ar'
      ? {
          bookingManagement: 'إدارة الحجوزات',
          bookingManagementText:
            'راجع طلبات الحجز، حالة الدفع، واعتماد الطلبات من لوحة الإدارة.',
          booking: 'الحجز',
          customer: 'العميل',
          schedule: 'الموعد',
          bookingStatus: 'حالة الحجز',
          paymentStatus: 'حالة الدفع',
          amount: 'المبلغ',
          actions: 'الإجراءات',
          approveOwner: 'موافقة المنظم',
          rejectOwner: 'رفض المنظم',
          confirmAdmin: 'تأكيد الإدارة',
          cancelBooking: 'إلغاء',
          markPaid: 'مدفوع',
          markFailed: 'فشل الدفع',
          markNotRequired: 'لا يحتاج دفع',
          noBookings: 'لا توجد حجوزات حالياً.',
          pending: 'قيد المراجعة',
          ownerApproved: 'موافقة المنظم',
          ownerRejected: 'رفض المنظم',
          adminConfirmed: 'مؤكد من الإدارة',
          cancellationRequested: 'طلب إلغاء',
          cancelled: 'ملغي',
          cancellationReason: 'سبب طلب الإلغاء',
          cancellationRequestedAt: 'تاريخ طلب الإلغاء',
          paymentPending: 'بانتظار الدفع',
          paymentPaid: 'مدفوع',
          paymentFailed: 'فشل الدفع',
          paymentRefunded: 'مسترد',
          paymentNotRequired: 'لا يحتاج دفع',
          guests: 'ضيوف',
          preferredTime: 'الوقت المفضل',
          message: 'رسالة العميل',
          anonymousCustomer: 'عميل',
          auditTimeline: 'سجل الحجز',
          changedBy: 'بواسطة',
          noAuditEvents: 'لا يوجد سجل بعد'
        }
      : {
          bookingManagement: 'Booking management',
          bookingManagementText:
            'Review booking requests, payment state, and admin/provider approval from one queue.',
          booking: 'Booking',
          customer: 'Customer',
          schedule: 'Schedule',
          bookingStatus: 'Booking status',
          paymentStatus: 'Payment status',
          amount: 'Amount',
          actions: 'Actions',
          approveOwner: 'Provider approved',
          rejectOwner: 'Provider rejected',
          confirmAdmin: 'Admin confirmed',
          cancelBooking: 'Cancel',
          markPaid: 'Mark paid',
          markFailed: 'Mark failed',
          markNotRequired: 'No payment',
          noBookings: 'No bookings yet.',
          pending: 'Pending',
          ownerApproved: 'Provider approved',
          ownerRejected: 'Provider rejected',
          adminConfirmed: 'Admin confirmed',
          cancellationRequested: 'Cancellation requested',
          cancelled: 'Cancelled',
          cancellationReason: 'Cancellation reason',
          cancellationRequestedAt: 'Cancellation requested at',
          paymentPending: 'Payment pending',
          paymentPaid: 'Paid',
          paymentFailed: 'Payment failed',
          paymentRefunded: 'Refunded',
          paymentNotRequired: 'No payment required',
          guests: 'guests',
          preferredTime: 'Preferred time',
          message: 'Customer message',
          anonymousCustomer: 'Customer',
          auditTimeline: 'Audit timeline',
          changedBy: 'by',
          noAuditEvents: 'No audit events yet'
        };


    const adminOperationsCopy =
    language === 'ar'
      ? {
          aria: 'خريطة عمليات الإدارة',
          approvalsTitle: 'الموافقات',
          approvalsText: 'راجع العقارات والأنشطة المعلقة قبل النشر.',
          commandTitle: 'مركز التشغيل',
          commandText: 'تابع قوائم الجودة والمهام التشغيلية السريعة.',
          healthTitle: 'صحة النظام',
          healthText: 'راجع النظام، البريد، والثقة قبل فتح السوق للعامة.',
          metricsTitle: 'ملخص السوق',
          metricsText: 'أرقام النشر، الحجوزات، الشركاء، والعناصر التي تحتاج متابعة.',
          financeTitle: 'المالية',
          financeText: 'فلاتر التقارير، المدفوعات، العمولات، وجاهزية الصرف.',
          bookingsTitle: 'الحجوزات',
          bookingsText: 'حالات الحجز، الدفع، الإلغاء، وسجل التدقيق.',
          partnersTitle: 'الشركاء',
          partnersText: 'شركات التطوير ووكالات السفر المرتبطة بالسوق.',
          open: 'فتح القسم'
        }
      : {
          aria: 'Admin operations map',
          approvalsTitle: 'Approvals',
          approvalsText: 'Review pending listings and activities before publishing.',
          commandTitle: 'Command center',
          commandText: 'Track quality queues and fast operational tasks.',
          healthTitle: 'System health',
          healthText: 'Review system, email, and trust readiness before launch.',
          metricsTitle: 'Marketplace summary',
          metricsText: 'Publishing, booking, partner, and attention metrics.',
          financeTitle: 'Finance',
          financeText: 'Report filters, payments, commissions, and payout readiness.',
          bookingsTitle: 'Bookings',
          bookingsText: 'Booking status, payment state, cancellation, and audit history.',
          partnersTitle: 'Partners',
          partnersText: 'Developer companies and travel agencies connected to the marketplace.',
          open: 'Open section'
        };

  const adminWorkspaceHeaderCopy: Record<
    AdminWorkspaceKey,
    { eyebrow: string; title: string; description: string }
  > =
    language === 'ar'
      ? {
          approvals: {
            eyebrow: 'الإدارة',
            title: 'سير موافقات النشر',
            description: 'راجع العقارات والأنشطة ومشاريع المطورين قبل ظهورها للعامة.'
          },
          command: {
            eyebrow: 'مركز العمليات',
            title: 'مركز قرارات السوق',
            description: 'ابدأ من القرارات التي تؤثر على النشر، الثقة، الحجوزات، والجاهزية.'
          },
          health: {
            eyebrow: 'صحة النظام',
            title: 'جاهزية الإنتاج والثقة',
            description: 'راجع النظام، البريد، التقارير، والتحقق قبل التوسع التشغيلي.'
          },
          summary: {
            eyebrow: 'ملخص السوق',
            title: 'ملخص أداء السوق',
            description: 'نظرة سريعة على العقارات، الأنشطة، الشركاء، وقوائم المراجعة.'
          },
          finance: {
            eyebrow: 'المالية',
            title: 'عمليات المالية والمدفوعات',
            description: 'تابع المدفوعات، العمولات، التقارير، وجاهزية الصرف.'
          },
          bookings: {
            eyebrow: 'الحجوزات',
            title: 'عمليات الحجوزات',
            description: 'راجع الحجوزات، حالة الدفع، الإلغاء، وسجل التدقيق.'
          },
          partners: {
            eyebrow: 'الشركاء',
            title: 'إدارة الشركاء',
            description: 'أنشئ وأدر شركات التطوير ووكالات السفر المرتبطة بالسوق.'
          },
          reviewDetails: {
            eyebrow: 'قوائم المراجعة',
            title: 'قوائم مراجعة السوق',
            description: 'راجع العقارات والأنشطة والاستفسارات بتفاصيل أعمق.'
          }
        }
      : {
          approvals: {
            eyebrow: 'Admin',
            title: 'Approval workflow',
            description: 'Review listings, activities, and developer projects before they become public.'
          },
          command: {
            eyebrow: 'Operations command center',
            title: 'Marketplace decisions',
            description: 'Start with the decisions that affect publishing, trust, bookings, and readiness.'
          },
          health: {
            eyebrow: 'System health',
            title: 'Production health',
            description: 'Review system readiness, email delivery, reports, and verification before scale.'
          },
          summary: {
            eyebrow: 'Marketplace summary',
            title: 'Marketplace summary',
            description: 'Track publishing totals, activities, partners, and review workload.'
          },
          finance: {
            eyebrow: 'Finance',
            title: 'Finance operations',
            description: 'Track payments, commissions, reports, and provider payout readiness.'
          },
          bookings: {
            eyebrow: 'Bookings',
            title: 'Booking operations',
            description: 'Review booking requests, payment state, cancellations, and audit trail.'
          },
          partners: {
            eyebrow: 'Partners',
            title: 'Partner management',
            description: 'Create and manage developer companies and travel agencies connected to the marketplace.'
          },
          reviewDetails: {
            eyebrow: 'Review queues',
            title: 'Marketplace review queues',
            description: 'Review listings, activities, and inquiries with deeper operational detail.'
          }
        };

  const adminWorkspaceFocus = searchParams.get('workspace');
  const adminSectionFocus = searchParams.get('section');
  const activeAdminWorkspaceHeader = adminWorkspaceHeaderCopy[activeAdminWorkspace];

  function scrollToAdminSection(sectionId: string) {
    const workspace = adminSectionWorkspaceMap[sectionId];

    if (workspace) {
      setActiveAdminWorkspace(workspace);
    }

    window.setTimeout(() => {
      const section = document.getElementById(sectionId);

      if (!section) return;

      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      section.focus({
        preventScroll: true
      });
    }, workspace ? 80 : 0);
  }

  useEffect(() => {
    const workspace = parseAdminWorkspace(adminWorkspaceFocus);

    if (workspace) {
      setActiveAdminWorkspace(workspace);
    }

    if (adminSectionFocus && adminSectionWorkspaceMap[adminSectionFocus]) {
      window.setTimeout(() => scrollToAdminSection(adminSectionFocus), 120);
    }
  }, [adminSectionFocus, adminWorkspaceFocus]);

  const adminReportFilters = useMemo<AdminReportFilters>(
    () => ({
      status: adminBookingStatusFilter,
      paymentStatus: adminPaymentStatusFilter,
      payout: adminPayoutFilter,
      from: adminReportFrom,
      to: adminReportTo
    }),
    [
      adminBookingStatusFilter,
      adminPaymentStatusFilter,
      adminPayoutFilter,
      adminReportFrom,
      adminReportTo
    ]
  );

  function downloadAdminCsv(filename: string, csv: string) {
    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function exportAdminReport(type: 'bookings' | 'finance') {
    if (!token) return;

    try {
      setExportingReport(type);

      const csv =
        type === 'bookings'
          ? await exportAdminBookingsCsv(token, adminReportFilters)
          : await exportAdminFinanceCsv(token, adminReportFilters);

      downloadAdminCsv(
        type === 'bookings' ? 'lux-om-bookings.csv' : 'lux-om-finance-ledger.csv',
        csv
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof ApiError || error instanceof Error ? error.message : copy.error);
    } finally {
      setExportingReport('');
    }
  }

  async function loadAdminData() {
    if (!token) return;

    try {
      setLoading(true);
      setLoadError('');

      const [
  listingsResponse,
  activitiesResponse,
  inquiriesResponse,
  bookingsResponse,
  financeResponse,
  agenciesResponse,
  developersResponse
] = await Promise.all([
  getAdminListings(token),
  getAdminActivities(token),
  getAdminInquiries(token),
  getAdminBookings(token, adminReportFilters),
  getAdminFinance(token, adminReportFilters),
  getAdminTravelAgencies(token),
  getAdminDevelopers(token)
]);

setListings(listingsResponse.listings);
setActivities(activitiesResponse.activities);
setInquiries(inquiriesResponse.inquiries);
setBookings(bookingsResponse.bookings);
setFinance(financeResponse.finance);
setTravelAgencies(agenciesResponse.travelAgencies);
setDevelopers(developersResponse.developers);
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        setLoadError(error.message);
      } else {
        setLoadError(copy.error);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    language,
    adminBookingStatusFilter,
    adminPaymentStatusFilter,
    adminPayoutFilter,
    adminReportFrom,
    adminReportTo
  ]);

const metrics = useMemo(() => {
  const approvedListings = listings.filter((listing) =>
    isApprovedStatus(listing.status)
  ).length;

  const pendingListings = listings.filter((listing) =>
    isPendingStatus(listing.status)
  ).length;

  const pendingActivities = activities.filter((activity) =>
    isPendingStatus(activity.status)
  ).length;

  const featuredCount = listings.filter(
    (listing) =>
      isApprovedStatus(listing.status) &&
      listing.developer?.featured === true
  ).length;

  const featuredActivityCount = activities.filter(
    (activity) =>
      isApprovedStatus(activity.status) &&
      activity.travelAgency?.featured === true
  ).length;

  return {
    approvedListings,
    pendingListings,
    pendingActivities,
    featuredCount,
    featuredActivityCount,
    needsAttention: pendingListings + pendingActivities,
    verifiedAgencies: travelAgencies.filter((agency) => agency.verified).length,
    verifiedDevelopers: developers.filter((developer) => developer.verified).length,
    pendingBookings: bookings.filter((booking) => booking.status === 'PENDING').length
  };
}, [activities, bookings, developers, listings, travelAgencies]);



const filteredListings = useMemo(
    () =>
      listings.filter((listing) =>
        matchesReviewStatus(listing.status, reviewStatusFilter)
      ),
    [listings, reviewStatusFilter]
  );

  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) =>
        matchesReviewStatus(activity.status, reviewStatusFilter)
      ),
    [activities, reviewStatusFilter]
  );
  async function updateListingStatus(
    listingId: string,
    status: ListingStatus,
    rejectedReason?: string
  ) {
    if (!token) return;

    try {
      setUpdatingId(listingId);

      const response = await updateAdminListingStatus(
  listingId,
  {
    status,
    rejectedReason
  },
  token
);

      setListings((current) =>
        current.map((listing) => (listing.id === listingId ? response.listing : listing))
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof ApiError || error instanceof Error ? error.message : copy.error);
    } finally {
      setUpdatingId('');
    }
  }

  async function updateActivityStatus(
    activityId: string,
    status: ActivityStatus,
    rejectedReason?: string
  ) {
    if (!token) return;

    try {
      setUpdatingId(activityId);

      const response = await updateAdminActivityStatus(
  activityId,
  {
    status,
    rejectedReason
  },
  token
);

      setActivities((current) =>
        current.map((activity) => (activity.id === activityId ? response.activity : activity))
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof ApiError || error instanceof Error ? error.message : copy.error);
    } finally {
      setUpdatingId('');
    }
  }


  async function updateBookingStatus(
    bookingId: string,
    status: BookingStatus
  ) {
    if (!token) return;

    try {
      setUpdatingId(bookingId);

      const response = await updateAdminBookingStatus(
        bookingId,
        {
          status
        },
        token
      );

      setBookings((current) =>
        current.map((booking) =>
          booking.id === bookingId ? response.booking : booking
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : copy.error
      );
    } finally {
      setUpdatingId('');
    }
  }

  async function updateBookingPaymentStatus(
    paymentId: string,
    status: PaymentStatus
  ) {
    if (!token) return;

    try {
      setUpdatingId(paymentId);

      const response = await updateAdminBookingPaymentStatus(
        paymentId,
        {
          status
        },
        token
      );

      setBookings((current) =>
        current.map((booking) =>
          booking.payment?.id === paymentId
            ? {
                ...booking,
                payment: response.payment
              }
            : booking
        )
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : copy.error
      );
    } finally {
      setUpdatingId('');
    }
  }

async function createTravelAgency(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!token) return;

  try {
    setCreatingAgency(true);
    setAgencyFormError('');
    setAgencyFormSuccess('');

    const payload = {
      nameEn: agencyForm.nameEn.trim(),
      nameAr: optionalText(agencyForm.nameAr),
      descriptionEn: optionalText(agencyForm.descriptionEn),
      descriptionAr: optionalText(agencyForm.descriptionAr),
      headquartersEn: optionalText(agencyForm.headquartersEn),
      headquartersAr: optionalText(agencyForm.headquartersAr),
      logo: optionalText(agencyForm.logo),
      phone: optionalText(agencyForm.phone),
      email: optionalText(agencyForm.email),
      website: optionalText(agencyForm.website),
      establishedYear: agencyForm.establishedYear
        ? Number(agencyForm.establishedYear)
        : undefined,
      verified: agencyForm.verified,
      featured: agencyForm.featured
    };

    const response = await createAdminTravelAgency(payload, token);

    setTravelAgencies((current) => [response.travelAgency, ...current]);
    setAgencyForm(initialAgencyForm);
    setAgencyFormSuccess(copy.agencyCreated);
  } catch (error) {
    console.error(error);

    setAgencyFormError(
      error instanceof ApiError || error instanceof Error
        ? error.message
        : copy.error
    );
  } finally {
    setCreatingAgency(false);
  }
}

async function createDeveloper(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!token) return;

  try {
    setCreatingDeveloper(true);
    setDeveloperFormError('');
    setDeveloperFormSuccess('');

    const payload = {
      nameEn: developerForm.nameEn.trim(),
      nameAr: optionalText(developerForm.nameAr),
      descriptionEn: optionalText(developerForm.descriptionEn),
      descriptionAr: optionalText(developerForm.descriptionAr),
      headquartersEn: optionalText(developerForm.headquartersEn),
      headquartersAr: optionalText(developerForm.headquartersAr),
      logo: optionalText(developerForm.logo),
      phone: optionalText(developerForm.phone),
      email: optionalText(developerForm.email),
      website: optionalText(developerForm.website),
      establishedYear: developerForm.establishedYear
        ? Number(developerForm.establishedYear)
        : undefined,
      verified: developerForm.verified,
      featured: developerForm.featured
    };

    const response = await createAdminDeveloper(payload, token);

    setDevelopers((current) => [response.developer, ...current]);
    setDeveloperForm(initialDeveloperForm);
    setDeveloperFormSuccess(copy.developerCreated);
  } catch (error) {
    console.error(error);

    setDeveloperFormError(
      error instanceof ApiError || error instanceof Error
        ? error.message
        : copy.error
    );
  } finally {
    setCreatingDeveloper(false);
  }
}

async function updateDeveloperCompany(
  developerId: string,
  data: UpdateDeveloperPayload
) {
  if (!token) return;

  try {
    setUpdatingId(developerId);

    const response = await updateAdminDeveloper(
      developerId,
      data,
      token
    );

    setDevelopers((current) =>
      current.map((developer) =>
        developer.id === developerId ? response.developer : developer
      )
    );
  } catch (error) {
    console.error(error);

    alert(
      error instanceof ApiError || error instanceof Error
        ? error.message
        : copy.error
    );
  } finally {
    setUpdatingId('');
  }
}

async function deleteDeveloperCompany(developerId: string) {
  if (!token) return;

  const confirmed = window.confirm(copy.deleteDeveloper);

  if (!confirmed) return;

  try {
    setUpdatingId(developerId);

    await deleteAdminDeveloper(developerId, token);

    setDevelopers((current) =>
      current.filter((developer) => developer.id !== developerId)
    );
  } catch (error) {
    console.error(error);

    alert(
      error instanceof ApiError || error instanceof Error
        ? error.message
        : copy.error
    );
  } finally {
    setUpdatingId('');
  }
}

  async function updateTravelAgency(
    agencyId: string,
    data: UpdateTravelAgencyPayload
  ) {
    if (!token) return;

    try {
      setUpdatingId(agencyId);

      const response = await updateAdminTravelAgency(agencyId, data, token);

      setTravelAgencies((current) =>
        current.map((agency) => (agency.id === agencyId ? response.travelAgency : agency))
      );
    } catch (error) {
      console.error(error);
      alert(error instanceof ApiError || error instanceof Error ? error.message : copy.error);
    } finally {
      setUpdatingId('');
    }
  }

  async function deleteTravelAgency(agencyId: string) {
    if (!token) return;

    const confirmed = window.confirm(copy.deleteAgency);

    if (!confirmed) return;

    try {
      setUpdatingId(agencyId);

      await deleteAdminTravelAgency(agencyId, token);

      setTravelAgencies((current) => current.filter((agency) => agency.id !== agencyId));
    } catch (error) {
      console.error(error);
      alert(error instanceof ApiError || error instanceof Error ? error.message : copy.error);
    } finally {
      setUpdatingId('');
    }
  }

  function rejectListing(listingId: string) {
    const reason = window.prompt(copy.rejectReason, copy.defaultRejectReason);

    if (reason === null) return;

    void updateListingStatus(listingId, 'REJECTED', reason.trim() || copy.defaultRejectReason);
  }

  function rejectActivity(activityId: string) {
    const reason = window.prompt(copy.rejectReason, copy.defaultRejectReason);

    if (reason === null) return;

    void updateActivityStatus(activityId, 'REJECTED', reason.trim() || copy.defaultRejectReason);
  }

  function renderStatus(status?: string) {
    if (status === 'APPROVED') {
      return (
        <span className="status-pill approved">
          <CheckCircle2 size={14} aria-hidden="true" />
          {copy.approved}
        </span>
      );
    }

    if (status === 'REJECTED') {
      return (
        <span className="status-pill rejected">
          <XCircle size={14} aria-hidden="true" />
          {copy.rejected}
        </span>
      );
    }

    return (
      <span className="status-pill pending">
        <Clock3 size={14} aria-hidden="true" />
        {copy.pending}
      </span>
    );
  }


  function getBookingStatusLabel(status: BookingStatus) {
    if (status === 'OWNER_APPROVED') return bookingCopy.ownerApproved;
    if (status === 'OWNER_REJECTED') return bookingCopy.ownerRejected;
    if (status === 'ADMIN_CONFIRMED') return bookingCopy.adminConfirmed;
    if (status === 'CANCELLATION_REQUESTED') return bookingCopy.cancellationRequested;
    if (status === 'CANCELLED') return bookingCopy.cancelled;

    return bookingCopy.pending;
  }

  function getPaymentStatusLabel(status?: PaymentStatus) {
    if (status === 'PAID') return bookingCopy.paymentPaid;
    if (status === 'FAILED') return bookingCopy.paymentFailed;
    if (status === 'REFUNDED') return bookingCopy.paymentRefunded;
    if (status === 'NOT_REQUIRED') return bookingCopy.paymentNotRequired;

    return bookingCopy.paymentPending;
  }

  function renderBookingStatus(status: BookingStatus) {
    return (
      <span className={`status-pill ${getBookingTone(status)}`}>
        <BookingToneIcon status={status} />
        {getBookingStatusLabel(status)}
      </span>
    );
  }

  function renderPaymentStatus(status?: PaymentStatus) {
    return (
      <span className={`status-pill ${getBookingTone(status)}`}>
        <BookingToneIcon status={status} />
        {getPaymentStatusLabel(status)}
      </span>
    );
  }

  function getReviewStatusFilterLabel(filter: ReviewStatusFilter) {
    if (filter === 'ALL') return copy.allStatuses;
    if (filter === 'APPROVED') return copy.approvedOnly;
    if (filter === 'REJECTED') return copy.rejectedOnly;

    return copy.pendingOnly;
  }

  function renderReviewToolbar() {
    return (
      <div className="admin-review-toolbar" role="group" aria-label={copy.reviewFilter}>
        <span>{copy.reviewFilter}</span>

        <div className="admin-review-toolbar__filters">
          {reviewStatusFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`admin-review-filter ${
                reviewStatusFilter === filter ? 'admin-review-filter--active' : ''
              }`}
              onClick={() => setReviewStatusFilter(filter)}
            >
              {getReviewStatusFilterLabel(filter)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderAdminWorkspaceSwitcher() {
    const workspaceCards = [
      {
        key: 'approvals' as const,
        label: language === 'ar' ? 'الموافقات' : 'Approvals',
        text:
          language === 'ar'
            ? 'قرارات النشر ومشاريع المطورين قبل ظهورها للعامة.'
            : 'Publishing decisions and developer projects before they go public.',
        metric: metrics.needsAttention,
        sectionId: 'admin-approvals-workspace',
        icon: ShieldCheck
      },
      {
        key: 'command' as const,
        label: language === 'ar' ? 'مركز القرار' : 'Command center',
        text:
          language === 'ar'
            ? 'قوائم الثقة والجودة والمهام التشغيلية العاجلة.'
            : 'Trust queues, quality operations, and urgent marketplace tasks.',
        metric: metrics.needsAttention,
        sectionId: 'admin-command-center',
        icon: Inbox
      },
      {
        key: 'health' as const,
        label: language === 'ar' ? 'صحة النظام' : 'System health',
        text:
          language === 'ar'
            ? 'حالة الإنتاج، البريد، والثقة قبل الإطلاق.'
            : 'Production, email delivery, and trust readiness before launch.',
        metric: metrics.pendingBookings,
        sectionId: 'admin-health',
        icon: AlertCircle
      },
      {
        key: 'summary' as const,
        label: language === 'ar' ? 'ملخص السوق' : 'Marketplace summary',
        text:
          language === 'ar'
            ? 'نظرة سريعة على النشر، الشركاء، والعناصر التي تحتاج مراجعة.'
            : 'Quick marketplace totals for publishing, partners, and review load.',
        metric: listings.length + activities.length,
        sectionId: 'admin-overview-metrics',
        icon: Sparkles
      },
      {
        key: 'finance' as const,
        label: language === 'ar' ? 'المالية' : 'Finance',
        text:
          language === 'ar'
            ? 'التقارير، المدفوعات، العمولات، وجاهزية الصرف.'
            : 'Reports, payments, commissions, and payout readiness.',
        metric: finance?.ledger.length ?? 0,
        sectionId: 'admin-finance-section',
        icon: CreditCard
      },
      {
        key: 'bookings' as const,
        label: language === 'ar' ? 'الحجوزات' : 'Bookings',
        text:
          language === 'ar'
            ? 'حالات الحجز، الدفع، الإلغاء، وسجل التدقيق.'
            : 'Booking state, payment state, cancellations, and audit trail.',
        metric: bookings.length,
        sectionId: 'admin-bookings-section',
        icon: CalendarDays
      },
      {
        key: 'partners' as const,
        label: language === 'ar' ? 'الشركاء' : 'Partners',
        text:
          language === 'ar'
            ? 'شركات التطوير ووكالات السفر المرتبطة بالسوق.'
            : 'Developer companies and travel agencies connected to the marketplace.',
        metric: travelAgencies.length + developers.length,
        sectionId: 'admin-partners-section',
        icon: Building2
      },
      {
        key: 'reviewDetails' as const,
        label: language === 'ar' ? 'قوائم المراجعة' : 'Review queues',
        text:
          language === 'ar'
            ? 'جداول العقارات والأنشطة والاستفسارات للمراجعة التفصيلية.'
            : 'Detailed listing, activity, and inquiry queues for deeper review.',
        metric: filteredListings.length + filteredActivities.length + inquiries.length,
        sectionId: 'admin-review-detail-queues',
        icon: ShieldCheck
      }
    ];

    return (
      <section className="admin-workspace-shell" aria-label={language === 'ar' ? 'مساحات عمل الإدارة' : 'Admin workspaces'}>
        <div className="admin-workspace-shell__header">
          <div>
            <p className="eyebrow">{language === 'ar' ? 'مساحات العمل' : 'Workspace control'}</p>
            <h2>{language === 'ar' ? 'افتح مساحة واحدة بدل صفحة طويلة.' : 'Open one operations workspace at a time.'}</h2>
            <p>
              {language === 'ar'
                ? 'استخدم هذه المساحات للتنقل بين التشغيل، الصحة، المالية، الحجوزات، الشركاء، والمراجعة التفصيلية بدون فقدان السياق.'
                : 'Use these workspaces to move between operations, health, finance, bookings, partners, and detailed review without working through one endless page.'}
            </p>
          </div>
        </div>

        <div className="admin-workspace-switcher" role="tablist" aria-label={language === 'ar' ? 'اختيار مساحة العمل' : 'Choose admin workspace'}>
          {workspaceCards.map((workspace) => {
            const Icon = workspace.icon;
            const isActive = activeAdminWorkspace === workspace.key;

            return (
              <button
                aria-selected={isActive}
                className={isActive ? 'admin-workspace-tab admin-workspace-tab--active' : 'admin-workspace-tab'}
                key={`workspace-${workspace.key}`}
                role="tab"
                type="button"
                onClick={() => {
                  setActiveAdminWorkspace(workspace.key);
                  scrollToAdminSection(workspace.sectionId);
                }}
              >
                <span className="admin-workspace-tab__icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <span>
                  <strong>{workspace.label}</strong>
                  <small>{workspace.text}</small>
                </span>
                <em>{workspace.metric}</em>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderAdminCommandBriefing() {
    const commandHighlights = [
      {
        label: language === 'ar' ? 'قرارات النشر' : 'Publishing decisions',
        value: metrics.needsAttention,
        text:
          language === 'ar'
            ? 'عقارات وأنشطة تنتظر قراراً يدوياً قبل النشر.'
            : 'Listings and activities waiting for a manual publishing decision.',
        sectionId: 'admin-approvals-workspace',
        tone: metrics.needsAttention > 0 ? 'urgent' : 'healthy',
        icon: ShieldCheck
      },
      {
        label: language === 'ar' ? 'مشاريع المطورين' : 'Developer projects',
        value: language === 'ar' ? 'مراجعة' : 'Review',
        text:
          language === 'ar'
            ? 'اعتماد صفحات المشاريع وربطها بوحدات البيع.'
            : 'Approve project pages and inspect their linked unit inventory.',
        sectionId: 'admin-approvals-workspace',
        tone: 'primary',
        icon: Building2
      },
      {
        label: language === 'ar' ? 'الحجوزات' : 'Bookings',
        value: metrics.pendingBookings,
        text:
          language === 'ar'
            ? 'طلبات تحتاج متابعة من الإدارة أو المنظم.'
            : 'Requests that may need admin or provider follow-up.',
        sectionId: 'admin-bookings-section',
        tone: metrics.pendingBookings > 0 ? 'attention' : 'healthy',
        icon: CalendarDays
      },
      {
        label: language === 'ar' ? 'المالية' : 'Finance',
        value: finance?.summary.payoutBlockedCount ?? 0,
        text:
          language === 'ar'
            ? 'مدفوعات أو مستحقات محجوزة للمراجعة.'
            : 'Payments or payout items blocked for review.',
        sectionId: 'admin-finance-section',
        tone: (finance?.summary.payoutBlockedCount ?? 0) > 0 ? 'attention' : 'healthy',
        icon: CreditCard
      }
    ] as const;

    return (
      <section className="admin-command-briefing" aria-label={adminOperationsCopy.aria}>
        <div className="admin-command-briefing__header">
          <div>
            <p className="eyebrow">{language === 'ar' ? 'غرفة العمليات' : 'Operations command center'}</p>
            <h2>{language === 'ar' ? 'ابدأ بالقرارات التي تؤثر على السوق اليوم.' : 'Start with the decisions that affect the marketplace today.'}</h2>
            <p>
              {language === 'ar'
                ? 'واجهة مركّزة تجمع النشر، المشاريع، الحجوزات، المالية، الصحة، والثقة حتى لا تضيع فرق الإدارة في صفحة طويلة.'
                : 'A focused command layer groups publishing, projects, bookings, finance, health, and trust so operations teams do not work from one long stack.'}
            </p>
          </div>

          <button
            className="button-link button-link--secondary"
            type="button"
            onClick={loadAdminData}
          >
            {language === 'ar' ? 'تحديث البيانات' : 'Refresh operations'}
          </button>
        </div>

        <div className="admin-command-kpi-grid">
          {commandHighlights.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={'admin-command-kpi admin-command-kpi--' + item.tone}
                key={`${item.sectionId}-${item.label}`}
                type="button"
                onClick={() => scrollToAdminSection(item.sectionId)}
              >
                <span className="admin-command-kpi__icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="admin-command-kpi__body">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.text}</small>
                </span>
              </button>
            );
          })}
        </div>

        <nav className="admin-command-jumpbar" aria-label={adminOperationsCopy.aria}>
          
        </nav>
      </section>
    );
  }

  function renderPublishingApprovalCockpit() {
    const pendingListings = listings
      .filter((listing) => isPendingStatus(listing.status))
      .sort((first, second) =>
        getPublishingStatusPriority(first.status) -
        getPublishingStatusPriority(second.status)
      )
      .slice(0, 4);
    const pendingActivities = activities
      .filter((activity) => isPendingStatus(activity.status))
      .sort((first, second) =>
        getPublishingStatusPriority(first.status) -
        getPublishingStatusPriority(second.status)
      )
      .slice(0, 4);
    const pendingListingCount = listings.filter((listing) => isPendingStatus(listing.status)).length;
    const pendingActivityCount = activities.filter((activity) => isPendingStatus(activity.status)).length;
    const approvedPublishingCount =
      listings.filter((listing) => listing.status === 'APPROVED').length +
      activities.filter((activity) => activity.status === 'APPROVED').length;
    const rejectedPublishingCount =
      listings.filter((listing) => listing.status === 'REJECTED').length +
      activities.filter((activity) => activity.status === 'REJECTED').length;

    return (
      <section
        className="publishing-approval-cockpit"

        id="admin-approvals"

        tabIndex={-1}

        aria-labelledby="publishing-approval-title"
      >
        <div className="publishing-approval-cockpit__header">
          <div>
            <p className="eyebrow">Publishing approvals</p>
            <h2 id="publishing-approval-title">Manual approval cockpit</h2>
            <p>
              Prioritize pending listings and activities before they appear in the
              public marketplace. Decisions here are manual lux.om publishing
              approvals, not government or external verification.
            </p>
          </div>

          <div className="publishing-approval-cockpit__badge">
            <ShieldCheck size={22} aria-hidden="true" />
            <span>{pendingListingCount + pendingActivityCount} pending</span>
          </div>
        </div>

        <div className="publishing-approval-metrics">
          <article>
            <span>Pending listings</span>
            <strong>{pendingListingCount}</strong>
          </article>
          <article>
            <span>Pending activities</span>
            <strong>{pendingActivityCount}</strong>
          </article>
          <article>
            <span>Approved public items</span>
            <strong>{approvedPublishingCount}</strong>
          </article>
          <article>
            <span>Rejected items</span>
            <strong>{rejectedPublishingCount}</strong>
          </article>
        </div>

        <div className="publishing-approval-columns">
          <div className="publishing-approval-column">
            <div className="publishing-approval-column__title">
              <Building2 size={18} aria-hidden="true" />
              <h3>Listings needing decision</h3>
            </div>

            {pendingListings.length ? (
              pendingListings.map((listing, index) => {
                const owner = listing.developer
                  ? language === 'ar'
                    ? listing.developer.nameAr || listing.developer.nameEn
                    : listing.developer.nameEn || listing.developer.nameAr
                  : language === 'ar'
                    ? listing.developerNameAr ||
                      listing.developerNameEn ||
                      listing.owner?.name ||
                      copy.privateOwner
                    : listing.developerNameEn ||
                      listing.developerNameAr ||
                      listing.owner?.name ||
                      copy.privateOwner;
                const qualityScore = getListingQualityScore(listing, index);

                return (
                  <article key={listing.id} className="publishing-approval-item">
                    <div>
                      <strong>{getListingTitle(listing, language)}</strong>
                      <span>
                        {getListingLocation(listing, language)} · {getListingType(listing, language)}
                      </span>
                      <small>Owner: {owner}</small>
                      <small>Readiness score: {qualityScore}%</small>
                    </div>

                    <div className="publishing-approval-item__status">
                      {renderStatus(listing.status)}
                    </div>

                    <div className="publishing-approval-item__actions">
                      <ButtonLink to={`/listings/${listing.slug}`} variant="ghost">
                        <Eye size={15} aria-hidden="true" />
                        Open
                      </ButtonLink>
                      <button
                        type="button"
                        className="button-link button-link--secondary"
                        disabled={updatingId === listing.id}
                        onClick={() => updateListingStatus(listing.id, 'APPROVED')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="button-link button-link--secondary"
                        disabled={updatingId === listing.id}
                        onClick={() => rejectListing(listing.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="trust-note">No listing approvals are currently pending.</p>
            )}
          </div>

          <div className="publishing-approval-column">
            <div className="publishing-approval-column__title">
              <CalendarDays size={18} aria-hidden="true" />
              <h3>Activities needing decision</h3>
            </div>

            {pendingActivities.length ? (
              pendingActivities.map((activity, index) => {
                const qualityScore = getActivityQualityScore(activity, index);

                return (
                  <article key={activity.id} className="publishing-approval-item">
                    <div>
                      <strong>{getActivityTitle(activity, language)}</strong>
                      <span>
                        {getActivityLocation(activity, language)} · {getActivityCategory(activity, language)}
                      </span>
                      <small>Provider: {getActivityProvider(activity, language)}</small>
                      <small>Readiness score: {qualityScore}%</small>
                    </div>

                    <div className="publishing-approval-item__status">
                      {renderStatus(activity.status)}
                    </div>

                    <div className="publishing-approval-item__actions">
                      <ButtonLink to={`/activities/${activity.slug}`} variant="ghost">
                        <Eye size={15} aria-hidden="true" />
                        Open
                      </ButtonLink>
                      <button
                        type="button"
                        className="button-link button-link--secondary"
                        disabled={updatingId === activity.id}
                        onClick={() => updateActivityStatus(activity.id, 'APPROVED')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="button-link button-link--secondary"
                        disabled={updatingId === activity.id}
                        onClick={() => rejectActivity(activity.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="trust-note">No activity approvals are currently pending.</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
  <section className={'page-section container admin-page admin-page--command-center admin-page--workspace-' + activeAdminWorkspace}>
      <SectionHeader
        eyebrow={activeAdminWorkspaceHeader.eyebrow}
        title={activeAdminWorkspaceHeader.title}
        description={activeAdminWorkspaceHeader.description}
      />

      <div className="admin-hero-card admin-hero-card--command">
        <div>
          <p className="eyebrow">{copy.marketplaceControl}</p>
          <h2>{copy.heroTitle}</h2>
          <p>{copy.heroText}</p>
        </div>

        <div className="admin-hero-badge">
          <ShieldCheck size={24} aria-hidden="true" />
          <span>{copy.qualityGate}</span>
        </div>
      </div>

      {!loading && !loadError ? renderAdminCommandBriefing() : null}

      {!loading && !loadError ? renderAdminWorkspaceSwitcher() : null}

      {!loading && !loadError ? (
        <div
          id="admin-approvals-workspace"
          className="admin-anchor-section admin-workspace-panel admin-approvals-workspace"
          tabIndex={-1}
        >
          {renderPublishingApprovalCockpit()}
          {token ? <AdminDeveloperProjectReviewPanel token={token} /> : null}
        </div>
      ) : null}

      <div id="admin-command-center" className="admin-anchor-section admin-workspace-panel" tabIndex={-1}>


        <Stage8AdminCommandCenter token={token} />


      </div>

      {loading ? (
        <div className="empty-state empty-state--premium">
          <Sparkles size={34} aria-hidden="true" />
          <h2>{copy.loading}</h2>
        </div>
      ) : null}

      {loadError ? (
        <div className="empty-state empty-state--premium">
          <AlertCircle size={34} aria-hidden="true" />
          <h2>{loadError}</h2>
          <button className="button-link button-link--secondary" type="button" onClick={loadAdminData}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
        <div id="admin-health" className="admin-anchor-section admin-workspace-panel" tabIndex={-1}>
        {token ? <AdminSystemHealthPanel token={token} /> : null}

        <AdminOperationsTrustPanel />

          {token ? <AdminEmailDeliveryHealthPanel token={token} /> : null}
        </div>

          <div id="admin-overview-metrics" className="dashboard-grid admin-overview-metrics admin-workspace-panel" tabIndex={-1}>
            <article className="metric-card metric-card--accent">
              <span>
                <CheckCircle2 size={18} aria-hidden="true" />
                {t.admin.approved}
              </span>
              <strong>{metrics.approvedListings}</strong>
              <small>{copy.publicReadyListings}</small>
            </article>

            <article className="metric-card">
              <span>
                <Clock3 size={18} aria-hidden="true" />
                {t.admin.pending}
              </span>
              <strong>{metrics.pendingListings}</strong>
              <small>{copy.waitingForReview}</small>
            </article>

            <article className="metric-card">
              <span>
                <Sparkles size={18} aria-hidden="true" />
                {copy.featured}
              </span>
              <strong>{metrics.featuredCount}</strong>
              <small>{copy.homepageHighlights}</small>
            </article>

            <article className="metric-card">
              <span>
                <Sparkles size={18} aria-hidden="true" />
                {copy.activitiesQueue}
              </span>
              <strong>{activities.length}</strong>
              <small>
                {metrics.featuredActivityCount} {copy.featuredActivities}
              </small>
            </article>

            <article className="metric-card">
              <span>
                <CreditCard size={18} aria-hidden="true" />
                {bookingCopy.bookingManagement}
              </span>
              <strong>{bookings.length}</strong>
              <small>{metrics.pendingBookings} {bookingCopy.pending}</small>
            </article>

            <article className="metric-card">
              <span>
                <Building2 size={18} aria-hidden="true" />
                {copy.travelAgencies}
              </span>
              <strong>{metrics.verifiedAgencies}</strong>
              <small>{copy.verifiedAgency}</small>
            </article>

            <article className="metric-card">
              <span>
                <AlertCircle size={18} aria-hidden="true" />
                {copy.needsAttention}
              </span>
              <strong>{metrics.needsAttention}</strong>
              <small>{copy.missingVerification}</small>
            </article>
            <article className="metric-card">
  <span>
    <Building2 size={18} aria-hidden="true" />
    {copy.developers}
  </span>

  <strong>{metrics.verifiedDevelopers}</strong>
  <small>{copy.verifiedDevelopers}</small>
</article>
          </div>


          <div
              id="admin-finance-section"
              className="table-card table-card--premium admin-report-filters-card admin-workspace-panel"
              tabIndex={-1}
            >
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{adminFinanceCopy.filters}</p>
                <h2>{adminFinanceCopy.filters}</h2>
              </div>

              <div className="admin-report-export-actions">
                <button
                  type="button"
                  className="button-link button-link--secondary"
                  disabled={exportingReport !== ''}
                  onClick={() => void exportAdminReport('bookings')}
                >
                  {exportingReport === 'bookings'
                    ? adminFinanceCopy.exporting
                    : adminFinanceCopy.exportBookings}
                </button>

                <button
                  type="button"
                  className="button-link button-link--primary"
                  disabled={exportingReport !== ''}
                  onClick={() => void exportAdminReport('finance')}
                >
                  {exportingReport === 'finance'
                    ? adminFinanceCopy.exporting
                    : adminFinanceCopy.exportFinance}
                </button>
              </div>
            </div>

            <div className="admin-report-filters-grid">
              <label>
                <span>{bookingCopy.bookingStatus}</span>
                <select
                  value={adminBookingStatusFilter}
                  onChange={(event) =>
                    setAdminBookingStatusFilter(event.target.value as BookingStatus | 'ALL')
                  }
                >
                  <option value="ALL">{adminFinanceCopy.allBookingStatuses}</option>
                  <option value="PENDING">{bookingCopy.pending}</option>
                  <option value="OWNER_APPROVED">{bookingCopy.ownerApproved}</option>
                  <option value="OWNER_REJECTED">{bookingCopy.ownerRejected}</option>
                  <option value="ADMIN_CONFIRMED">{bookingCopy.adminConfirmed}</option>
                  <option value="CANCELLATION_REQUESTED">{bookingCopy.cancellationRequested}</option>
                  <option value="CANCELLED">{bookingCopy.cancelled}</option>
                </select>
              </label>

              <label>
                <span>{bookingCopy.paymentStatus}</span>
                <select
                  value={adminPaymentStatusFilter}
                  onChange={(event) =>
                    setAdminPaymentStatusFilter(event.target.value as PaymentStatus | 'ALL')
                  }
                >
                  <option value="ALL">{adminFinanceCopy.allPaymentStatuses}</option>
                  <option value="PENDING">{bookingCopy.paymentPending}</option>
                  <option value="PAID">{bookingCopy.paymentPaid}</option>
                  <option value="FAILED">{bookingCopy.paymentFailed}</option>
                  <option value="REFUNDED">{bookingCopy.paymentRefunded}</option>
                  <option value="NOT_REQUIRED">{bookingCopy.paymentNotRequired}</option>
                </select>
              </label>

              <label>
                <span>{adminFinanceCopy.payout}</span>
                <select
                  value={adminPayoutFilter}
                  onChange={(event) =>
                    setAdminPayoutFilter(event.target.value as 'ALL' | 'READY' | 'BLOCKED')
                  }
                >
                  <option value="ALL">{adminFinanceCopy.allPayouts}</option>
                  <option value="READY">{adminFinanceCopy.payoutReadyOnly}</option>
                  <option value="BLOCKED">{adminFinanceCopy.payoutBlockedOnly}</option>
                </select>
              </label>

              <label>
                <span>{adminFinanceCopy.fromDate}</span>
                <input
                  type="date"
                  value={adminReportFrom}
                  onChange={(event) => setAdminReportFrom(event.target.value)}
                />
              </label>

              <label>
                <span>{adminFinanceCopy.toDate}</span>
                <input
                  type="date"
                  value={adminReportTo}
                  onChange={(event) => setAdminReportTo(event.target.value)}
                />
              </label>
            </div>
          </div>


          {finance ? (
            <div className="table-card table-card--premium admin-finance-card admin-workspace-panel">
              <div className="table-card__header">
                <div>
                  <p className="eyebrow">{adminFinanceCopy.title}</p>
                  <h2>{adminFinanceCopy.title}</h2>
                  <p>{adminFinanceCopy.subtitle}</p>
                </div>
              </div>

              <div className="admin-finance-summary">
                <article>
                  <span>{adminFinanceCopy.totalPaid}</span>
                  <strong>{formatAdminFinanceAmount(finance.summary.paidAmount, language)}</strong>
                </article>

                <article>
                  <span>{adminFinanceCopy.pendingAmount}</span>
                  <strong>{formatAdminFinanceAmount(finance.summary.pendingAmount, language)}</strong>
                </article>

                <article>
                  <span>{adminFinanceCopy.refundedAmount}</span>
                  <strong>{formatAdminFinanceAmount(finance.summary.refundedAmount, language)}</strong>
                </article>

                <article>
                  <span>{adminFinanceCopy.platformCommission}</span>
                  <strong>{formatAdminFinanceAmount(finance.summary.totalCommission, language)}</strong>
                </article>

                <article>
                  <span>{adminFinanceCopy.payoutReady}</span>
                  <strong>{formatAdminFinanceAmount(finance.summary.payoutReadyAmount, language)}</strong>
                  <small>{finance.summary.payoutReadyCount}</small>
                </article>

                <article>
                  <span>{adminFinanceCopy.payoutBlocked}</span>
                  <strong>{formatAdminFinanceAmount(finance.summary.payoutBlockedAmount, language)}</strong>
                  <small>{finance.summary.payoutBlockedCount}</small>
                </article>
              </div>

              <div className="responsive-table admin-finance-ledger">
                <table>
                  <thead>
                    <tr>
                      <th>{adminFinanceCopy.booking}</th>
                      <th>{adminFinanceCopy.provider}</th>
                      <th>{adminFinanceCopy.customer}</th>
                      <th>{adminFinanceCopy.status}</th>
                      <th>{adminFinanceCopy.amount}</th>
                      <th>{adminFinanceCopy.commission}</th>
                      <th>{adminFinanceCopy.payout}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {finance.ledger.length > 0 ? (
                      finance.ledger.slice(0, 12).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.bookingTitle}</strong>
                            <span>{item.bookingStatus ? renderBookingStatus(item.bookingStatus) : '—'}</span>
                          </td>

                          <td>
                            <strong>{item.providerName || '—'}</strong>
                            {item.providerEmail ? <span>{item.providerEmail}</span> : null}
                          </td>

                          <td>
                            <strong>{item.customerName || '—'}</strong>
                            {item.customerEmail ? <span>{item.customerEmail}</span> : null}
                          </td>

                          <td>{renderPaymentStatus(item.status)}</td>

                          <td>{formatAdminFinanceAmount(item.amount, language)}</td>

                          <td>{formatAdminFinanceAmount(item.commission, language)}</td>

                          <td>
                            <span className={item.payoutReady ? 'admin-finance-ready' : item.payoutBlocked ? 'admin-finance-blocked' : ''}>
                              {formatAdminFinanceAmount(item.providerPayoutAmount, language)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>{adminFinanceCopy.noFinance}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}


          <div
              id="admin-bookings-section"
              className="table-card table-card--premium admin-bookings-card admin-workspace-panel"
              tabIndex={-1}
            >
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{bookingCopy.bookingManagement}</p>
                <h2>{bookingCopy.bookingManagement}</h2>
                <p>{bookingCopy.bookingManagementText}</p>
              </div>
            </div>

            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>{bookingCopy.booking}</th>
                    <th>{bookingCopy.customer}</th>
                    <th>{bookingCopy.schedule}</th>
                    <th>{bookingCopy.bookingStatus}</th>
                    <th>{bookingCopy.paymentStatus}</th>
                    <th>{bookingCopy.amount}</th>
                    <th>{bookingCopy.actions}</th>
                  </tr>
                </thead>

                <tbody>
                  {bookings.map((booking) => {
                    const paymentId = booking.payment?.id;
                    const isUpdatingBooking = updatingId === booking.id;
                    const isUpdatingPayment = paymentId ? updatingId === paymentId : false;

                    return (
                      <tr key={booking.id}>
                        <td>
                          <strong>{getAdminBookingTitle(booking, language)}</strong>
                          <span>
                            {getAdminBookingKind(booking, language)}
                            {getAdminBookingSubtitle(booking, language)
                              ? ` · ${getAdminBookingSubtitle(booking, language)}`
                              : ''}
                          </span>

                          {booking.message ? (
                            <span className="admin-rejection-note">
                              {bookingCopy.message}: {booking.message}
                            </span>
                          ) : null}

                          {booking.cancellationReason ? (
                            <span className="admin-rejection-note">
                              {bookingCopy.cancellationReason}: {booking.cancellationReason}
                              {booking.cancellationRequestedAt
                                ? ` · ${bookingCopy.cancellationRequestedAt}: ${formatAdminBookingDateTime(
                                    booking.cancellationRequestedAt,
                                    language
                                  )}`
                                : ''}
                            </span>
                          ) : null}

                          <div className="admin-booking-timeline">
                            <strong>{bookingCopy.auditTimeline}</strong>

                            {booking.events?.length ? (
                              booking.events.map((event) => (
                                <span className="admin-booking-timeline__event" key={event.id}>
                                  <BookingToneIcon status={event.toStatus || undefined} />

                                  <span>
                                    {getAdminBookingEventLabel(event.type, language)}
                                    {event.actor?.name
                                      ? ` · ${bookingCopy.changedBy} ${event.actor.name}`
                                      : ''}
                                    <small>
                                      {formatAdminBookingDateTime(event.createdAt, language)}
                                    </small>
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="admin-booking-timeline__empty">
                                {bookingCopy.noAuditEvents}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <strong>{booking.contactName || bookingCopy.anonymousCustomer}</strong>

                          {booking.contactEmail ? (
                            <span className="inline-info">
                              <Mail size={14} aria-hidden="true" />
                              {booking.contactEmail}
                            </span>
                          ) : null}

                          {booking.contactPhone ? (
                            <span className="inline-info">
                              <Phone size={14} aria-hidden="true" />
                              {booking.contactPhone}
                            </span>
                          ) : null}
                        </td>

                        <td>
                          <span className="inline-info">
                            <CalendarDays size={14} aria-hidden="true" />
                            {formatAdminBookingDate(booking.scheduledDate, language)}
                          </span>

                          {booking.preferredTime ? (
                            <span className="inline-info">
                              <Clock3 size={14} aria-hidden="true" />
                              {bookingCopy.preferredTime}: {booking.preferredTime}
                            </span>
                          ) : null}

                          <span className="inline-info">
                            <Users size={14} aria-hidden="true" />
                            {booking.guests} {bookingCopy.guests}
                          </span>
                        </td>

                        <td>{renderBookingStatus(booking.status)}</td>

                        <td>{renderPaymentStatus(booking.payment?.status)}</td>

                        <td>
                          <span className="inline-info">
                            <CreditCard size={14} aria-hidden="true" />
                            {formatAdminPaymentAmount(booking)}
                          </span>
                        </td>

                        <td>
                          <div className="admin-booking-actions">
                            <button
                              type="button"
                              className="admin-booking-action admin-booking-action--approve"
                              disabled={isUpdatingBooking}
                              onClick={() => void updateBookingStatus(booking.id, 'OWNER_APPROVED')}
                            >
                              {bookingCopy.approveOwner}
                            </button>

                            <button
                              type="button"
                              className="admin-booking-action admin-booking-action--confirm"
                              disabled={isUpdatingBooking}
                              onClick={() => void updateBookingStatus(booking.id, 'ADMIN_CONFIRMED')}
                            >
                              {bookingCopy.confirmAdmin}
                            </button>

                            <button
                              type="button"
                              className="admin-booking-action admin-booking-action--reject"
                              disabled={isUpdatingBooking}
                              onClick={() => void updateBookingStatus(booking.id, 'OWNER_REJECTED')}
                            >
                              {bookingCopy.rejectOwner}
                            </button>

                            <button
                              type="button"
                              className="admin-booking-action admin-booking-action--muted"
                              disabled={isUpdatingBooking}
                              onClick={() => void updateBookingStatus(booking.id, 'CANCELLED')}
                            >
                              {bookingCopy.cancelBooking}
                            </button>

                            {paymentId ? (
                              <>
                                <button
                                  type="button"
                                  className="admin-booking-action admin-booking-action--approve"
                                  disabled={isUpdatingPayment}
                                  onClick={() => void updateBookingPaymentStatus(paymentId, 'PAID')}
                                >
                                  {bookingCopy.markPaid}
                                </button>

                                <button
                                  type="button"
                                  className="admin-booking-action admin-booking-action--reject"
                                  disabled={isUpdatingPayment}
                                  onClick={() => void updateBookingPaymentStatus(paymentId, 'FAILED')}
                                >
                                  {bookingCopy.markFailed}
                                </button>

                                <button
                                  type="button"
                                  className="admin-booking-action admin-booking-action--muted"
                                  disabled={isUpdatingPayment}
                                  onClick={() => void updateBookingPaymentStatus(paymentId, 'NOT_REQUIRED')}
                                >
                                  {bookingCopy.markNotRequired}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{bookingCopy.noBookings}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {activeAdminWorkspace === 'partners' ? (
            <>
<div id="admin-partners-section" className="table-card table-card--premium admin-workspace-panel" tabIndex={-1}>
  <div className="table-card__header">
    <div>
      <p className="eyebrow">{copy.developerManagement}</p>
      <h2>{copy.developers}</h2>
      <p>{copy.developerManagementText}</p>
    </div>

    <ButtonLink to="/developers" variant="ghost">
      <Eye size={16} aria-hidden="true" />
      {copy.viewMarketplace}
    </ButtonLink>
  </div>

  <form className="admin-partner-form" onSubmit={createDeveloper}>
    <div className="admin-partner-form__header">
      <div>
        <span className="admin-partner-form__icon">
          <Building2 size={22} aria-hidden="true" />
        </span>

        <div>
          <h3>{copy.createDeveloper}</h3>
          <p>{copy.developerDetailsText}</p>
        </div>
      </div>

      <span className="admin-partner-form__required">
        * {copy.requiredField}
      </span>
    </div>

    {developerFormError ? (
      <div className="admin-form-feedback admin-form-feedback--error" role="alert">
        <AlertCircle size={18} aria-hidden="true" />
        <span>{developerFormError}</span>
      </div>
    ) : null}

    {developerFormSuccess ? (
      <div
        className="admin-form-feedback admin-form-feedback--success"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 size={18} aria-hidden="true" />
        <span>{developerFormSuccess}</span>
      </div>
    ) : null}

    <fieldset className="admin-partner-form__fieldset" disabled={creatingDeveloper}>
      <section className="admin-form-section">
        <div className="admin-form-section__heading">
          <div>
            <span>EN</span>

            <div>
              <h4>{copy.englishContent}</h4>
              <p>{copy.developerDetails}</p>
            </div>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>
              {copy.developerName}
              <strong aria-hidden="true">*</strong>
            </span>

            <input
              required
              value={developerForm.nameEn}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  nameEn: event.target.value
                }))
              }
              placeholder="Oman Horizon Developments"
            />
          </label>

          <label className="admin-form-field">
            <span>{copy.headquarters}</span>

            <input
              value={developerForm.headquartersEn}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  headquartersEn: event.target.value
                }))
              }
              placeholder="Muscat, Oman"
            />
          </label>

          <label className="admin-form-field admin-form-field--full">
            <span>{copy.description}</span>

            <textarea
              rows={5}
              value={developerForm.descriptionEn}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  descriptionEn: event.target.value
                }))
              }
              placeholder="A premium development company delivering residential and mixed-use projects in Oman."
            />
          </label>
        </div>
      </section>

      <section className="admin-form-section admin-form-section--rtl">
        <div className="admin-form-section__heading">
          <div>
            <span>ع</span>

            <div>
              <h4>{copy.arabicContent}</h4>
              <p>{copy.developerDetails}</p>
            </div>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>{copy.developerNameAr}</span>

            <input
              dir="rtl"
              value={developerForm.nameAr}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  nameAr: event.target.value
                }))
              }
              placeholder="آفاق عُمان للتطوير"
            />
          </label>

          <label className="admin-form-field">
            <span>{copy.headquartersAr}</span>

            <input
              dir="rtl"
              value={developerForm.headquartersAr}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  headquartersAr: event.target.value
                }))
              }
              placeholder="مسقط، عُمان"
            />
          </label>

          <label className="admin-form-field admin-form-field--full">
            <span>{copy.descriptionAr}</span>

            <textarea
              dir="rtl"
              rows={5}
              value={developerForm.descriptionAr}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  descriptionAr: event.target.value
                }))
              }
              placeholder="شركة تطوير متخصصة في المشاريع السكنية ومتعددة الاستخدامات في عُمان."
            />
          </label>
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section__heading">
          <div>
            <span>
              <Phone size={17} aria-hidden="true" />
            </span>

            <div>
              <h4>{copy.contactDetails}</h4>
              <p>{copy.developerManagementText}</p>
            </div>
          </div>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>{copy.phone}</span>

            <input
              type="tel"
              dir="ltr"
              value={developerForm.phone}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  phone: event.target.value
                }))
              }
              placeholder="+968 9000 0000"
            />
          </label>

          <label className="admin-form-field">
            <span>{copy.email}</span>

            <input
              type="email"
              dir="ltr"
              value={developerForm.email}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
              placeholder="developer@lux.om"
            />
          </label>

          <label className="admin-form-field">
            <span>{copy.website}</span>

            <input
              type="url"
              dir="ltr"
              value={developerForm.website}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  website: event.target.value
                }))
              }
              placeholder="https://developer.om"
            />
          </label>

          <label className="admin-form-field">
            <span>{copy.establishedYear}</span>

            <input
              type="number"
              min="1800"
              max={new Date().getFullYear()}
              value={developerForm.establishedYear}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  establishedYear: event.target.value
                }))
              }
              placeholder="2010"
            />
          </label>

          <label className="admin-form-field admin-form-field--full">
            <span>{copy.logo}</span>

            <input
              type="url"
              dir="ltr"
              value={developerForm.logo}
              onChange={(event) =>
                setDeveloperForm((current) => ({
                  ...current,
                  logo: event.target.value
                }))
              }
              placeholder="https://images.unsplash.com/..."
            />
          </label>
        </div>
      </section>

      <section className="admin-form-section">
        <div className="admin-form-section__heading">
          <div>
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
            </span>

            <div>
              <h4>{copy.publishingSettings}</h4>
              <p>{copy.qualityGate}</p>
            </div>
          </div>
        </div>

        <div className="admin-form-toggle-grid">
          <button
            type="button"
            className={`admin-form-toggle ${
              developerForm.verified ? 'admin-form-toggle--active' : ''
            }`}
            aria-pressed={developerForm.verified}
            onClick={() =>
              setDeveloperForm((current) => ({
                ...current,
                verified: !current.verified
              }))
            }
          >
            <span className="admin-form-toggle__control" aria-hidden="true">
              <span />
            </span>

            <span>
              <strong>{copy.verifiedDeveloper}</strong>
              <small>{copy.verifiedDeveloperHelp}</small>
            </span>
          </button>

          <button
            type="button"
            className={`admin-form-toggle ${
              developerForm.featured ? 'admin-form-toggle--active' : ''
            }`}
            aria-pressed={developerForm.featured}
            onClick={() =>
              setDeveloperForm((current) => ({
                ...current,
                featured: !current.featured
              }))
            }
          >
            <span className="admin-form-toggle__control" aria-hidden="true">
              <span />
            </span>

            <span>
              <strong>{copy.featuredDeveloper}</strong>
              <small>{copy.featuredDeveloperHelp}</small>
            </span>
          </button>
        </div>
      </section>

      <div className="admin-partner-form__submit">
        <div>
          <strong>{copy.createDeveloper}</strong>
          <span>{copy.developerManagementText}</span>
        </div>

        <button
          className="button-link button-link--primary"
          type="submit"
          disabled={creatingDeveloper}
        >
          {creatingDeveloper ? copy.creatingDeveloper : copy.createDeveloper}
        </button>
      </div>
    </fieldset>
    </form>

  <div className="responsive-table">
    <table>
      <thead>
        <tr>
          <th>{copy.developers}</th>
          <th>{copy.headquarters}</th>
          <th>{copy.contact}</th>
          <th>{copy.verifiedDeveloper}</th>
          <th>{copy.featuredDeveloper}</th>
          <th>{copy.action}</th>
        </tr>
      </thead>

      <tbody>
        {developers.map((developer) => (
          <tr key={developer.id}>
            <td>
              <strong>{getDeveloperName(developer, language)}</strong>
              <span>{developer.slug}</span>
            </td>

            <td>
              {getDeveloperHeadquarters(developer, language) || '-'}
            </td>

            <td>
              {developer.email ? (
                <span className="inline-info">
                  <Mail size={14} aria-hidden="true" />
                  {developer.email}
                </span>
              ) : null}

              {developer.phone ? (
                <span className="inline-info">
                  <Phone size={14} aria-hidden="true" />
                  {developer.phone}
                </span>
              ) : null}

              {!developer.email && !developer.phone ? '-' : null}
            </td>

            <td>
              <button
                type="button"
                className={`status-pill ${
                  developer.verified ? 'approved' : 'pending'
                }`}
                disabled={updatingId === developer.id}
                onClick={() =>
                  updateDeveloperCompany(developer.id, {
                    verified: !developer.verified
                  })
                }
              >
                {developer.verified ? (
                  <>
                    <CheckCircle2 size={14} aria-hidden="true" />
                    {copy.verifiedDeveloper}
                  </>
                ) : (
                  <>
                    <Clock3 size={14} aria-hidden="true" />
                    {copy.pending}
                  </>
                )}
              </button>
            </td>

            <td>
              <button
                type="button"
                className={`status-pill ${
                  developer.featured ? 'approved' : 'pending'
                }`}
                disabled={updatingId === developer.id}
                onClick={() =>
                  updateDeveloperCompany(developer.id, {
                    featured: !developer.featured
                  })
                }
              >
                {developer.featured ? (
                  <>
                    <Sparkles size={14} aria-hidden="true" />
                    {copy.featured}
                  </>
                ) : (
                  <>
                    <Clock3 size={14} aria-hidden="true" />
                    {copy.pending}
                  </>
                )}
              </button>
            </td>

            <td>
              <div className="admin-action-buttons">
                <ButtonLink
                  to={`/developers/${developer.slug}`}
                  variant="ghost"
                >
                  <Eye size={16} aria-hidden="true" />
                </ButtonLink>

                <button
                  type="button"
                  className="icon-action icon-action--reject"
                  disabled={updatingId === developer.id}
                  onClick={() =>
                    deleteDeveloperCompany(developer.id)
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span className="sr-only">
                    {copy.deleteDeveloper}
                  </span>
                </button>
              </div>
            </td>
          </tr>
        ))}

        {developers.length === 0 ? (
          <tr>
            <td colSpan={6}>{copy.noDevelopers}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  </div>
</div>

          <div className="table-card table-card--premium">
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{copy.agencyManagement}</p>
                <h2>{copy.travelAgencies}</h2>
                <p>{copy.agencyManagementText}</p>
              </div>

              <ButtonLink to="/travel-agencies" variant="ghost">
                <Eye size={16} aria-hidden="true" />
                {copy.viewMarketplace}
              </ButtonLink>
            </div>

<form className="admin-partner-form" onSubmit={createTravelAgency}>
  <div className="admin-partner-form__header">
    <div>
      <span className="admin-partner-form__icon">
        <Building2 size={22} aria-hidden="true" />
      </span>

      <div>
        <h3>{copy.createAgency}</h3>
        <p>{copy.agencyDetailsText}</p>
      </div>
    </div>

    <span className="admin-partner-form__required">
      * {copy.requiredField}
    </span>
  </div>

  {agencyFormError ? (
    <div className="admin-form-feedback admin-form-feedback--error" role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{agencyFormError}</span>
    </div>
  ) : null}

  {agencyFormSuccess ? (
    <div
      className="admin-form-feedback admin-form-feedback--success"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 size={18} aria-hidden="true" />
      <span>{agencyFormSuccess}</span>
    </div>
  ) : null}

  <fieldset className="admin-partner-form__fieldset" disabled={creatingAgency}>
    <section className="admin-form-section">
      <div className="admin-form-section__heading">
        <div>
          <span>EN</span>
          <div>
            <h4>{copy.englishContent}</h4>
            <p>{copy.agencyDetails}</p>
          </div>
        </div>
      </div>

      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>
            {copy.agencyName}
            <strong aria-hidden="true">*</strong>
          </span>

          <input
            required
            value={agencyForm.nameEn}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                nameEn: event.target.value
              }))
            }
            placeholder="Muscat Coast Tours"
          />
        </label>

        <label className="admin-form-field">
          <span>{copy.headquarters}</span>

          <input
            value={agencyForm.headquartersEn}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                headquartersEn: event.target.value
              }))
            }
            placeholder="Muscat, Oman"
          />
        </label>

        <label className="admin-form-field admin-form-field--full">
          <span>{copy.description}</span>

          <textarea
            rows={5}
            value={agencyForm.descriptionEn}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                descriptionEn: event.target.value
              }))
            }
            placeholder="Premium Oman tours and curated activities."
          />
        </label>
      </div>
    </section>

    <section className="admin-form-section admin-form-section--rtl">
      <div className="admin-form-section__heading">
        <div>
          <span>ع</span>
          <div>
            <h4>{copy.arabicContent}</h4>
            <p>{copy.agencyDetails}</p>
          </div>
        </div>
      </div>

      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>{copy.agencyNameAr}</span>

          <input
            dir="rtl"
            value={agencyForm.nameAr}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                nameAr: event.target.value
              }))
            }
            placeholder="جولات ساحل مسقط"
          />
        </label>

        <label className="admin-form-field">
          <span>{copy.headquartersAr}</span>

          <input
            dir="rtl"
            value={agencyForm.headquartersAr}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                headquartersAr: event.target.value
              }))
            }
            placeholder="مسقط، عُمان"
          />
        </label>

        <label className="admin-form-field admin-form-field--full">
          <span>{copy.descriptionAr}</span>

          <textarea
            dir="rtl"
            rows={5}
            value={agencyForm.descriptionAr}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                descriptionAr: event.target.value
              }))
            }
            placeholder="وكالة متخصصة في تنظيم تجارب مختارة في عُمان."
          />
        </label>
      </div>
    </section>

    <section className="admin-form-section">
      <div className="admin-form-section__heading">
        <div>
          <span>
            <Phone size={17} aria-hidden="true" />
          </span>

          <div>
            <h4>{copy.contactDetails}</h4>
            <p>{copy.agencyManagementText}</p>
          </div>
        </div>
      </div>

      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>{copy.phone}</span>

          <input
            type="tel"
            dir="ltr"
            value={agencyForm.phone}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                phone: event.target.value
              }))
            }
            placeholder="+968 9000 0000"
          />
        </label>

        <label className="admin-form-field">
          <span>{copy.email}</span>

          <input
            type="email"
            dir="ltr"
            value={agencyForm.email}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                email: event.target.value
              }))
            }
            placeholder="agency@lux.om"
          />
        </label>

        <label className="admin-form-field">
          <span>{copy.website}</span>

          <input
            type="url"
            dir="ltr"
            value={agencyForm.website}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                website: event.target.value
              }))
            }
            placeholder="https://agency.om"
          />
        </label>

        <label className="admin-form-field">
          <span>{copy.establishedYear}</span>

          <input
            type="number"
            min="1800"
            max={new Date().getFullYear()}
            value={agencyForm.establishedYear}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                establishedYear: event.target.value
              }))
            }
            placeholder="2018"
          />
        </label>

        <label className="admin-form-field admin-form-field--full">
          <span>{copy.logo}</span>

          <input
            type="url"
            dir="ltr"
            value={agencyForm.logo}
            onChange={(event) =>
              setAgencyForm((current) => ({
                ...current,
                logo: event.target.value
              }))
            }
            placeholder="https://images.unsplash.com/..."
          />
        </label>
      </div>
    </section>

    <section className="admin-form-section">
      <div className="admin-form-section__heading">
        <div>
          <span>
            <ShieldCheck size={17} aria-hidden="true" />
          </span>

          <div>
            <h4>{copy.publishingSettings}</h4>
            <p>{copy.qualityGate}</p>
          </div>
        </div>
      </div>

      <div className="admin-form-toggle-grid">
        <button
          type="button"
          className={`admin-form-toggle ${
            agencyForm.verified ? 'admin-form-toggle--active' : ''
          }`}
          aria-pressed={agencyForm.verified}
          onClick={() =>
            setAgencyForm((current) => ({
              ...current,
              verified: !current.verified
            }))
          }
        >
          <span className="admin-form-toggle__control" aria-hidden="true">
            <span />
          </span>

          <span>
            <strong>{copy.verifiedAgency}</strong>
            <small>{copy.verifiedHelp}</small>
          </span>
        </button>

        <button
          type="button"
          className={`admin-form-toggle ${
            agencyForm.featured ? 'admin-form-toggle--active' : ''
          }`}
          aria-pressed={agencyForm.featured}
          onClick={() =>
            setAgencyForm((current) => ({
              ...current,
              featured: !current.featured
            }))
          }
        >
          <span className="admin-form-toggle__control" aria-hidden="true">
            <span />
          </span>

          <span>
            <strong>{copy.featuredAgency}</strong>
            <small>{copy.featuredHelp}</small>
          </span>
        </button>
      </div>
    </section>

    <div className="admin-partner-form__submit">
      <div>
        <strong>{copy.createAgency}</strong>
        <span>{copy.agencyManagementText}</span>
      </div>

      <button
        className="button-link button-link--primary"
        type="submit"
        disabled={creatingAgency}
      >
        {creatingAgency ? copy.creating : copy.createAgency}
      </button>
    </div>
  </fieldset>
</form>

            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>{copy.travelAgencies}</th>
                    <th>{copy.headquarters}</th>
                    <th>{copy.contact}</th>
                    <th>{copy.verifiedAgency}</th>
                    <th>{copy.featuredAgency}</th>
                    <th>{copy.action}</th>
                  </tr>
                </thead>

                <tbody>
                  {travelAgencies.map((agency) => (
                    <tr key={agency.id}>
                      <td>
                        <strong>{getAgencyName(agency, language)}</strong>
                        <span>{agency.slug}</span>
                      </td>

                      <td>{getAgencyHeadquarters(agency, language) || '-'}</td>

                      <td>
                        {agency.email ? (
                          <span className="inline-info">
                            <Mail size={14} aria-hidden="true" />
                            {agency.email}
                          </span>
                        ) : null}

                        {agency.phone ? (
                          <span className="inline-info">
                            <Phone size={14} aria-hidden="true" />
                            {agency.phone}
                          </span>
                        ) : null}

                        {!agency.email && !agency.phone ? '-' : null}
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`status-pill ${agency.verified ? 'approved' : 'pending'}`}
                          disabled={updatingId === agency.id}
                          onClick={() =>
                            updateTravelAgency(agency.id, { verified: !agency.verified })
                          }
                        >
                          {agency.verified ? (
                            <>
                              <CheckCircle2 size={14} aria-hidden="true" />
                              {copy.verifiedAgency}
                            </>
                          ) : (
                            <>
                              <Clock3 size={14} aria-hidden="true" />
                              {copy.pending}
                            </>
                          )}
                        </button>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`status-pill ${agency.featured ? 'approved' : 'pending'}`}
                          disabled={updatingId === agency.id}
                          onClick={() =>
                            updateTravelAgency(agency.id, { featured: !agency.featured })
                          }
                        >
                          {agency.featured ? (
                            <>
                              <Sparkles size={14} aria-hidden="true" />
                              {copy.featured}
                            </>
                          ) : (
                            <>
                              <Clock3 size={14} aria-hidden="true" />
                              {copy.pending}
                            </>
                          )}
                        </button>
                      </td>

                      <td>
                        <div className="admin-action-buttons">
                          <ButtonLink to={`/travel-agencies/${agency.slug}`} variant="ghost">
                            <Eye size={16} aria-hidden="true" />
                          </ButtonLink>

                          <button
                            type="button"
                            className="icon-action icon-action--reject"
                            disabled={updatingId === agency.id}
                            onClick={() => deleteTravelAgency(agency.id)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                            <span className="sr-only">{copy.deleteAgency}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {travelAgencies.length === 0 ? (
                    <tr>
                      <td colSpan={6}>{copy.noAgencies}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
            </>
          ) : null}

          <div id="admin-review-detail-queues" className="table-card table-card--premium admin-review-detail-card admin-workspace-panel" tabIndex={-1}>
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{copy.reviewQueue}</p>
                <h2>{copy.listingQueue}</h2>
              </div>

              <ButtonLink to="/listings" variant="ghost">
                <Eye size={16} aria-hidden="true" />
                {copy.viewMarketplace}
              </ButtonLink>
            </div>

              {renderReviewToolbar()}

            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>{t.admin.listing}</th>
                    <th>{t.listings.location}</th>
                    <th>{t.admin.owner}</th>
                    <th>{t.addListing.type}</th>
                    <th>{copy.quality}</th>
                    <th>{t.admin.status}</th>
                    <th>{copy.action}</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredListings.map((listing, index) => {
                    const qualityScore = getListingQualityScore(listing, index);
                    const owner = listing.developer
                      ? language === 'ar'
                        ? listing.developer.nameAr || listing.developer.nameEn
                        : listing.developer.nameEn || listing.developer.nameAr
                      : language === 'ar'
                        ? listing.developerNameAr ||
                          listing.developerNameEn ||
                          listing.owner?.name ||
                          copy.privateOwner
                        : listing.developerNameEn ||
                          listing.developerNameAr ||
                          listing.owner?.name ||
                          copy.privateOwner;

                    return (
                      <tr key={listing.id}>
                        <td>
                          <strong>{getListingTitle(listing, language)}</strong>
                          <span>{listing.transaction}</span>
                          {listing.rejectedReason ? (
                            <span className="admin-rejection-note">
                              {copy.rejectionNote}: {listing.rejectedReason}
                            </span>
                          ) : null}
                        </td>

                        <td>{getListingLocation(listing, language)}</td>
                        <td>{owner}</td>
                        <td>{getListingType(listing, language)}</td>

                        <td>
                          <span className="quality-score">
                            <span style={{ width: `${qualityScore}%` }} />
                            <strong>{qualityScore}%</strong>
                          </span>
                        </td>

                        <td>{renderStatus(listing.status)}</td>

                        <td>
                          <div className="admin-action-buttons">
                            <button
                              type="button"
                              className="icon-action icon-action--pending"
                              disabled={updatingId === listing.id}
                              onClick={() => updateListingStatus(listing.id, 'PENDING')}
                            >
                              <Clock3 size={16} aria-hidden="true" />
                              <span className="sr-only">{copy.sendToPending}</span>
                            </button>

                            <button
                              type="button"
                              className="icon-action icon-action--approve"
                              disabled={updatingId === listing.id}
                              onClick={() => updateListingStatus(listing.id, 'APPROVED')}
                            >
                              <CheckCircle2 size={16} aria-hidden="true" />
                              <span className="sr-only">{copy.approve}</span>
                            </button>

                            <button
                              type="button"
                              className="icon-action icon-action--reject"
                              disabled={updatingId === listing.id}
                              onClick={() => rejectListing(listing.id)}
                            >
                              <XCircle size={16} aria-hidden="true" />
                              <span className="sr-only">{copy.reject}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredListings.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{copy.noListings}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-card table-card--premium admin-review-detail-card admin-workspace-panel">
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{copy.reviewQueue}</p>
                <h2>{copy.activitiesQueue}</h2>
              </div>

              <ButtonLink to="/activities" variant="ghost">
                <Eye size={16} aria-hidden="true" />
                {copy.viewMarketplace}
              </ButtonLink>
            </div>

              {renderReviewToolbar()}

            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>{t.listings.location}</th>
                    <th>Provider</th>
                    <th>Category</th>
                    <th>{copy.quality}</th>
                    <th>{t.admin.status}</th>
                    <th>{copy.action}</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredActivities.map((activity, index) => {
                    const qualityScore = getActivityQualityScore(activity, index);

                    return (
                      <tr key={activity.id}>
                        <td>
                          <strong>{getActivityTitle(activity, language)}</strong>
                          <span>{activity.durationLabelEn || `${activity.durationMinutes ?? 0} min`}</span>
                          {activity.rejectedReason ? (
                            <span className="admin-rejection-note">
                              {copy.rejectionNote}: {activity.rejectedReason}
                            </span>
                          ) : null}
                        </td>

                        <td>{getActivityLocation(activity, language)}</td>
                        <td>{getActivityProvider(activity, language)}</td>
                        <td>{getActivityCategory(activity, language)}</td>

                        <td>
                          <span className="quality-score">
                            <span style={{ width: `${qualityScore}%` }} />
                            <strong>{qualityScore}%</strong>
                          </span>
                        </td>

                        <td>{renderStatus(activity.status)}</td>

                        <td>
                          <div className="admin-action-buttons">
                            <button
                              type="button"
                              className="icon-action icon-action--pending"
                              disabled={updatingId === activity.id}
                              onClick={() => updateActivityStatus(activity.id, 'PENDING')}
                            >
                              <Clock3 size={16} aria-hidden="true" />
                              <span className="sr-only">{copy.sendToPending}</span>
                            </button>

                            <button
                              type="button"
                              className="icon-action icon-action--approve"
                              disabled={updatingId === activity.id}
                              onClick={() => updateActivityStatus(activity.id, 'APPROVED')}
                            >
                              <CheckCircle2 size={16} aria-hidden="true" />
                              <span className="sr-only">{copy.approve}</span>
                            </button>

                            <button
                              type="button"
                              className="icon-action icon-action--reject"
                              disabled={updatingId === activity.id}
                              onClick={() => rejectActivity(activity.id)}
                            >
                              <XCircle size={16} aria-hidden="true" />
                              <span className="sr-only">{copy.reject}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{copy.noActivities}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-card table-card--premium admin-review-detail-card admin-workspace-panel">
            <div className="table-card__header">
              <div>
                <p className="eyebrow">
                  <Inbox size={15} aria-hidden="true" /> {copy.reviewQueue}
                </p>
                <h2>{copy.inquiriesQueue}</h2>
              </div>

              <ButtonLink to="/contact" variant="ghost">
                <Eye size={16} aria-hidden="true" />
                {copy.viewMarketplace}
              </ButtonLink>
            </div>

            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>{copy.inquiryType}</th>
                    <th>Name</th>
                    <th>{copy.contact}</th>
                    <th>{copy.message}</th>
                    <th>{copy.createdAt}</th>
                  </tr>
                </thead>

                <tbody>
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id}>
                      <td>
                        <strong>{inquiry.type}</strong>
                      </td>

                      <td>{inquiry.name}</td>

                      <td>
                        <span className="inline-info">
                          <Mail size={14} aria-hidden="true" />
                          {inquiry.email}
                        </span>

                        {inquiry.phone ? (
                          <span className="inline-info">
                            <Phone size={14} aria-hidden="true" />
                            {inquiry.phone}
                          </span>
                        ) : null}
                      </td>

                      <td>{inquiry.message}</td>

                      <td>{new Date(inquiry.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}

                  {inquiries.length === 0 ? (
                    <tr>
                      <td colSpan={5}>{copy.noInquiries}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
