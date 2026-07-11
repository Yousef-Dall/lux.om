import {
  AlertCircle,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Eye,
  FileCheck2,
  Home,
  Inbox,
  LayoutDashboard,
  MapPinned,
  MessageCircle,
  PackageCheck,
  Plane,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
  XCircle
} from 'lucide-react';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

import {
  createPaymentSession,
  getBookingReceipt,
  requestBookingCancellation,
  syncBookingPayment,
  updateOwnerBookingStatus,
  type ApiBooking,
  type ApiBookingReceipt
} from '../api/bookings';
import { ApiError } from '../api/client';
import { getDashboardData, type ApiNotification, type DashboardData } from '../api/dashboard';
import { markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import DashboardWorkspaceTabs, {
  type DashboardWorkspaceTabItem
} from '../components/DashboardWorkspaceTabs';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import MediaQualityGuidance from '../components/MediaQualityGuidance';
import OperationalStatusPanel from '../components/OperationalStatusPanel';
import OwnerMarketplaceEditModal from '../components/OwnerMarketplaceEditModal';
import ReceiptView from '../components/ReceiptView';
import Stage8DashboardPanel from '../components/Stage8DashboardPanel';
import VerificationRequestWorkspace from '../components/VerificationRequestWorkspace';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { formatMarketplacePrice } from '../utils/format';
import { getMarketplacePersonaLabel } from '../utils/marketplacePersona';
import type { MarketplaceWorkspaceKey } from '../utils/marketplacePersona';
import {
  getPersonaDashboardContent,
  type PersonaDashboardMetricKey
} from '../utils/personaDashboardContent';
import type { Activity, Listing } from '../types';

const statusClassMap: Record<string, 'approved' | 'pending' | 'rejected'> = {
  APPROVED: 'approved',
  PAID: 'approved',
  OWNER_APPROVED: 'approved',
  ADMIN_CONFIRMED: 'approved',
  PENDING: 'pending',
  CANCELLATION_REQUESTED: 'pending',
  NOT_REQUIRED: 'pending',
  REJECTED: 'rejected',
  FAILED: 'rejected',
  OWNER_REJECTED: 'rejected',
  CANCELLED: 'rejected',
  REFUNDED: 'rejected'
};

const tabIconMap: Partial<Record<MarketplaceWorkspaceKey, LucideIcon>> = {
  overview: LayoutDashboard,
  'my-bookings': CalendarDays,
  'payments-receipts': CreditCard,
  'saved-alerts': Bell,
  valuations: TrendingUp,
  transactions: WalletCards,
  'contracts-rent': FileCheck2,
  notifications: Bell,
  'account-readiness': ShieldCheck,
  'listings-command': Home,
  'lead-inbox': Inbox,
  'viewing-requests': Eye,
  'media-quality': Sparkles,
  verification: ShieldCheck,
  performance: TrendingUp,
  'activities-command': MapPinned,
  'booking-requests': CalendarDays,
  'schedule-capacity': Users,
  'reviews-trust': MessageCircle,
  'travel-packages': Plane,
  itineraries: MapPinned,
  'group-bookings': Users,
  'package-payments': CreditCard,
  'supplier-documents': ClipboardCheck,
  'developer-profile': BriefcaseBusiness,
  'projects-developments': Home,
  'units-inventory': PackageCheck,
  'launch-readiness': ShieldCheck,
  'buyer-investor-leads': Users,
  'documents-verification': FileCheck2,
  'market-insights': TrendingUp,
  'admin-operations': ShieldCheck
};

const metricIconMap: Record<PersonaDashboardMetricKey, LucideIcon> = {
  requests: Inbox,
  bookings: CalendarDays,
  payments: CreditCard,
  saved: Bell,
  listings: Home,
  activities: MapPinned,
  packages: Plane,
  projects: BriefcaseBusiness,
  units: PackageCheck,
  leads: Users,
  documents: FileCheck2,
  media: Sparkles,
  verification: ShieldCheck,
  performance: TrendingUp,
  notifications: Bell
};

function getStatusClass(status?: string | null) {
  return statusClassMap[String(status ?? '').toUpperCase()] ?? 'pending';
}

function StatusIcon({ status }: { status?: string | null }) {
  const statusClass = getStatusClass(status);

  if (statusClass === 'approved') return <CheckCircle2 size={14} aria-hidden="true" />;
  if (statusClass === 'rejected') return <XCircle size={14} aria-hidden="true" />;

  return <Clock3 size={14} aria-hidden="true" />;
}

function formatDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function formatStatus(value?: string | null) {
  return String(value ?? 'PENDING').replace(/_/g, ' ').toLowerCase();
}

function getBookingTitle(booking: ApiBooking, language: 'en' | 'ar') {
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

function getBookingSubtitle(booking: ApiBooking, language: 'en' | 'ar') {
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

function getBookingKind(booking: ApiBooking, language: 'en' | 'ar') {
  if (booking.activity) {
    return booking.activity.travelRegion === 'OUTSIDE_OMAN'
      ? language === 'ar'
        ? 'باقة سفر'
        : 'Travel package'
      : language === 'ar'
        ? 'نشاط'
        : 'Activity';
  }

  if (booking.listing) return language === 'ar' ? 'عقار' : 'Listing';

  return language === 'ar' ? 'طلب' : 'Request';
}

function getPaymentAmountValue(booking: ApiBooking) {
  const amount = Number(booking.payment?.amount ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function formatPaymentAmount(booking: ApiBooking, noPaymentText: string) {
  const amount = getPaymentAmountValue(booking);

  if (amount <= 0) return noPaymentText;

  const currency = booking.activity?.priceCurrency || booking.listing?.priceCurrency || 'OMR';

  return `${currency} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function formatItemPrice(item: Listing | Activity, language: 'en' | 'ar') {
  return formatMarketplacePrice({
    price: item.price,
    priceAmount: item.priceAmount,
    priceCurrency: item.priceCurrency,
    priceQualifier: item.priceQualifier,
    priceUnit: item.priceUnit,
    language
  });
}

function isTravelPackage(activity: Activity) {
  return activity.travelRegion === 'OUTSIDE_OMAN';
}

function isActivityRecord(record: Listing | Activity): record is Activity {
  return 'duration' in record || 'category' in record;
}

function getDashboardMetricValue(key: PersonaDashboardMetricKey, data: DashboardData | null) {
  const stats = data?.stats;
  const listings = data?.listings ?? [];
  const activities = data?.activities ?? [];
  const notifications = data?.notifications ?? [];

  const sampleMediaIssues = [...listings, ...activities].filter((item) => {
    const status = item.mediaQualityStatus;

    return status === 'NEEDS_REVIEW' || status === 'BLOCKED' || status === 'NOT_CHECKED';
  }).length;

  const sampleDocumentGaps = [...listings, ...activities].filter((item) => {
    const status = item.verificationStatus;

    return status !== 'ADMIN_VERIFIED';
  }).length;

  const savedItems =
    stats?.savedItems ??
    (stats?.savedListings ?? 0) + (stats?.savedActivities ?? 0) + (stats?.savedSearches ?? 0);

  switch (key) {
    case 'requests':
      return (stats?.submittedInquiries ?? 0) + (stats?.submittedBookings ?? 0);
    case 'bookings':
      return (stats?.submittedBookings ?? 0) + (stats?.receivedBookings ?? 0);
    case 'payments':
      return stats?.pendingPayments ?? 0;
    case 'saved':
      return savedItems;
    case 'listings':
      return stats?.totalListings ?? 0;
    case 'activities':
      return stats?.totalLocalActivities ?? stats?.totalActivities ?? 0;
    case 'packages':
      return stats?.totalTravelPackages ?? activities.filter(isTravelPackage).length;
    case 'projects':
      return stats?.totalProjects ?? 0;
    case 'units':
      return listings.length;
    case 'leads':
      return (stats?.receivedInquiries ?? 0) + (stats?.receivedBookings ?? 0);
    case 'documents':
      return stats?.verificationGaps ?? sampleDocumentGaps;
    case 'media':
      return stats?.mediaGaps ?? sampleMediaIssues;
    case 'verification':
      return stats?.verificationGaps ?? sampleDocumentGaps;
    case 'performance':
      return (stats?.approvedListings ?? 0) + (stats?.approvedActivities ?? 0);
    case 'notifications':
      return stats?.unreadNotifications ?? notifications.filter((notification) => !notification.readAt).length;
    default:
      return 0;
  }
}

function updateBookingInDashboard(data: DashboardData | null, nextBooking: ApiBooking) {
  if (!data) return data;

  return {
    ...data,
    bookings: data.bookings.map((booking) =>
      booking.id === nextBooking.id ? nextBooking : booking
    ),
    receivedBookings: data.receivedBookings.map((booking) =>
      booking.id === nextBooking.id ? nextBooking : booking
    ),
    receivedBookingOperations: data.receivedBookingOperations.map((day) => ({
      ...day,
      bookings: day.bookings.map((booking) =>
        booking.id === nextBooking.id ? nextBooking : booking
      )
    }))
  };
}

export default function Dashboard() {
  const { language } = useLanguage();
  const {
    token,
    user,
    canManageListings,
    canManageDeveloperProjects,
    canManageTravelPackages,
    canAccessAdmin,
    canUseMediaQuality,
    canUseVerification
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeDashboardTab, setActiveDashboardTab] = useState('overview');
  const [paymentUpdatingId, setPaymentUpdatingId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [bookingUpdatingId, setBookingUpdatingId] = useState('');
  const [bookingActionError, setBookingActionError] = useState('');
  const [bookingActionSuccess, setBookingActionSuccess] = useState('');
  const [notificationUpdatingId, setNotificationUpdatingId] = useState('');
  const [notificationActionError, setNotificationActionError] = useState('');
  const [receiptLoadingId, setReceiptLoadingId] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<ApiBookingReceipt | null>(null);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  useDocumentTitle('Dashboard');

  const copy =
    language === 'ar'
      ? {
          loading: 'جاري تحميل لوحة التحكم...',
          error: 'تعذر تحميل لوحة التحكم حالياً.',
          retry: 'إعادة المحاولة',
          workspace: 'مساحة العمل',
          sections: 'أقسام مخصصة لهذا الحساب',
          activeWorkspace: 'مساحة العمل الحالية',
          dashboardReady: 'جاهزية الحساب',
          urgent: 'إجراءات عاجلة',
          noUrgent: 'لا توجد إجراءات عاجلة حالياً.',
          priority: 'الأولوية',
          metrics: 'مؤشرات أساسية',
          recent: 'آخر النشاط',
          empty: 'لا توجد بيانات في هذا القسم بعد.',
          status: 'الحالة',
          edit: 'تعديل',
          media: 'وسائط',
          verification: 'تحقق',
          price: 'السعر',
          location: 'الموقع',
          addListing: 'إضافة عقار',
          addProject: 'إضافة مشروع',
          addActivity: 'إضافة نشاط',
          addPackage: 'إضافة باقة سفر',
          openAdmin: 'فتح مركز الإدارة',
          view: 'عرض',
          bookings: 'الحجوزات',
          requests: 'الطلبات',
          payments: 'المدفوعات',
          notifications: 'التنبيهات',
          approve: 'قبول',
          reject: 'رفض',
          approved: 'تم القبول.',
          rejected: 'تم الرفض.',
          actionError: 'تعذر تنفيذ الإجراء حالياً.',
          noPayment: 'لا يوجد دفع مطلوب',
          payNow: 'الدفع الآن',
          syncPayment: 'تحديث الدفع',
          receipt: 'الإيصال',
          cancel: 'طلب إلغاء',
          cancellationReason: 'سبب الإلغاء',
          cancellationSent: 'تم إرسال طلب الإلغاء.',
          paymentSynced: 'تم تحديث حالة الدفع.',
          receiptError: 'تعذر تحميل الإيصال.',
          notificationRead: 'تم تحديث التنبيه.',
          notificationsRead: 'تم تعليم كل التنبيهات كمقروءة.',
          markRead: 'تعليم كمقروء',
          markAllRead: 'تعليم الكل كمقروء',
          operationalCalendar: 'رزنامة التشغيل',
          capacity: 'السعة',
          guests: 'الضيوف',
          documents: 'المستندات',
          insights: 'الرؤى',
          adminOnly: 'أدوات الإدارة موجودة في مركز الإدارة المخصص.',
          noRecords: 'لا توجد سجلات حتى الآن.',
          refresh: 'تحديث البيانات',
          clearDeepLink: 'إغلاق',
          readinessScore: 'درجة الجاهزية',
          attentionNeeded: 'يحتاج انتباهاً',
          allClear: 'كل شيء جاهز',
          nextBestAction: 'أفضل خطوة تالية',
          excellentShape: 'حسابك في حالة ممتازة، تابع النشاط والفرص الجديدة.',
          focusedBookingFound: 'تم فتح الحجز المطلوب داخل لوحة التحكم.',
          focusedBookingMissing: 'لم يتم العثور على الحجز المطلوب أو لم يعد متاحاً لهذا الحساب.',
          liveStatusTitle: 'حالة مساحة العمل',
          liveStatusDescription: 'تحديث آمن للحجوزات والتنبيهات والجاهزية بدون فقدان سياق العمل.',
          workspaceSignals: 'مؤشرات التشغيل',
          openWorkspace: 'فتح القسم',
          quickActions: 'إجراءات سريعة',
          openCrm: 'فتح CRM',
          inventorySignal: 'المخزون',
          inventorySignalHelp: 'عناصر منشورة أو قيد المراجعة',
          demandSignal: 'الطلب',
          demandSignalHelp: 'حجوزات واستفسارات واردة',
          attentionSignal: 'الانتباه',
          attentionSignalHelp: 'تنبيهات وفجوات تحتاج إجراء',
          readinessSignal: 'الجاهزية',
          readinessSignalHelp: 'درجة صحة مساحة العمل',
          emptyAction: 'ابدأ من هنا'
        }
      : {
          loading: 'Loading your command center...',
          error: 'Could not load the dashboard right now.',
          retry: 'Retry',
          workspace: 'Workspace',
          sections: 'Sections tailored to this account',
          activeWorkspace: 'Active workspace',
          dashboardReady: 'Account readiness',
          urgent: 'Urgent actions',
          noUrgent: 'No urgent actions right now.',
          priority: 'Priority',
          metrics: 'Core signals',
          recent: 'Recent activity',
          empty: 'No data in this section yet.',
          status: 'Status',
          edit: 'Edit',
          media: 'Media',
          verification: 'Verification',
          price: 'Price',
          location: 'Location',
          addListing: 'Add listing',
          addProject: 'Add project',
          addActivity: 'Add activity',
          addPackage: 'Add travel package',
          openAdmin: 'Open admin cockpit',
          view: 'View',
          bookings: 'Bookings',
          requests: 'Requests',
          payments: 'Payments',
          notifications: 'Notifications',
          approve: 'Approve',
          reject: 'Reject',
          approved: 'Booking approved.',
          rejected: 'Booking rejected.',
          actionError: 'Could not complete the action right now.',
          noPayment: 'No payment required',
          payNow: 'Pay now',
          syncPayment: 'Sync payment',
          receipt: 'Receipt',
          cancel: 'Request cancellation',
          cancellationReason: 'Cancellation reason',
          cancellationSent: 'Cancellation request sent.',
          paymentSynced: 'Payment status refreshed.',
          receiptError: 'Could not load the receipt.',
          notificationRead: 'Notification updated.',
          notificationsRead: 'All notifications marked as read.',
          markRead: 'Mark read',
          markAllRead: 'Mark all read',
          operationalCalendar: 'Operational calendar',
          capacity: 'Capacity',
          guests: 'Guests',
          documents: 'Documents',
          insights: 'Insights',
          adminOnly: 'Admin tools live in the dedicated admin cockpit.',
          noRecords: 'No records yet.',
          refresh: 'Refresh data',
          clearDeepLink: 'Dismiss',
          readinessScore: 'Readiness score',
          attentionNeeded: 'Needs attention',
          allClear: 'All clear',
          nextBestAction: 'Next best action',
          excellentShape: 'Your workspace is in excellent shape. Keep watching new activity and opportunities.',
          focusedBookingFound: 'The requested booking is open in your dashboard.',
          focusedBookingMissing: 'That booking was not found or is no longer available to this account.',
          liveStatusTitle: 'Workspace freshness',
          liveStatusDescription: 'Safely refresh bookings, alerts, and readiness without losing your current workspace context.',
          workspaceSignals: 'Operational signals',
          openWorkspace: 'Open section',
          quickActions: 'Quick actions',
          openCrm: 'Open CRM',
          inventorySignal: 'Inventory',
          inventorySignalHelp: 'Published and pending records',
          demandSignal: 'Demand',
          demandSignalHelp: 'Incoming bookings and inquiries',
          attentionSignal: 'Attention',
          attentionSignalHelp: 'Alerts and readiness gaps',
          readinessSignal: 'Readiness',
          readinessSignalHelp: 'Workspace health score',
          emptyAction: 'Start here'
        };

  const personaContent = useMemo(
    () => getPersonaDashboardContent(user?.role, language),
    [language, user?.role]
  );

  const accountRoleLabel = user ? getMarketplacePersonaLabel(user.role, language) : '';
  const dashboardTabs = useMemo<DashboardWorkspaceTabItem[]>(
    () =>
      personaContent.tabs.map((tab) => ({
        id: tab.key,
        label: tab.text,
        sectionId: `dashboard-v2-${tab.key}`,
        icon: tabIconMap[tab.key] ?? LayoutDashboard
      })),
    [personaContent.tabs]
  );

  const activeTabContent =
    personaContent.tabs.find((tab) => tab.key === activeDashboardTab) ?? personaContent.tabs[0];

  const data = dashboardData;
  const stats = data?.stats;
  const listings = data?.listings ?? [];
  const allActivities = data?.activities ?? [];
  const localActivities = allActivities.filter((activity) => !isTravelPackage(activity));
  const travelPackages = allActivities.filter(isTravelPackage);
  const activitiesForPersona = personaContent.persona === 'travelAgency'
    ? travelPackages
    : allActivities;
  const customerBookings = data?.bookings ?? [];
  const receivedBookings = data?.receivedBookings ?? [];
  const notifications = data?.notifications ?? [];
  const unreadNotifications = notifications.filter((notification) => !notification.readAt);
  const pendingPayments = customerBookings.filter((booking) => booking.payment?.status === 'PENDING');
  const pendingReceivedBookings = receivedBookings.filter(
    (booking) => booking.status === 'PENDING' || booking.status === 'CANCELLATION_REQUESTED'
  );
  const bookingFocusId = searchParams.get('bookingId') || searchParams.get('booking');
  const workspaceFocusId = searchParams.get('workspace');
  const focusedBooking = bookingFocusId
    ? [...customerBookings, ...receivedBookings].find((booking) => booking.id === bookingFocusId)
    : null;

  const urgentActions = useMemo(() => {
    const actions: Array<{ id: string; label: string; helper: string; priority: string; to?: string }> = [];

    if (user && !user.emailVerified) {
      actions.push({
        id: 'email',
        label: language === 'ar' ? 'فعّل البريد الإلكتروني' : 'Verify email address',
        helper:
          language === 'ar'
            ? 'التفعيل يحمي الحجوزات والمدفوعات والتنبيهات.'
            : 'Verification protects bookings, payments, and notifications.',
        priority: 'high',
        to: '/profile'
      });
    }

    if (pendingReceivedBookings.length) {
      actions.push({
        id: 'received-bookings',
        label:
          language === 'ar'
            ? `${pendingReceivedBookings.length} طلب يحتاج قراراً`
            : `${pendingReceivedBookings.length} request${pendingReceivedBookings.length === 1 ? '' : 's'} need a decision`,
        helper:
          language === 'ar'
            ? 'راجع الطلبات واقبلها أو ارفضها بسرعة.'
            : 'Review received requests and approve or reject quickly.',
        priority: 'critical'
      });
    }

    if (pendingPayments.length) {
      actions.push({
        id: 'pending-payments',
        label:
          language === 'ar'
            ? `${pendingPayments.length} دفعة معلقة`
            : `${pendingPayments.length} pending payment${pendingPayments.length === 1 ? '' : 's'}`,
        helper:
          language === 'ar'
            ? 'أكمل الدفع أو حدّث حالته للحفاظ على الحجز.'
            : 'Complete checkout or sync payment status to keep bookings moving.',
        priority: 'high'
      });
    }

    if (unreadNotifications.length) {
      actions.push({
        id: 'notifications',
        label:
          language === 'ar'
            ? `${unreadNotifications.length} تنبيه غير مقروء`
            : `${unreadNotifications.length} unread notification${unreadNotifications.length === 1 ? '' : 's'}`,
        helper:
          language === 'ar'
            ? 'راجع آخر تحديثات السوق والحساب.'
            : 'Review recent marketplace and account updates.',
        priority: 'medium'
      });
    }

    return actions.slice(0, 4);
  }, [language, pendingPayments.length, pendingReceivedBookings.length, unreadNotifications.length, user]);

  const dashboardHealth = data?.health;
  const readinessScore = dashboardHealth?.readinessScore ?? (user?.emailVerified ? 70 : 45);
  const attentionCount = dashboardHealth?.attentionCount ?? urgentActions.length;
  const nextBestAction = dashboardHealth?.nextBestAction;
  const heroNextBestAction = nextBestAction
    ? {
        key: nextBestAction.key,
        label: language === 'ar' ? nextBestAction.labelAr : nextBestAction.labelEn,
        description: language === 'ar' ? nextBestAction.descriptionAr : nextBestAction.descriptionEn,
        actionTo: nextBestAction.actionTo
      }
    : urgentActions[0]
      ? {
          key: urgentActions[0].id,
          label: urgentActions[0].label,
          description: urgentActions[0].helper,
          actionTo: urgentActions[0].to
        }
      : null;
  const inventorySignal =
    (stats?.totalListings ?? 0) + (stats?.totalActivities ?? 0) + (stats?.totalProjects ?? 0);
  const demandSignal =
    (stats?.receivedInquiries ?? 0) + (stats?.receivedBookings ?? 0) + (stats?.submittedBookings ?? 0);
  const attentionSignal =
    attentionCount + (stats?.pendingReviewCount ?? 0) + (stats?.pendingPayments ?? 0);
  const heroSignals = [
    {
      key: 'readiness',
      label: copy.readinessSignal,
      value: `${readinessScore}%`,
      helper: copy.readinessSignalHelp
    },
    {
      key: 'inventory',
      label: copy.inventorySignal,
      value: inventorySignal,
      helper: copy.inventorySignalHelp
    },
    {
      key: 'demand',
      label: copy.demandSignal,
      value: demandSignal,
      helper: copy.demandSignalHelp
    },
    {
      key: 'attention',
      label: copy.attentionSignal,
      value: attentionSignal,
      helper: copy.attentionSignalHelp
    }
  ];
  const emptyStateAction = heroNextBestAction?.actionTo
    ? { to: heroNextBestAction.actionTo, label: heroNextBestAction.label }
    : personaContent.primaryActions[0]
      ? { to: personaContent.primaryActions[0].to, label: personaContent.primaryActions[0].text }
      : null;
  const dashboardScoreStyle = {
    '--dashboard-score': `${Math.max(0, Math.min(100, readinessScore))}%`
  } as CSSProperties;

  useEffect(() => {
    if (!dashboardTabs.some((tab) => tab.id === activeDashboardTab)) {
      setActiveDashboardTab(dashboardTabs[0]?.id ?? 'overview');
    }
  }, [activeDashboardTab, dashboardTabs]);

  useEffect(() => {
    if (!workspaceFocusId) return;

    if (dashboardTabs.some((tab) => tab.id === workspaceFocusId)) {
      setActiveDashboardTab(workspaceFocusId);
    }
  }, [dashboardTabs, workspaceFocusId]);

  useEffect(() => {
    if (!bookingFocusId) return;

    if (receivedBookings.some((booking) => booking.id === bookingFocusId)) {
      setActiveDashboardTab(canManageTravelPackages ? 'group-bookings' : 'booking-requests');
      return;
    }

    if (customerBookings.some((booking) => booking.id === bookingFocusId)) {
      setActiveDashboardTab('my-bookings');
    }
  }, [bookingFocusId, canManageTravelPackages, customerBookings, receivedBookings]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!token) {
        setDashboardData(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setLoadError('');
        const nextData = await getDashboardData(token, language);

        if (!active) return;
        setDashboardData(nextData);
        setLastUpdatedAt(new Date());
      } catch (error) {
        console.error(error);
        if (active) setLoadError(copy.error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [copy.error, language, token]);

  async function refreshDashboard() {
    if (!token || refreshingDashboard) return;

    const showFullLoader = !dashboardData;

    try {
      setRefreshingDashboard(true);
      setRefreshError('');
      if (showFullLoader) setLoading(true);

      const nextData = await getDashboardData(token, language);
      setDashboardData(nextData);
      setLastUpdatedAt(new Date());
      setLoadError('');
    } catch (error) {
      console.error(error);
      const message = error instanceof ApiError ? error.message : copy.error;

      if (showFullLoader) setLoadError(message);
      else setRefreshError(message);
    } finally {
      setRefreshingDashboard(false);
      if (showFullLoader) setLoading(false);
    }
  }

  async function handleCreatePayment(booking: ApiBooking) {
    if (!token || paymentUpdatingId) return;

    try {
      setPaymentUpdatingId(booking.id);
      setPaymentError('');
      setPaymentSuccess('');
      const response = await createPaymentSession(booking.id, token);
      setDashboardData((current) => updateBookingInDashboard(current, response.booking));

      if (response.payment.checkoutUrl) {
        window.location.assign(response.payment.checkoutUrl);
        return;
      }

      setPaymentSuccess(copy.paymentSynced);
    } catch (error) {
      console.error(error);
      setPaymentError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setPaymentUpdatingId('');
    }
  }

  async function handleSyncPayment(booking: ApiBooking) {
    if (!token || paymentUpdatingId) return;

    try {
      setPaymentUpdatingId(booking.id);
      setPaymentError('');
      setPaymentSuccess('');
      const response = await syncBookingPayment(booking.id, token);
      setDashboardData((current) => updateBookingInDashboard(current, response.booking));
      setPaymentSuccess(copy.paymentSynced);
    } catch (error) {
      console.error(error);
      setPaymentError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setPaymentUpdatingId('');
    }
  }

  async function handleLoadReceipt(booking: ApiBooking) {
    if (!token || receiptLoadingId) return;

    try {
      setReceiptLoadingId(booking.id);
      setReceiptError('');
      const response = await getBookingReceipt(booking.id, token);
      setActiveReceipt(response.receipt);
    } catch (error) {
      console.error(error);
      setReceiptError(error instanceof ApiError ? error.message : copy.receiptError);
    } finally {
      setReceiptLoadingId('');
    }
  }

  async function handleRequestCancellation(booking: ApiBooking) {
    if (!token || bookingUpdatingId) return;

    const reason = window.prompt(copy.cancellationReason);
    if (!reason?.trim()) return;

    try {
      setBookingUpdatingId(booking.id);
      setBookingActionError('');
      setBookingActionSuccess('');
      const response = await requestBookingCancellation(
        booking.id,
        { reason: reason.trim() },
        token
      );
      setDashboardData((current) => updateBookingInDashboard(current, response.booking));
      setBookingActionSuccess(copy.cancellationSent);
    } catch (error) {
      console.error(error);
      setBookingActionError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setBookingUpdatingId('');
    }
  }

  async function handleOwnerBookingStatus(
    booking: ApiBooking,
    status: 'OWNER_APPROVED' | 'OWNER_REJECTED'
  ) {
    if (!token || bookingUpdatingId) return;

    try {
      setBookingUpdatingId(booking.id);
      setBookingActionError('');
      setBookingActionSuccess('');
      const response = await updateOwnerBookingStatus(booking.id, { status }, token);
      setDashboardData((current) => updateBookingInDashboard(current, response.booking));
      setBookingActionSuccess(status === 'OWNER_APPROVED' ? copy.approved : copy.rejected);
    } catch (error) {
      console.error(error);
      setBookingActionError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setBookingUpdatingId('');
    }
  }

  async function handleMarkNotificationRead(notification: ApiNotification) {
    if (!token || notificationUpdatingId) return;

    try {
      setNotificationUpdatingId(notification.id);
      setNotificationActionError('');
      const response = await markNotificationRead(notification.id, token);
      setDashboardData((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.map((item) =>
                item.id === notification.id ? response.notification : item
              )
            }
          : current
      );
    } catch (error) {
      console.error(error);
      setNotificationActionError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setNotificationUpdatingId('');
    }
  }

  async function handleMarkAllNotificationsRead() {
    if (!token || notificationUpdatingId) return;

    try {
      setNotificationUpdatingId('all');
      setNotificationActionError('');
      await markAllNotificationsRead(token);
      await refreshDashboard();
    } catch (error) {
      console.error(error);
      setNotificationActionError(error instanceof ApiError ? error.message : copy.actionError);
    } finally {
      setNotificationUpdatingId('');
    }
  }

  function renderEmptyState(
    title = activeTabContent.emptyStateTitle,
    description = activeTabContent.emptyStateDescription,
    action = emptyStateAction
  ) {
    return (
      <div className="dashboard-v2-empty-state">
        <Sparkles size={22} aria-hidden="true" />
        <h3>{title}</h3>
        <p>{description}</p>
        {action ? (
          <ButtonLink to={action.to} variant="soft">
            {action.label || copy.emptyAction}
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  function renderWorkspaceBriefing() {
    const cards: Array<{
      label: string;
      value: number | string;
      helper: string;
      tone?: 'critical' | 'high' | 'medium' | 'low';
    }> = [];

    const verificationGaps = stats?.verificationGaps ?? 0;
    const mediaGaps = stats?.mediaGaps ?? 0;
    const pendingReviewCount = stats?.pendingReviewCount ?? 0;
    const receivedDemand = (stats?.receivedInquiries ?? 0) + (stats?.receivedBookings ?? 0);
    const receivedPending = stats?.receivedPendingBookings ?? pendingReceivedBookings.length;
    const savedItems = stats?.savedItems ?? 0;
    const unreadCount = stats?.unreadNotifications ?? unreadNotifications.length;

    switch (activeTabContent.key) {
      case 'listings-command':
        cards.push(
          {
            label: language === 'ar' ? 'مسار النشر' : 'Publishing pipeline',
            value: pendingReviewCount,
            helper: language === 'ar' ? 'عقارات تنتظر مراجعة السوق.' : 'Listings waiting for marketplace review.',
            tone: pendingReviewCount ? 'high' : 'low'
          },
          {
            label: language === 'ar' ? 'الثقة' : 'Trust readiness',
            value: verificationGaps,
            helper: language === 'ar' ? 'فجوات تحقق تؤثر على الثقة والتحويل.' : 'Verification gaps that affect trust and conversion.',
            tone: verificationGaps ? 'high' : 'low'
          },
          {
            label: language === 'ar' ? 'العرض البصري' : 'Visual quality',
            value: mediaGaps,
            helper: language === 'ar' ? 'عناصر تحتاج صوراً أو مراجعة جودة.' : 'Records that need stronger media or quality review.',
            tone: mediaGaps ? 'medium' : 'low'
          }
        );
        break;

      case 'activities-command':
        cards.push(
          {
            label: language === 'ar' ? 'مخزون التجارب' : 'Experience inventory',
            value: stats?.totalLocalActivities ?? localActivities.length,
            helper: language === 'ar' ? 'أنشطة وتجارب داخل عمان.' : 'Inside-Oman experiences managed by this account.',
            tone: 'medium'
          },
          {
            label: language === 'ar' ? 'ضغط الحجز' : 'Booking pressure',
            value: receivedPending,
            helper: language === 'ar' ? 'طلبات تحتاج قبولاً أو رفضاً.' : 'Requests waiting for approval or rejection.',
            tone: receivedPending ? 'critical' : 'low'
          },
          {
            label: language === 'ar' ? 'الجاهزية' : 'Readiness gaps',
            value: verificationGaps + mediaGaps,
            helper: language === 'ar' ? 'فجوات ثقة أو وسائط قبل الترويج.' : 'Trust or media gaps before stronger promotion.',
            tone: verificationGaps + mediaGaps ? 'high' : 'low'
          }
        );
        break;

      case 'travel-packages':
      case 'itineraries':
        cards.push(
          {
            label: language === 'ar' ? 'باقات السفر' : 'Package inventory',
            value: stats?.totalTravelPackages ?? travelPackages.length,
            helper: language === 'ar' ? 'باقات خارج عمان تحتاج برنامجاً واضحاً.' : 'Outside-Oman packages that need clear itinerary detail.',
            tone: 'medium'
          },
          {
            label: language === 'ar' ? 'طلبات المجموعات' : 'Group demand',
            value: receivedDemand,
            helper: language === 'ar' ? 'استفسارات وحجوزات مرتبطة بالباقات.' : 'Inquiries and bookings connected to packages.',
            tone: receivedDemand ? 'high' : 'low'
          },
          {
            label: language === 'ar' ? 'جاهزية المستندات' : 'Document readiness',
            value: verificationGaps,
            helper: language === 'ar' ? 'مستندات وكالة أو موردين تحتاج مراجعة.' : 'Agency or supplier documents that need trust review.',
            tone: verificationGaps ? 'high' : 'low'
          }
        );
        break;

      case 'developer-profile':
      case 'projects-developments':
      case 'units-inventory':
      case 'launch-readiness':
        cards.push(
          {
            label: language === 'ar' ? 'محفظة المشاريع' : 'Project portfolio',
            value: stats?.totalProjects ?? 0,
            helper: language === 'ar' ? 'مشاريع معتمدة أو قيد المراجعة مرتبطة بشركة التطوير.' : 'Developer projects connected to this account across launch states.',
            tone: 'medium'
          },
          {
            label: language === 'ar' ? 'جاهزية الإطلاق' : 'Launch readiness',
            value: verificationGaps + mediaGaps + pendingReviewCount,
            helper: language === 'ar' ? 'مستندات أو وسائط أو موافقات ناقصة قبل الإطلاق.' : 'Missing documents, media, or approvals before launch.',
            tone: verificationGaps + mediaGaps + pendingReviewCount ? 'high' : 'low'
          },
          {
            label: language === 'ar' ? 'اهتمام المستثمرين' : 'Investor signal',
            value: receivedDemand,
            helper: language === 'ar' ? 'طلب مشترين أو مستثمرين على المشاريع.' : 'Buyer or investor demand around projects.',
            tone: receivedDemand ? 'high' : 'low'
          }
        );
        break;

      case 'lead-inbox':
      case 'buyer-investor-leads':
      case 'viewing-requests':
      case 'booking-requests':
      case 'group-bookings':
        cards.push(
          {
            label: language === 'ar' ? 'طلبات تحتاج قراراً' : 'Needs decision',
            value: receivedPending,
            helper: language === 'ar' ? 'كل طلب سريع الرد عليه يزيد الثقة والتحويل.' : 'Fast decisions improve trust and conversion.',
            tone: receivedPending ? 'critical' : 'low'
          },
          {
            label: language === 'ar' ? 'الطلب الكلي' : 'Total demand',
            value: receivedDemand,
            helper: language === 'ar' ? 'استفسارات وحجوزات مستلمة.' : 'Received inquiries and booking requests.',
            tone: receivedDemand ? 'high' : 'low'
          }
        );
        break;

      case 'my-bookings':
      case 'payments-receipts':
      case 'package-payments':
        cards.push(
          {
            label: language === 'ar' ? 'حجوزاتي' : 'My bookings',
            value: customerBookings.length,
            helper: language === 'ar' ? 'حجوزاتك وطلباتك النشطة.' : 'Your active bookings and marketplace requests.',
            tone: customerBookings.length ? 'medium' : 'low'
          },
          {
            label: language === 'ar' ? 'مدفوعات معلقة' : 'Pending payments',
            value: stats?.pendingPayments ?? pendingPayments.length,
            helper: language === 'ar' ? 'مدفوعات تحتاج إكمالاً أو تحديثاً.' : 'Payments that need checkout or status sync.',
            tone: (stats?.pendingPayments ?? pendingPayments.length) ? 'high' : 'low'
          }
        );
        break;

      case 'saved-alerts':
        cards.push(
          {
            label: language === 'ar' ? 'العناصر المحفوظة' : 'Saved items',
            value: savedItems,
            helper: language === 'ar' ? 'عقارات وأنشطة وبحث محفوظ للمتابعة.' : 'Saved listings, activities, and searches for follow-up.',
            tone: savedItems ? 'medium' : 'low'
          },
          {
            label: language === 'ar' ? 'تنبيهات غير مقروءة' : 'Unread alerts',
            value: unreadCount,
            helper: language === 'ar' ? 'تحديثات مهمة لم تراجعها بعد.' : 'Important updates you have not reviewed yet.',
            tone: unreadCount ? 'medium' : 'low'
          }
        );
        break;

      case 'media-quality':
        cards.push({
          label: language === 'ar' ? 'فجوات الوسائط' : 'Media gaps',
          value: mediaGaps,
          helper: language === 'ar' ? 'صور أو عروض تحتاج تحسيناً قبل الترويج.' : 'Images or presentation details that need improvement before promotion.',
          tone: mediaGaps ? 'medium' : 'low'
        });
        break;

      case 'verification':
      case 'documents-verification':
      case 'supplier-documents':
        cards.push({
          label: language === 'ar' ? 'فجوات التحقق' : 'Verification gaps',
          value: verificationGaps,
          helper: language === 'ar' ? 'مستندات أو إشارات ثقة تحتاج استكمالاً.' : 'Documents or trust signals that need completion.',
          tone: verificationGaps ? 'high' : 'low'
        });
        break;

      case 'performance':
      case 'market-insights':
        cards.push(
          {
            label: language === 'ar' ? 'جاهز للجمهور' : 'Public-ready',
            value: (stats?.approvedListings ?? 0) + (stats?.approvedActivities ?? 0),
            helper: language === 'ar' ? 'سجلات معتمدة وقابلة للظهور.' : 'Approved records ready for marketplace visibility.',
            tone: 'medium'
          },
          {
            label: language === 'ar' ? 'الطلب' : 'Demand',
            value: receivedDemand,
            helper: language === 'ar' ? 'استفسارات وحجوزات مستلمة.' : 'Received inquiries and bookings.',
            tone: receivedDemand ? 'high' : 'low'
          }
        );
        break;

      default:
        break;
    }

    if (!cards.length) return null;

    return (
      <div
        className={'dashboard-v2-depth-grid dashboard-v2-depth-grid--' + Math.min(cards.length, 3)}
        aria-label={language === 'ar' ? 'عمق مساحة العمل' : 'Workspace depth'}
      >
        {cards.map((card) => (
          <article className={'dashboard-v2-depth-card dashboard-v2-depth-card--' + (card.tone ?? 'medium')} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.helper}</p>
          </article>
        ))}
      </div>
    );
  }

  function renderRecordCard(record: Listing | Activity) {
    const isActivity = isActivityRecord(record);
    const detailRoute = isActivity ? `/activities/${record.slug}` : `/listings/${record.slug}`;
    const recordStatus = record.status ?? 'PENDING';

    return (
      <article className="dashboard-v2-record-card" key={record.id}>
        <div className="dashboard-v2-record-card__media">
          {record.image ? <img src={record.image} alt="" /> : <Sparkles size={24} aria-hidden="true" />}
        </div>
        <div className="dashboard-v2-record-card__body">
          <div className="dashboard-v2-record-card__title-row">
            <div>
              <span className={`status-pill ${getStatusClass(recordStatus)}`}>
                <StatusIcon status={recordStatus} />
                {formatStatus(recordStatus)}
              </span>
              <h3>{record.title}</h3>
            </div>
          </div>
          <p>{record.description}</p>
          <dl className="dashboard-v2-inline-meta">
            <div>
              <dt>{copy.location}</dt>
              <dd>{record.location || '—'}</dd>
            </div>
            <div>
              <dt>{copy.price}</dt>
              <dd>{formatItemPrice(record, language)}</dd>
            </div>
            <div>
              <dt>{isActivity ? copy.capacity : copy.status}</dt>
              <dd>{isActivity ? record.capacity ?? '—' : record.transaction}</dd>
            </div>
          </dl>
          <MediaQualityGuidance
            item={record}
            itemType={isActivity ? 'activity' : 'listing'}
            language={language}
          />
          <div className="dashboard-v2-card-actions">
            <button
              className="button-link button-link--secondary"
              type="button"
              onClick={() => {
                if (isActivity) setEditingActivity(record);
                else setEditingListing(record);
              }}
            >
              {copy.edit}
            </button>
            <ButtonLink to={detailRoute} variant="soft">
              {copy.view}
            </ButtonLink>
          </div>
        </div>
      </article>
    );
  }

  function renderBookingCard(booking: ApiBooking, mode: 'customer' | 'operator') {
    const canPay = booking.payment?.status === 'PENDING' && mode === 'customer';
    const canReceipt = booking.payment?.status === 'PAID' || booking.status === 'ADMIN_CONFIRMED';
    const canDecide = mode === 'operator' && booking.status === 'PENDING';
    const canCancel = mode === 'customer' && booking.status !== 'CANCELLED';

    return (
      <article className="dashboard-v2-booking-card" key={booking.id}>
        <div>
          <span className={`status-pill ${getStatusClass(booking.status)}`}>
            <StatusIcon status={booking.status} />
            {formatStatus(booking.status)}
          </span>
          <h3>{getBookingTitle(booking, language)}</h3>
          <p>
            {getBookingKind(booking, language)} · {getBookingSubtitle(booking, language) || '—'}
          </p>
        </div>
        <dl className="dashboard-v2-inline-meta dashboard-v2-inline-meta--compact">
          <div>
            <dt>{copy.bookings}</dt>
            <dd>{formatDate(booking.scheduledDate, language)}</dd>
          </div>
          <div>
            <dt>{copy.guests}</dt>
            <dd>{booking.guests}</dd>
          </div>
          <div>
            <dt>{copy.payments}</dt>
            <dd>{formatPaymentAmount(booking, copy.noPayment)}</dd>
          </div>
        </dl>
        {booking.message ? <p className="trust-note">{booking.message}</p> : null}
        {booking.cancellationReason ? (
          <p className="trust-note">{booking.cancellationReason}</p>
        ) : null}
        <div className="dashboard-v2-card-actions">
          {canDecide ? (
            <>
              <button
                className="button-link"
                type="button"
                disabled={bookingUpdatingId === booking.id}
                onClick={() => void handleOwnerBookingStatus(booking, 'OWNER_APPROVED')}
              >
                {copy.approve}
              </button>
              <button
                className="button-link button-link--secondary"
                type="button"
                disabled={bookingUpdatingId === booking.id}
                onClick={() => void handleOwnerBookingStatus(booking, 'OWNER_REJECTED')}
              >
                {copy.reject}
              </button>
            </>
          ) : null}
          {canPay ? (
            <button
              className="button-link"
              type="button"
              disabled={paymentUpdatingId === booking.id}
              onClick={() => void handleCreatePayment(booking)}
            >
              {copy.payNow}
            </button>
          ) : null}
          {booking.payment ? (
            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={paymentUpdatingId === booking.id}
              onClick={() => void handleSyncPayment(booking)}
            >
              {copy.syncPayment}
            </button>
          ) : null}
          {canReceipt ? (
            <button
              className="button-link button-link--soft"
              type="button"
              disabled={receiptLoadingId === booking.id}
              onClick={() => void handleLoadReceipt(booking)}
            >
              {copy.receipt}
            </button>
          ) : null}
          {canCancel ? (
            <button
              className="button-link button-link--ghost"
              type="button"
              disabled={bookingUpdatingId === booking.id}
              onClick={() => void handleRequestCancellation(booking)}
            >
              {copy.cancel}
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  function renderBookingList(bookings: ApiBooking[], mode: 'customer' | 'operator') {
    return (
      <>
        {renderWorkspaceBriefing()}
        {bookings.length ? (
          <div className="dashboard-v2-booking-grid">{bookings.map((booking) => renderBookingCard(booking, mode))}</div>
        ) : (
          renderEmptyState()
        )}
      </>
    );
  }
  function renderNotificationCenter() {
    return (
      <section className="dashboard-v2-workspace-stack">
        {notifications.length ? (
          <div className="dashboard-v2-workspace-actions">
            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={notificationUpdatingId === 'all'}
              onClick={() => void handleMarkAllNotificationsRead()}
            >
              {copy.markAllRead}
            </button>
          </div>
        ) : null}

        {notificationActionError ? <p className="form-error" role="alert">{notificationActionError}</p> : null}

        {notifications.length ? (
          <div className="dashboard-v2-notification-list">
            {notifications.map((notification) => (
              <article
                className={`dashboard-v2-notification-card${notification.readAt ? '' : ' dashboard-v2-notification-card--unread'}`}
                key={notification.id}
              >
                <div>
                  <span>{formatDate(notification.createdAt, language)}</span>
                  <h3>{notification.title}</h3>
                  <p>{notification.message}</p>
                </div>
                {!notification.readAt ? (
                  <button
                    className="button-link button-link--secondary"
                    type="button"
                    disabled={notificationUpdatingId === notification.id}
                    onClick={() => void handleMarkNotificationRead(notification)}
                  >
                    {copy.markRead}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          renderEmptyState()
        )}
      </section>
    );
  }
  function renderReadinessPanel() {
    return (
      <section className="dashboard-v2-readiness-panel">
        <div className="dashboard-v2-section-heading">
          <div>
            <p className="eyebrow">{copy.dashboardReady}</p>
            <h3>{copy.dashboardReady}</h3>
          </div>
        </div>
        <div className="dashboard-v2-readiness-list">
          {personaContent.readiness.length ? (
            personaContent.readiness.map((item) => (
              <article className={`dashboard-v2-readiness-item dashboard-v2-readiness-item--${item.priority}`} key={item.key}>
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>{item.text}</strong>
                  <p>{item.helperText}</p>
                </div>
              </article>
            ))
          ) : (
            <article className="dashboard-v2-readiness-item">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>{language === 'ar' ? 'مركز الإدارة جاهز' : 'Admin cockpit ready'}</strong>
                <p>{copy.adminOnly}</p>
              </div>
            </article>
          )}
        </div>
      </section>
    );
  }

  function renderOverview() {
    const recentRecords = [
      ...listings.slice(0, 2).map((item) => ({ type: 'listing' as const, item })),
      ...activitiesForPersona.slice(0, 2).map((item) => ({ type: 'activity' as const, item }))
    ];

    return (
      <div className="dashboard-v2-overview-grid">
        <section className="dashboard-v2-command-card dashboard-v2-command-card--urgent">
          <div className="dashboard-v2-section-heading">
            <div>
              <p className="eyebrow">{copy.priority}</p>
              <h3>{copy.urgent}</h3>
            </div>
          </div>
          {urgentActions.length ? (
            <div className="dashboard-v2-action-list">
              {urgentActions.map((action) => (
                <article className={`dashboard-v2-action-item dashboard-v2-action-item--${action.priority}`} key={action.id}>
                  <AlertCircle size={18} aria-hidden="true" />
                  <div>
                    <strong>{action.label}</strong>
                    <p>{action.helper}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="trust-note">{copy.noUrgent}</p>
          )}
        </section>

        {renderReadinessPanel()}

        <section className="dashboard-v2-command-card dashboard-v2-command-card--wide">
          <div className="dashboard-v2-section-heading">
            <div>
              <p className="eyebrow">{copy.recent}</p>
              <h3>{activeTabContent.text}</h3>
              <p>{activeTabContent.helperText}</p>
            </div>
          </div>
          {recentRecords.length ? (
            <div className="dashboard-v2-compact-records">
              {recentRecords.map(({ type, item }) => (
                <article className="dashboard-v2-compact-record" key={`${type}-${item.id}`}>
                  <span className={`status-pill ${getStatusClass(item.status)}`}>
                    <StatusIcon status={item.status} />
                    {type === 'activity' && isTravelPackage(item as Activity)
                      ? language === 'ar'
                        ? 'باقة سفر'
                        : 'travel package'
                      : type}
                  </span>
                  <h4>{item.title}</h4>
                  <p>{item.location}</p>
                </article>
              ))}
            </div>
          ) : (
            renderEmptyState()
          )}
        </section>
      </div>
    );
  }

  function renderRecords(records: Array<Listing | Activity>, title: string, action?: { to: string; label: string }) {
    return (
      <section className="dashboard-v2-workspace-stack" aria-label={title}>
        {action ? (
          <div className="dashboard-v2-workspace-actions">
            <ButtonLink to={action.to}>{action.label}</ButtonLink>
          </div>
        ) : null}

        {renderWorkspaceBriefing()}

        {records.length ? (
          <div className="dashboard-v2-record-grid">{records.map((record) => renderRecordCard(record))}</div>
        ) : (
          renderEmptyState()
        )}
      </section>
    );
  }
  function renderOperationsCalendar() {
    const operations = data?.receivedBookingOperations ?? [];

    return (
      <section className="dashboard-v2-workspace-stack">
        {renderWorkspaceBriefing()}

        {operations.length ? (
          <div className="dashboard-v2-operations-grid">
            {operations.slice(0, 12).map((day) => (
              <article className="dashboard-v2-operation-day" key={day.date}>
                <span>{formatDate(day.date, language)}</span>
                <strong>{day.totalBookings}</strong>
                <p>
                  {day.totalGuests} {copy.guests} · {day.pendingBookings} pending
                </p>
                <small>
                  {copy.capacity}: {day.availableGuests ?? '—'} / {day.capacityGuests ?? '—'}
                </small>
              </article>
            ))}
          </div>
        ) : (
          renderEmptyState()
        )}
      </section>
    );
  }
  function renderVerificationWorkspace() {
    return (
      <section className="dashboard-v2-workspace-stack">
        {renderWorkspaceBriefing()}

        {canUseVerification ? (
          <VerificationRequestWorkspace
            token={token}
            listings={listings}
            activities={activitiesForPersona}
            language={language}
          />
        ) : (
          renderEmptyState()
        )}
      </section>
    );
  }
  function renderPerformanceWorkspace() {
    return (
      <section className="dashboard-v2-workspace-stack">
        {renderWorkspaceBriefing()}

        <div className="dashboard-v2-insight-grid">
          <article>
            <span>{language === 'ar' ? 'منشور' : 'Approved'}</span>
            <strong>{(stats?.approvedListings ?? 0) + (stats?.approvedActivities ?? 0)}</strong>
            <p>{language === 'ar' ? 'عناصر جاهزة للجمهور' : 'Public-ready marketplace records'}</p>
          </article>
          <article>
            <span>{language === 'ar' ? 'قيد المراجعة' : 'Pending review'}</span>
            <strong>{(stats?.pendingListings ?? 0) + (stats?.pendingActivities ?? 0)}</strong>
            <p>{language === 'ar' ? 'عناصر تنتظر الموافقة' : 'Records waiting for approval'}</p>
          </article>
          <article>
            <span>{language === 'ar' ? 'الطلب' : 'Demand'}</span>
            <strong>{(stats?.receivedInquiries ?? 0) + (stats?.receivedBookings ?? 0)}</strong>
            <p>{language === 'ar' ? 'استفسارات وحجوزات مستلمة' : 'Received inquiries and bookings'}</p>
          </article>
        </div>
      </section>
    );
  }
  function renderActiveWorkspace() {
    switch (activeTabContent.key) {
      case 'overview':
        return renderOverview();
      case 'projects-developments':
      case 'developer-profile':
      case 'launch-readiness':
        return renderRecords(
          listings,
          activeTabContent.text,
          canManageDeveloperProjects
            ? { to: '/add-project', label: copy.addProject }
            : canManageListings
              ? { to: '/add-listing', label: copy.addListing }
              : undefined
        );
      case 'units-inventory':
        return renderRecords(
          listings,
          activeTabContent.text,
          canManageDeveloperProjects
            ? { to: '/add-listing', label: language === 'ar' ? 'إضافة وحدة' : 'Add unit' }
            : undefined
        );
      case 'listings-command':
        return renderRecords(
          listings,
          activeTabContent.text,
          canManageListings || canManageDeveloperProjects
            ? { to: '/add-listing', label: copy.addListing }
            : undefined
        );
      case 'activities-command':
        return renderRecords(localActivities, activeTabContent.text, { to: '/add-activity', label: copy.addActivity });
      case 'travel-packages':
      case 'itineraries':
        return renderRecords(travelPackages, activeTabContent.text, { to: '/add-activity', label: copy.addPackage });
      case 'booking-requests':
      case 'viewing-requests':
      case 'group-bookings':
      case 'buyer-investor-leads':
      case 'lead-inbox':
        return (
          <section className="dashboard-v2-workspace-stack">
            <div className="dashboard-v2-section-heading">
              <div>
                <p className="eyebrow">{copy.requests}</p>
                <h3>{activeTabContent.text}</h3>
                <p>{activeTabContent.helperText}</p>
              </div>
            </div>
            {bookingActionError ? <p className="form-error" role="alert">{bookingActionError}</p> : null}
            {bookingActionSuccess ? <p className="form-success" role="status">{bookingActionSuccess}</p> : null}
            {renderBookingList(receivedBookings, 'operator')}
          </section>
        );
      case 'schedule-capacity':
        return renderOperationsCalendar();
      case 'my-bookings':
      case 'payments-receipts':
      case 'package-payments':
        return (
          <section className="dashboard-v2-workspace-stack">
            <div className="dashboard-v2-section-heading">
              <div>
                <p className="eyebrow">{copy.bookings}</p>
                <h3>{activeTabContent.text}</h3>
                <p>{activeTabContent.helperText}</p>
              </div>
            </div>
            {paymentError ? <p className="form-error" role="alert">{paymentError}</p> : null}
            {paymentSuccess ? <p className="form-success" role="status">{paymentSuccess}</p> : null}
            {receiptError ? <p className="form-error" role="alert">{receiptError}</p> : null}
            {bookingActionError ? <p className="form-error" role="alert">{bookingActionError}</p> : null}
            {bookingActionSuccess ? <p className="form-success" role="status">{bookingActionSuccess}</p> : null}
            {renderBookingList(customerBookings, 'customer')}
          </section>
        );
      case 'media-quality':
        return canUseMediaQuality
          ? renderRecords([...listings, ...activitiesForPersona], activeTabContent.text)
          : renderEmptyState();
      case 'verification':
      case 'documents-verification':
      case 'supplier-documents':
        return renderVerificationWorkspace();
      case 'performance':
      case 'market-insights':
      case 'reviews-trust':
        return renderPerformanceWorkspace();
      case 'saved-alerts':
      case 'valuations':
      case 'transactions':
      case 'contracts-rent':
        return <Stage8DashboardPanel token={token} />;
      case 'notifications':
        return renderNotificationCenter();
      case 'admin-operations':
        return (
          <section className="dashboard-v2-admin-route-card">
            <ShieldCheck size={28} aria-hidden="true" />
            <h3>{activeTabContent.text}</h3>
            <p>{activeTabContent.helperText}</p>
            <ButtonLink to="/admin">{copy.openAdmin}</ButtonLink>
          </section>
        );
      default:
        return renderEmptyState();
    }
  }

  if (loading) {
    return (
      <section className="page-section container dashboard-page dashboard-v2-page">
        <div className="dashboard-v2-loading" role="status">
          <Sparkles size={22} aria-hidden="true" />
          {copy.loading}
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="page-section container dashboard-page dashboard-v2-page">
        <div className="dashboard-v2-error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <h2>{copy.error}</h2>
          <button className="button-link" type="button" onClick={() => void refreshDashboard()}>
            {copy.retry}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section container dashboard-page dashboard-v2-page">
      <EmailVerificationBanner mode="notice" />

      {bookingFocusId ? (
        <div
          className={`dashboard-deeplink-banner${focusedBooking ? '' : ' dashboard-deeplink-banner--warning'}`}
          role={focusedBooking ? 'status' : 'alert'}
        >
          <span>{focusedBooking ? copy.focusedBookingFound : copy.focusedBookingMissing}</span>
          <button
            className="button-link button-link--ghost"
            type="button"
            onClick={() => setSearchParams({})}
          >
            {copy.clearDeepLink}
          </button>
        </div>
      ) : null}

      <header className="dashboard-v2-hero">
        <div className="dashboard-v2-hero__content">
          <p className="eyebrow">
            <Sparkles size={16} aria-hidden="true" />
            {personaContent.hero.eyebrow}
          </p>
          <h1>{personaContent.hero.title}</h1>
          <p>{personaContent.hero.description}</p>
          <div className="dashboard-v2-hero__meta">
            <span>{accountRoleLabel}</span>
            <span>{user?.emailVerified ? 'Verified email' : 'Email pending'}</span>
            <span>{user?.companyName || user?.name || 'lux.om'}</span>
          </div>

          <div className="dashboard-v2-action-rail" aria-label={copy.quickActions}>
            {personaContent.primaryActions.map((action) => (
              <ButtonLink key={action.key} to={action.to} variant="soft">
                {action.text}
                <ArrowRight size={15} aria-hidden="true" />
              </ButtonLink>
            ))}
            {user?.role !== 'USER' || canAccessAdmin ? (
              <ButtonLink to="/crm/overview" variant="secondary">
                {copy.openCrm}
              </ButtonLink>
            ) : null}
            {canAccessAdmin ? (
              <ButtonLink to="/admin" variant="secondary">
                {copy.openAdmin}
              </ButtonLink>
            ) : null}
          </div>
        </div>

        <aside className="dashboard-v2-hero__panel">
          <div className="dashboard-v2-score-card">
            <div className="dashboard-v2-score-ring" style={dashboardScoreStyle}>
              <strong>{readinessScore}</strong>
              <span>%</span>
            </div>
            <div>
              <span>{copy.readinessScore}</span>
              <p>
                {attentionCount > 0
                  ? `${attentionCount} ${copy.attentionNeeded}`
                  : copy.allClear}
              </p>
            </div>
          </div>

          <div className="dashboard-v2-next-action">
            <p className="eyebrow">{copy.nextBestAction}</p>
            {heroNextBestAction ? (
              <>
                <strong>{heroNextBestAction.label}</strong>
                <p>{heroNextBestAction.description}</p>
                {heroNextBestAction.actionTo ? (
                  <ButtonLink to={heroNextBestAction.actionTo} variant="soft">
                    {heroNextBestAction.label}
                  </ButtonLink>
                ) : null}
              </>
            ) : (
              <>
                <strong>{copy.allClear}</strong>
                <p>{copy.excellentShape}</p>
              </>
            )}
          </div>

          <div className="dashboard-v2-signal-grid dashboard-v2-signal-grid--compact" aria-label={copy.workspaceSignals}>
            {heroSignals.map((signal) => (
              <article key={signal.key}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <p>{signal.helper}</p>
              </article>
            ))}
          </div>
        </aside>
      </header>

      <section className="dashboard-v2-metrics" aria-label={copy.metrics}>
        {personaContent.metrics.map((metric) => {
          const Icon = metricIconMap[metric.key];

          return (
            <article className="dashboard-v2-metric-card" key={metric.key}>
              <span>
                <Icon size={17} aria-hidden="true" />
                {metric.text}
              </span>
              <strong>{getDashboardMetricValue(metric.key, data)}</strong>
              <p>{metric.helperText}</p>
            </article>
          );
        })}
      </section>

      <div className="dashboard-v2-shell">
        <aside className="dashboard-v2-sidebar">
          <DashboardWorkspaceTabs
            ariaLabel={copy.workspace}
            introLabel={copy.workspace}
            sectionCountLabel={`${dashboardTabs.length} ${copy.sections}`}
            activeTabId={activeDashboardTab}
            tabs={dashboardTabs}
            onSelect={(tab) => setActiveDashboardTab(tab.id)}
          />

          <OperationalStatusPanel
            language={language}
            updatedAt={lastUpdatedAt}
            loading={refreshingDashboard}
            error={refreshError}
            onRefresh={() => void refreshDashboard()}
            refreshLabel={copy.refresh}
            title={copy.liveStatusTitle}
            description={copy.liveStatusDescription}
            className="dashboard-v2-freshness"
          />
        </aside>

        <main className="dashboard-v2-workspace" id={`dashboard-v2-${activeTabContent.key}`}>
          <div className="dashboard-v2-workspace__header">
            <div>
              <p className="eyebrow">{copy.activeWorkspace}</p>
              <h2>{activeTabContent.text}</h2>
              <p>{activeTabContent.helperText}</p>
            </div>
            {emptyStateAction ? (
              <ButtonLink to={emptyStateAction.to} variant="soft">
                {emptyStateAction.label || copy.openWorkspace}
              </ButtonLink>
            ) : null}
          </div>
          {renderActiveWorkspace()}
        </main>
      </div>

      {activeReceipt ? (
        <div className="receipt-modal__backdrop" role="presentation">
          <div className="receipt-modal" role="dialog" aria-modal="true">
            <button
              className="receipt-modal__close"
              type="button"
              onClick={() => setActiveReceipt(null)}
              aria-label="Close receipt"
            >
              ×
            </button>
            <ReceiptView receipt={activeReceipt} />
          </div>
        </div>
      ) : null}

      {editingListing ? (
        <OwnerMarketplaceEditModal
          listing={editingListing}
          token={token}
          language={language}
          onClose={() => setEditingListing(null)}
          onUpdated={refreshDashboard}
        />
      ) : null}

      {editingActivity ? (
        <OwnerMarketplaceEditModal
          activity={editingActivity}
          token={token}
          language={language}
          onClose={() => setEditingActivity(null)}
          onUpdated={refreshDashboard}
        />
      ) : null}
    </section>
  );
}
