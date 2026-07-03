import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  Home,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

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
import { getDashboardData, type DashboardData } from '../api/dashboard';
import {
  markAllNotificationsRead,
  markNotificationRead
} from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import DashboardWhatsAppActions from '../components/DashboardWhatsAppActions';
import DashboardWorkspaceTabs, {
  type DashboardWorkspaceTabItem
} from '../components/DashboardWorkspaceTabs';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import MediaQualityGuidance from '../components/MediaQualityGuidance';
import VerificationRequestWorkspace from '../components/VerificationRequestWorkspace';
import SectionHeader from '../components/SectionHeader';
import ReceiptView from '../components/ReceiptView';
import Stage8DashboardPanel from '../components/Stage8DashboardPanel';
import OwnerMarketplaceEditModal from '../components/OwnerMarketplaceEditModal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { formatMarketplacePrice } from '../utils/format';
import { getAccountRoleDescription, getAccountRoleLabel } from '../utils/accountRoles';
import type { Activity, Listing } from '../types';

function getStatusClass(status?: string) {
  if (
    status === 'APPROVED' ||
    status === 'PAID' ||
    status === 'OWNER_APPROVED' ||
    status === 'ADMIN_CONFIRMED'
  ) {
    return 'approved';
  }

  if (
    status === 'REJECTED' ||
    status === 'FAILED' ||
    status === 'OWNER_REJECTED' ||
    status === 'CANCELLED'
  ) {
    return 'rejected';
  }

  return 'pending';
}

function StatusIcon({ status }: { status?: string }) {
  if (
    status === 'APPROVED' ||
    status === 'PAID' ||
    status === 'OWNER_APPROVED' ||
    status === 'ADMIN_CONFIRMED'
  ) {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }

  if (
    status === 'REJECTED' ||
    status === 'FAILED' ||
    status === 'OWNER_REJECTED' ||
    status === 'CANCELLED'
  ) {
    return <XCircle size={14} aria-hidden="true" />;
  }

  return <Clock3 size={14} aria-hidden="true" />;
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

function getBookingTypeLabel(booking: ApiBooking, language: 'en' | 'ar') {
  if (booking.activity) {
    const activityWithRegion = booking.activity as { travelRegion?: string };

    if (activityWithRegion.travelRegion === 'OUTSIDE_OMAN') {
      return language === 'ar' ? 'باقة سفر' : 'Travel package';
    }

    return language === 'ar' ? 'نشاط' : 'Activity';
  }

  if (booking.listing) {
    return language === 'ar' ? 'عقار' : 'Listing';
  }

  return language === 'ar' ? 'حجز' : 'Booking';
}


function getBookingStatusLabel(status: string | undefined, language: 'en' | 'ar') {
  if (status === 'OWNER_APPROVED') {
    return language === 'ar' ? 'موافقة المنظم' : 'Provider approved';
  }

  if (status === 'OWNER_REJECTED') {
    return language === 'ar' ? 'رفض المنظم' : 'Provider rejected';
  }

  if (status === 'ADMIN_CONFIRMED') {
    return language === 'ar' ? 'مؤكد من الإدارة' : 'Admin confirmed';
  }

  if (status === 'CANCELLED') {
    return language === 'ar' ? 'ملغي' : 'Cancelled';
  }

  return language === 'ar' ? 'قيد المراجعة' : 'Pending';
}

function formatBookingDate(value: string | null | undefined, language: 'en' | 'ar') {
  if (!value) return '—';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function getPaymentAmountValue(booking: ApiBooking) {
  const amount = Number(booking.payment?.amount ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function formatPaymentAmount(booking: ApiBooking, noPaymentText: string) {
  const amount = getPaymentAmountValue(booking);

  if (amount <= 0) {
    return noPaymentText;
  }

  const currency =
    booking.activity?.priceCurrency ||
    booking.listing?.priceCurrency ||
    'OMR';

  return `${currency} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

type TimelineStep = {
  label: string;
  state: 'done' | 'active' | 'pending' | 'rejected';
};

type ReceivedBookingStatusFilter =
  | 'ALL'
  | 'PENDING'
  | 'CANCELLATION_REQUESTED'
  | 'APPROVED';

function getTimelineStepClass(step: TimelineStep) {
  return `dashboard-booking-step dashboard-booking-step--${step.state}`;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { token, user, isMarketplaceOperator } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeDashboardTab, setActiveDashboardTab] = useState('overview');

  useDocumentTitle('Dashboard');

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [paymentUpdatingId, setPaymentUpdatingId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [receiptLoadingId, setReceiptLoadingId] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<ApiBookingReceipt | null>(null);
  const [bookingUpdatingId, setBookingUpdatingId] = useState('');
  const [bookingActionError, setBookingActionError] = useState('');
  const [bookingActionSuccess, setBookingActionSuccess] = useState('');
  const [receivedBookingStatusFilter, setReceivedBookingStatusFilter] =
    useState<ReceivedBookingStatusFilter>('ALL');
  const [notificationUpdatingId, setNotificationUpdatingId] = useState('');
  const [notificationActionError, setNotificationActionError] = useState('');
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const copy =
    language === 'ar'
      ? {
          ownerWorkspace: 'مساحة الملاك والشركاء',
          heroTitle: 'تابع عقاراتك وأنشطتك من لوحة واحدة حقيقية.',
          heroText:
            'راقب حالة المراجعة، عدد الإعلانات، الأنشطة، والاستفسارات المرتبطة بحسابك.',
          viewListings: 'تصفح العقارات',
          listActivity: 'أضف نشاطاً',
          pendingInquiriesSmall: 'استفسارات مرتبطة بحسابك',
          profileQuality: 'حسابك جاهز لإدارة الإعلانات',
          shortStays: 'قيد المراجعة',
          shortStaysSmall: 'عقارات تنتظر الموافقة',
          activities: 'الأنشطة',
          activitiesSmall: 'أنشطة مرتبطة بحسابك',
          portfolio: 'المحفظة',
          recentListings: 'أحدث عقاراتك',
          recentActivities: 'أحدث أنشطتك',
          viewMarketplace: 'عرض السوق',
          status: 'الحالة',
          approved: 'مقبول',
          pending: 'قيد المراجعة',
          rejected: 'مرفوض',
          notifications: 'التنبيهات',
          notificationsText: 'آخر تحديثات الحجز والدفع المرتبطة بحسابك.',
          unreadNotifications: 'غير مقروء',
          emptyNotifications: 'لا توجد تنبيهات جديدة حالياً.',
          markAsRead: 'تحديد كمقروء',
          markAllAsRead: 'تحديد الكل كمقروء',
          notificationActionError: 'تعذر تحديث التنبيهات.',
          nextActions: 'أفضل الخطوات التالية',
          improveDiscovery: 'حسّن الظهور في البحث',
          improveText:
            'الإعلانات ذات الصور الواضحة، المواصفات الكاملة، والمعالم القريبة تظهر بشكل أفضل في البحث والفلاتر.',
          addImages: 'أضف صوراً عالية الجودة',
          completeSpecs: 'أكمل المواصفات المتقدمة',
          reviewPerformance: 'راجع أداء الاستفسارات',
          loading: 'جاري تحميل لوحة التحكم...',
          error: 'تعذر تحميل بيانات لوحة التحكم.',
          emptyListings: 'لا توجد عقارات مرتبطة بحسابك بعد.',
          emptyActivities: 'لا توجد أنشطة مرتبطة بحسابك بعد.',
          addFirstListing: 'أضف أول عقار',
          addFirstActivity: 'أضف أول نشاط',
          total: 'الإجمالي',
          approvedCount: 'مقبول',
          rejectedCount: 'مرفوض',
          myBookings: 'حجوزاتي',
          receivedBookingsTitle: 'طلبات الحجز المستلمة',
          receivedBookingsText: 'راجع طلبات الحجز القادمة لعقاراتك وأنشطتك ووافق عليها أو ارفضها.',
          bookingDate: 'تاريخ الحجز',
          guests: 'ضيوف',
          payment: 'الدفع',
          amount: 'المبلغ',
          bookingFlow: 'مسار الحجز',
          requestReceived: 'تم إرسال الطلب',
          providerReview: 'مراجعة المنظم',
          paymentStep: 'الدفع',
          confirmedStep: 'التأكيد',
          paymentPending: 'بانتظار الدفع',
          paymentPaid: 'مدفوع',
          paymentFailed: 'فشل الدفع',
          paymentNotRequired: 'لا يحتاج دفع',
          paymentReadyText: 'الطلب جاهز للدفع الآمن عبر ثواني.',
          paymentPaidText: 'تم الدفع بنجاح. سيتم تأكيد تفاصيل الحجز مع المنظم.',
          paymentFailedText: 'تعذر تأكيد الدفع. يمكنك تحديث الحالة أو إعادة المحاولة.',
          paymentNotRequiredText: 'لا يوجد مبلغ دفع مطلوب حالياً. انتظر تحديث المنظم أو الإدارة.',
          startPayment: 'بدء الدفع',
          refreshPayment: 'تحديث حالة الدفع',
          paymentStarted: 'تم تجهيز الدفع. سيتم تحويلك إلى صفحة الدفع الآمنة من ثواني.',
          paymentSynced: 'تم تحديث حالة الدفع بنجاح.',
          paymentActionError: 'تعذر تنفيذ إجراء الدفع.',
          approveBooking: 'قبول الطلب',
          rejectBooking: 'رفض الطلب',
          bookingApproved: 'تم قبول طلب الحجز.',
          bookingRejected: 'تم رفض طلب الحجز.',
          bookingActionError: 'تعذر تحديث حالة الحجز.',
          requestCancellation: 'طلب إلغاء',
          cancellationReasonPrompt: 'اكتب سبب طلب الإلغاء',
          cancellationRequested: 'تم إرسال طلب الإلغاء للمراجعة.',
          cancellationRequestedStatus: 'طلب الإلغاء قيد المراجعة.',
          cancellationReason: 'سبب الإلغاء',
          customer: 'العميل',
          contact: 'التواصل',
          preferredTime: 'الوقت المفضل',
          emptyBookings: 'لا توجد حجوزات مرتبطة بحسابك بعد.',
          emptyReceivedBookings: 'لا توجد طلبات حجز مستلمة حالياً.',
          focusedBookingTitle: 'تم فتح الحجز المطلوب',
          focusedBookingText: 'تم تمييز الحجز المرتبط بالتنبيه لتسهيل المتابعة.',
          missingBookingTitle: 'لم يتم العثور على الحجز في هذه اللوحة',
          missingBookingText: 'قد يكون الحجز مرتبطاً بحساب آخر أو لم يعد متاحاً.',
          clearFocusedBooking: 'إزالة التمييز'
        }
      : {
          ownerWorkspace: 'Owner and partner workspace',
          heroTitle: 'Manage your real listings and activities from one dashboard.',
          heroText:
            'Track review status, portfolio size, activities, and inquiries connected to your account.',
          viewListings: 'View listings',
          listActivity: 'List an activity',
          pendingInquiriesSmall: 'connected to your account',
          profileQuality: 'Your account is ready to manage submissions',
          shortStays: 'Pending review',
          shortStaysSmall: 'listings waiting for approval',
          activities: 'Activities',
          activitiesSmall: 'connected to your account',
          portfolio: 'Portfolio',
          recentListings: 'Recent listings',
          recentActivities: 'Recent activities',
          viewMarketplace: 'View marketplace',
          status: 'Status',
          approved: 'Approved',
          pending: 'Pending',
          rejected: 'Rejected',
          notifications: 'Notifications',
          notificationsText: 'Recent booking and payment updates connected to your account.',
          unreadNotifications: 'unread',
          emptyNotifications: 'No recent notifications yet.',
          markAsRead: 'Mark as read',
          markAllAsRead: 'Mark all as read',
          notificationActionError: 'Could not update notifications.',
          nextActions: 'Next best actions',
          improveDiscovery: 'Improve discovery',
          improveText:
            'Listings with clear photos, searchable amenities, nearby landmarks, and complete specs perform better in filtered searches.',
          addImages: 'Add premium images',
          completeSpecs: 'Complete advanced specs',
          reviewPerformance: 'Review inquiry performance',
          loading: 'Loading dashboard...',
          error: 'Could not load dashboard data.',
          emptyListings: 'No listings are connected to your account yet.',
          emptyActivities: 'No activities are connected to your account yet.',
          addFirstListing: 'Add your first listing',
          addFirstActivity: 'Add your first activity',
          total: 'Total',
          approvedCount: 'Approved',
          rejectedCount: 'Rejected',
          myBookings: 'My bookings',
          receivedBookingsTitle: 'Received booking requests',
          receivedBookingsText: 'Review incoming booking requests for your listings and activities, then approve or reject them.',
          providerOperationsTitle: 'Booking operations calendar',
          providerOperationsText: 'Track booking pressure by day, guests, capacity, and cancellation requests.',
          operationsDay: 'Day',
          totalGuests: 'Total guests',
          capacity: 'Capacity',
          availableCapacity: 'Available',
          pendingReview: 'Pending review',
          approvedBookings: 'Approved',
          cancellationRequests: 'Cancellation requests',
          paidBookings: 'Paid',
          unscheduled: 'Unscheduled',
          noOperations: 'No booking operations yet.',
          allStatuses: 'All statuses',
          showPending: 'Pending',
          showCancellations: 'Cancellations',
          showApproved: 'Approved',
          bookingDate: 'Booking date',
          guests: 'guests',
          payment: 'Payment',
          amount: 'Amount',
          bookingFlow: 'Booking flow',
          requestReceived: 'Request sent',
          providerReview: 'Provider review',
          paymentStep: 'Payment',
          confirmedStep: 'Confirmed',
          paymentPending: 'Payment pending',
          paymentPaid: 'Paid',
          paymentFailed: 'Payment failed',
          paymentNotRequired: 'No payment required',
          paymentReadyText: 'This request is ready for secure payment through Thawani.',
          paymentPaidText: 'Payment is complete. The booking details can now be confirmed with the provider.',
          paymentFailedText: 'Payment could not be confirmed. Refresh the status or try again.',
          paymentNotRequiredText: 'No payment amount is required yet. Wait for the provider or admin update.',
          startPayment: 'Start payment',
          refreshPayment: 'Refresh payment status',
          paymentStarted: 'Checkout is ready. Redirecting you to Thawani secure payment page.',
          paymentSynced: 'Payment status refreshed successfully.',
          paymentActionError: 'Could not complete the payment action.',
          approveBooking: 'Approve request',
          rejectBooking: 'Reject request',
          bookingApproved: 'Booking request approved.',
          bookingRejected: 'Booking request rejected.',
          bookingActionError: 'Could not update the booking status.',
          requestCancellation: 'Request cancellation',
          viewReceipt: 'View receipt',
          receiptError: 'Could not load the receipt right now.',
          cancellationReasonPrompt: 'Enter the reason for cancellation',
          cancellationRequested: 'Cancellation request sent for review.',
          cancellationRequestedStatus: 'Cancellation request is under review.',
          cancellationReason: 'Cancellation reason',
          customer: 'Customer',
          contact: 'Contact',
          preferredTime: 'Preferred time',
          emptyBookings: 'No bookings are connected to your account yet.',
          emptyReceivedBookings: 'No received booking requests yet.',
          focusedBookingTitle: 'Focused booking opened',
          focusedBookingText: 'The booking linked from your notification is highlighted below.',
          missingBookingTitle: 'Booking not found in this dashboard',
          missingBookingText: 'This booking may belong to another account or may no longer be available.',
          clearFocusedBooking: 'Clear focus',
          actions: 'Actions',
          editItem: 'Edit'
        };

  async function refreshDashboard() {
    if (!token) return;

    const data = await getDashboardData(token, language);
    setDashboardData(data);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!token) return;

      try {
        setLoading(true);
        setLoadError('');

        const data = await getDashboardData(token, language);

        if (!isMounted) return;

        setDashboardData(data);
      } catch (error) {
        console.error(error);

        if (!isMounted) return;

        if (error instanceof ApiError) {
          setLoadError(error.message);
        } else {
          setLoadError(copy.error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [token, language, copy.error]);



  async function runMarkNotificationRead(notificationId: string) {
    if (!token) return;

    try {
      setNotificationUpdatingId(notificationId);
      setNotificationActionError('');

      const response = await markNotificationRead(notificationId, token);

      setDashboardData((current) => {
        if (!current) return current;

        return {
          ...current,
          notifications: current.notifications.map((notification) =>
            notification.id === notificationId ? response.notification : notification
          )
        };
      });
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        setNotificationActionError(error.message);
      } else {
        setNotificationActionError(copy.notificationActionError);
      }
    } finally {
      setNotificationUpdatingId('');
    }
  }

  async function runMarkAllNotificationsRead() {
    if (!token) return;

    try {
      setNotificationUpdatingId('all');
      setNotificationActionError('');

      await markAllNotificationsRead(token);
      await refreshDashboard();
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        setNotificationActionError(error.message);
      } else {
        setNotificationActionError(copy.notificationActionError);
      }
    } finally {
      setNotificationUpdatingId('');
    }
  }


  async function runCustomerCancellationRequest(bookingId: string) {
    if (!token) return;

    const reason = window.prompt(copy.cancellationReasonPrompt);

    if (reason === null) return;

    const trimmedReason = reason.trim();

    if (!trimmedReason) return;

    try {
      setBookingUpdatingId(`cancel-${bookingId}`);
      setBookingActionError('');
      setBookingActionSuccess('');

      const response = await requestBookingCancellation(
        bookingId,
        {
          reason: trimmedReason
        },
        token
      );

      setDashboardData((current) => {
        if (!current) return current;

        return {
          ...current,
          bookings: current.bookings.map((booking) =>
            booking.id === bookingId ? response.booking : booking
          ),
          receivedBookings: current.receivedBookings.map((booking) =>
            booking.id === bookingId ? response.booking : booking
          )
        };
      });

      setBookingActionSuccess(copy.cancellationRequested);
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        setBookingActionError(error.message);
      } else {
        setBookingActionError(copy.bookingActionError);
      }
    } finally {
      setBookingUpdatingId('');
    }
  }

  async function runOwnerBookingAction(
    bookingId: string,
    status: 'OWNER_APPROVED' | 'OWNER_REJECTED'
  ) {
    if (!token) return;

    try {
      setBookingUpdatingId(bookingId);
      setBookingActionError('');
      setBookingActionSuccess('');

      const response = await updateOwnerBookingStatus(
        bookingId,
        {
          status
        },
        token
      );

      setDashboardData((current) => {
        if (!current) return current;

        return {
          ...current,
          bookings: current.bookings.map((booking) =>
            booking.id === bookingId ? response.booking : booking
          ),
          receivedBookings: current.receivedBookings.map((booking) =>
            booking.id === bookingId ? response.booking : booking
          )
        };
      });

      setBookingActionSuccess(
        status === 'OWNER_APPROVED' ? copy.bookingApproved : copy.bookingRejected
      );
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        setBookingActionError(error.message);
      } else {
        setBookingActionError(copy.bookingActionError);
      }
    } finally {
      setBookingUpdatingId('');
    }
  }
  async function openBookingReceipt(bookingId: string) {
    if (!token || receiptLoadingId) return;

    try {
      setReceiptLoadingId(bookingId);
      setReceiptError('');

      const response = await getBookingReceipt(bookingId, token);
      setActiveReceipt(response.receipt);
    } catch (error) {
      console.error(error);
      setReceiptError(copy.receiptError ?? 'Could not load the receipt right now.');
    } finally {
      setReceiptLoadingId('');
    }
  }



  async function runPaymentAction(
    bookingId: string,
    action: 'session' | 'sync'
  ) {
    if (!token) return;

    try {
      setPaymentUpdatingId(bookingId);
      setPaymentError('');
      setPaymentSuccess('');

      if (action === 'session') {
        const response = await createPaymentSession(bookingId, token);
        setPaymentSuccess(copy.paymentStarted);

        if (response.payment.checkoutUrl) {
          window.location.assign(response.payment.checkoutUrl);
          return;
        }
      } else {
        await syncBookingPayment(bookingId, token);
        setPaymentSuccess(copy.paymentSynced);
      }

      await refreshDashboard();
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        setPaymentError(error.message);
      } else {
        setPaymentError(copy.paymentActionError);
      }
    } finally {
      setPaymentUpdatingId('');
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('booking');
    const paymentReference = params.get('payment');

    if (!token || !bookingId || !paymentReference) return;

    void runPaymentAction(bookingId, 'sync').finally(() => {
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, '', cleanUrl);
    });
  }, [token]);

  const stats = dashboardData?.stats;
  const listings = dashboardData?.listings ?? [];
  const activities = dashboardData?.activities ?? [];
  const bookings = dashboardData?.bookings ?? [];
  const receivedBookings = dashboardData?.receivedBookings ?? [];
  const receivedBookingOperations = dashboardData?.receivedBookingOperations ?? [];
  const notifications = dashboardData?.notifications ?? [];

  const receivedBookingStatusFilters: Array<{
    value: ReceivedBookingStatusFilter;
    label: string;
  }> = [
    {
      value: 'ALL',
      label: copy.allStatuses ?? 'All statuses'
    },
    {
      value: 'PENDING',
      label: copy.showPending ?? 'Pending'
    },
    {
      value: 'CANCELLATION_REQUESTED',
      label: copy.showCancellations ?? 'Cancellations'
    },
    {
      value: 'APPROVED',
      label: copy.showApproved ?? 'Approved'
    }
  ];

  const matchesReceivedBookingStatusFilter = (booking: ApiBooking) => {
    if (receivedBookingStatusFilter === 'ALL') return true;

    if (receivedBookingStatusFilter === 'APPROVED') {
      return booking.status === 'OWNER_APPROVED' || booking.status === 'ADMIN_CONFIRMED';
    }

    return booking.status === receivedBookingStatusFilter;
  };

  const filteredReceivedBookings = receivedBookings.filter(matchesReceivedBookingStatusFilter);

  const dashboardBookingFocusId = searchParams.get('booking') ?? '';
  const focusedDashboardBooking = dashboardBookingFocusId
    ? [...bookings, ...receivedBookings].find(
        (booking) => booking.id === dashboardBookingFocusId
      )
    : undefined;
  const showDashboardDeepLinkNotice = Boolean(
    dashboardBookingFocusId && !loading && dashboardData
  );

  function clearDashboardDeepLink() {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.delete('booking');
    nextParams.delete('payment');

    setSearchParams(nextParams, {
      replace: true
    });
  }

  useEffect(() => {
    if (!dashboardBookingFocusId) return;

    const isReceivedBooking = receivedBookings.some(
      (booking) => booking.id === dashboardBookingFocusId
    );

    const isVisibleReceivedBooking = filteredReceivedBookings.some(
      (booking) => booking.id === dashboardBookingFocusId
    );

    if (isReceivedBooking && !isVisibleReceivedBooking) {
      setReceivedBookingStatusFilter('ALL');
    }
  }, [dashboardBookingFocusId, filteredReceivedBookings, receivedBookings]);

  useEffect(() => {
    if (!dashboardBookingFocusId || loading || !dashboardData) return;

    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-dashboard-booking-id="${dashboardBookingFocusId}"]`
      );

      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [dashboardBookingFocusId, dashboardData, loading, receivedBookingStatusFilter]);

  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;
  const isOperatorDashboard = isMarketplaceOperator;
  const accountRoleLabel = user ? getAccountRoleLabel(user.role, language) : '';
  const accountRoleDescription = user ? getAccountRoleDescription(user.role, language) : '';

  const accountDashboardCopy =
    language === 'ar'
      ? {
          workspace: 'مساحة المستخدم',
          heroTitle: 'تابع حجوزاتك، التنبيهات، والعناصر المحفوظة.',
          heroText:
            'استخدم لوحة التحكم لمتابعة طلباتك، المدفوعات، التنبيهات، والفرص الاستثمارية المحفوظة.',
          exploreListings: 'استكشف العقارات',
          exploreActivities: 'استكشف الأنشطة',
          insightAction: 'رؤى المستثمر',
          myRequests: 'طلباتي',
          inquiriesSent: 'استفسارات أرسلتها',
          pendingPaymentsTitle: 'مدفوعات قيد الانتظار',
          pendingPaymentsSmall: 'تحتاج متابعة الدفع',
          accountStatus: 'حالة الحساب',
          verifiedAccount: 'موثق',
          unverifiedAccount: 'بانتظار التحقق',
          roleSummary: 'نوع الحساب'
        }
      : {
          workspace: 'User workspace',
          heroTitle: 'Track your bookings, notifications, and saved opportunities.',
          heroText:
            'Use your dashboard to manage requests, payments, alerts, and saved investment opportunities.',
          exploreListings: 'Explore listings',
          exploreActivities: 'Explore activities',
          insightAction: 'Investor insights',
          myRequests: 'My requests',
          inquiriesSent: 'inquiries sent',
          pendingPaymentsTitle: 'Pending payments',
          pendingPaymentsSmall: 'need payment follow-up',
          accountStatus: 'Account status',
          verifiedAccount: 'Verified',
          unverifiedAccount: 'Awaiting verification',
          roleSummary: 'Account type'
        };

  const dashboardWorkspaceCopy =
    language === 'ar'
      ? {
          aria: 'أقسام لوحة التحكم',
          ownerListingsTitle: 'عقارات المالك',
          ownerListingsText: 'راجع حالة النشر، جودة الوسائط، والتحديثات المطلوبة لعقاراتك.',
          ownerListingsAction: 'إدارة العقارات',
          providerActivitiesTitle: 'أنشطة المزود',
          providerActivitiesText: 'تابع الأنشطة، الصور، الطلبات، وحالة الموافقة قبل النشر.',
          providerActivitiesAction: 'إدارة الأنشطة',
          receivedBookingsTitle: 'طلبات الحجز',
          receivedBookingsText: 'راجع الطلبات المستلمة، الموافقات، الإلغاءات، وحالة الدفع.',
          receivedBookingsAction: 'راجع الطلبات',
          operationsTitle: 'تنبيهات التشغيل',
          operationsText: 'تابع التنبيهات غير المقروءة والإجراءات التي تحتاج متابعة.',
          operationsAction: 'فتح التنبيهات',
          buyerBookingsTitle: 'حجوزاتي',
          buyerBookingsText: 'تابع طلباتك، الدفع، الإلغاء، وإيصالات الحجز من مكان واحد.',
          buyerBookingsAction: 'راجع حجوزاتي',
          buyerPaymentsTitle: 'المدفوعات',
          buyerPaymentsText: 'راجع أي مدفوعات معلقة أو حجوزات تحتاج متابعة دفع.',
          buyerPaymentsAction: 'استكشف الأنشطة',
          buyerNotificationsTitle: 'التنبيهات',
          buyerNotificationsText: 'تابع تحديثات الحجز والدفع والمراسلات المهمة.',
          buyerNotificationsAction: 'فتح التنبيهات',
          buyerExploreTitle: 'فرص جديدة',
          buyerExploreText: 'استكشف عقارات وأنشطة وفرص استثمارية جديدة في السوق.',
          buyerExploreAction: 'تصفح السوق',
          items: 'عنصر',
          pending: 'قيد المتابعة'
        }
      : {
          aria: 'Dashboard workspace sections',
          ownerListingsTitle: 'Owner listings',
          ownerListingsText: 'Review publishing status, media quality, and required updates for your properties.',
          ownerListingsAction: 'Manage listings',
          providerActivitiesTitle: 'Provider activities',
          providerActivitiesText: 'Track activities, media, booking requests, and approval status before publishing.',
          providerActivitiesAction: 'Manage activities',
          receivedBookingsTitle: 'Booking requests',
          receivedBookingsText: 'Review incoming requests, approvals, cancellations, and payment status.',
          receivedBookingsAction: 'Review requests',
          operationsTitle: 'Operational alerts',
          operationsText: 'Follow unread notifications and workflow items that need attention.',
          operationsAction: 'Open notifications',
          buyerBookingsTitle: 'My bookings',
          buyerBookingsText: 'Track your requests, payment, cancellation, and booking receipts from one place.',
          buyerBookingsAction: 'Review bookings',
          buyerPaymentsTitle: 'Payments',
          buyerPaymentsText: 'Review pending payments or bookings that need payment follow-up.',
          buyerPaymentsAction: 'Explore activities',
          buyerNotificationsTitle: 'Notifications',
          buyerNotificationsText: 'Follow booking, payment, and important marketplace updates.',
          buyerNotificationsAction: 'Open notifications',
          buyerExploreTitle: 'New opportunities',
          buyerExploreText: 'Explore new properties, activities, and investment opportunities in the marketplace.',
          buyerExploreAction: 'Browse marketplace',
          items: 'items',
          pending: 'pending'
        };

  const dashboardWorkspaceCards = isOperatorDashboard
    ? [
        {
          title: dashboardWorkspaceCopy.ownerListingsTitle,
          text: dashboardWorkspaceCopy.ownerListingsText,
          action: dashboardWorkspaceCopy.ownerListingsAction,
          metric: listings.length,
          meta: `${stats?.pendingListings ?? 0} ${dashboardWorkspaceCopy.pending}`,
          to: '/dashboard',
          sectionId: 'dashboard-portfolio',
          icon: Home
        },
        {
          title: dashboardWorkspaceCopy.providerActivitiesTitle,
          text: dashboardWorkspaceCopy.providerActivitiesText,
          action: dashboardWorkspaceCopy.providerActivitiesAction,
          metric: activities.length,
          meta: `${stats?.pendingActivities ?? 0} ${dashboardWorkspaceCopy.pending}`,
          to: '/dashboard',
          sectionId: 'dashboard-portfolio',
          icon: Sparkles
        },
        {
          title: dashboardWorkspaceCopy.receivedBookingsTitle,
          text: dashboardWorkspaceCopy.receivedBookingsText,
          action: dashboardWorkspaceCopy.receivedBookingsAction,
          metric: receivedBookings.length,
          meta: `${stats?.receivedPendingBookings ?? 0} ${dashboardWorkspaceCopy.pending}`,
          to: '/dashboard',
          sectionId: 'dashboard-received-bookings',
          icon: CalendarDays
        },
        {
          title: dashboardWorkspaceCopy.operationsTitle,
          text: dashboardWorkspaceCopy.operationsText,
          action: dashboardWorkspaceCopy.operationsAction,
          metric: unreadNotifications,
          meta: `${notifications.length} ${dashboardWorkspaceCopy.items}`,
          to: '/dashboard',
          sectionId: 'dashboard-notifications',
          icon: Bell
        }
      ]
    : [
        {
          title: dashboardWorkspaceCopy.buyerBookingsTitle,
          text: dashboardWorkspaceCopy.buyerBookingsText,
          action: dashboardWorkspaceCopy.buyerBookingsAction,
          metric: bookings.length,
          meta: `${stats?.submittedBookings ?? 0} ${dashboardWorkspaceCopy.items}`,
          to: '/dashboard',
          sectionId: 'dashboard-my-bookings',
          icon: CalendarDays
        },
        {
          title: dashboardWorkspaceCopy.buyerPaymentsTitle,
          text: dashboardWorkspaceCopy.buyerPaymentsText,
          action: dashboardWorkspaceCopy.buyerPaymentsAction,
          metric: stats?.pendingPayments ?? 0,
          meta: dashboardWorkspaceCopy.pending,
          to: '/dashboard',
          sectionId: 'dashboard-my-bookings',
          icon: CreditCard
        },
        {
          title: dashboardWorkspaceCopy.buyerNotificationsTitle,
          text: dashboardWorkspaceCopy.buyerNotificationsText,
          action: dashboardWorkspaceCopy.buyerNotificationsAction,
          metric: unreadNotifications,
          meta: `${notifications.length} ${dashboardWorkspaceCopy.items}`,
          to: '/notifications',
          sectionId: '',
          icon: Bell
        },
        {
          title: dashboardWorkspaceCopy.buyerExploreTitle,
          text: dashboardWorkspaceCopy.buyerExploreText,
          action: dashboardWorkspaceCopy.buyerExploreAction,
          metric: stats?.submittedInquiries ?? 0,
          meta: accountDashboardCopy.inquiriesSent,
          to: '/listings',
          sectionId: '',
          icon: Eye
        }
      ];

  const dashboardSectionCopy =
    language === 'ar'
      ? {
          overviewTitle: 'ملخص سريع',
          overviewText: 'أرقام الحساب والحالة الحالية قبل الدخول في تفاصيل الحجوزات والمحفظة.',
          operationsTitle: 'تشغيل الحجوزات',
          operationsText: 'متابعة ضغط الحجوزات، الطلبات المستلمة، وحالات الدفع.',
          bookingsTitle: 'حجوزاتي ومدفوعاتي',
          bookingsText: 'طلباتك الشخصية، حالة الدفع، الإلغاء، والإيصالات.',
          portfolioTitle: 'محفظة المالك والمزود',
          portfolioText: 'العقارات والأنشطة المرتبطة بحسابك مع حالة النشر وجودة الوسائط.'
        }
      : {
          overviewTitle: 'Quick overview',
          overviewText: 'Account numbers and current state before the detailed booking and portfolio sections.',
          operationsTitle: 'Booking operations',
          operationsText: 'Track booking pressure, received requests, cancellations, and payment state.',
          bookingsTitle: 'My bookings and payments',
          bookingsText: 'Your personal requests, payment state, cancellation flow, and receipts.',
          portfolioTitle: 'Owner and provider portfolio',
          portfolioText: 'Listings and activities connected to your account with publishing and media-quality status.'
        };

  const dashboardTabCopy =
    language === 'ar'
      ? {
          aria: 'تبويبات لوحة التحكم',
          overview: 'نظرة عامة',
          operations: 'التشغيل',
          receivedBookings: 'طلبات الحجز',
          myBookings: 'حجوزاتي',
          portfolio: 'المحفظة',
          advanced: 'الأدوات المتقدمة'
        }
      : {
          aria: 'Dashboard workspace tabs',
          overview: 'Overview',
          operations: 'Operations',
          receivedBookings: 'Booking requests',
          myBookings: 'My bookings',
          portfolio: 'Portfolio',
          advanced: 'Advanced tools'
        };

  const dashboardTabs: DashboardWorkspaceTabItem[] = isOperatorDashboard
    ? [
        {
          id: 'overview',
          label: dashboardTabCopy.overview,
          sectionId: 'dashboard-overview',
          icon: BarChart3
        },
        {
          id: 'operations',
          label: dashboardTabCopy.operations,
          sectionId: 'dashboard-operations',
          icon: CalendarDays
        },
        {
          id: 'received-bookings',
          label: dashboardTabCopy.receivedBookings,
          sectionId: 'dashboard-received-bookings',
          icon: MessageCircle
        },
        {
          id: 'my-bookings',
          label: dashboardTabCopy.myBookings,
          sectionId: 'dashboard-my-bookings',
          icon: CreditCard
        },
        {
          id: 'portfolio',
          label: dashboardTabCopy.portfolio,
          sectionId: 'dashboard-portfolio',
          icon: Home
        },
        {
          id: 'advanced',
          label: dashboardTabCopy.advanced,
          sectionId: 'dashboard-advanced-tools',
          icon: ShieldCheck
        }
      ]
    : [
        {
          id: 'overview',
          label: dashboardTabCopy.overview,
          sectionId: 'dashboard-overview',
          icon: BarChart3
        },
        {
          id: 'my-bookings',
          label: dashboardTabCopy.myBookings,
          sectionId: 'dashboard-my-bookings',
          icon: CreditCard
        },
        {
          id: 'advanced',
          label: dashboardTabCopy.advanced,
          sectionId: 'dashboard-advanced-tools',
          icon: ShieldCheck
        }
      ];

  function scrollToDashboardSection(sectionId: string) {
    const matchingDashboardTab = dashboardTabs.find((tab) => tab.sectionId === sectionId);

    if (matchingDashboardTab) {
      setActiveDashboardTab(matchingDashboardTab.id);
    }

    const section = document.getElementById(sectionId);

    if (!section) return;

    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

    section.focus({
      preventScroll: true
    });
  }

  useEffect(() => {
    const focus = searchParams.get('focus') ?? '';
    const sectionIdByFocus: Record<string, string> = {
      overview: 'dashboard-overview',
      operations: 'dashboard-operations',
      'received-bookings': 'dashboard-received-bookings',
      'my-bookings': 'dashboard-my-bookings',
      portfolio: 'dashboard-portfolio',
      notifications: 'dashboard-notifications'
    };

    const sectionId = sectionIdByFocus[focus];

    if (!sectionId || loading || !dashboardData) return;

    const timer = window.setTimeout(() => {
      scrollToDashboardSection(sectionId);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [dashboardData, loading, searchParams]);

  return (
    <section className="page-section container dashboard-page">
      <SectionHeader
        eyebrow={t.dashboard.eyebrow}
        title={t.dashboard.title}
        description={t.dashboard.description}
        actions={
          isOperatorDashboard ? (
            <ButtonLink to="/add-listing" variant="soft">
              <Plus size={16} aria-hidden="true" />
              {t.common.listProperty}
            </ButtonLink>
          ) : (
            <ButtonLink to="/listings" variant="soft">
              <Eye size={16} aria-hidden="true" />
              {accountDashboardCopy.exploreListings}
            </ButtonLink>
          )
        }
      />

      <EmailVerificationBanner />

      {loading ? (
        <div className="empty-state">
          <p>{copy.loading}</p>
        </div>
      ) : null}

      {loadError ? (
        <div className="empty-state">
          <p className="form-error" role="alert">
            {loadError}
          </p>
        </div>
      ) : null}

      {!loading && !loadError && dashboardData ? (
        <>
          <div className="dashboard-hero-card">
            <div>
              <p className="eyebrow">
                {isOperatorDashboard ? copy.ownerWorkspace : accountDashboardCopy.workspace}
              </p>
              <h2>{isOperatorDashboard ? copy.heroTitle : accountDashboardCopy.heroTitle}</h2>
              <p>{isOperatorDashboard ? copy.heroText : accountDashboardCopy.heroText}</p>
            </div>

            <div className="dashboard-hero-actions">
              {isOperatorDashboard ? (
                <>
                  <ButtonLink to="/add-listing">
                    <Plus size={16} aria-hidden="true" />
                    {t.common.listProperty}
                  </ButtonLink>

                  <ButtonLink to="/add-activity" variant="secondary">
                    <Sparkles size={16} aria-hidden="true" />
                    {copy.listActivity}
                  </ButtonLink>

                  <ButtonLink to="/listings" variant="secondary">
                    <Eye size={16} aria-hidden="true" />
                    {copy.viewListings}
                  </ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink to="/listings">
                    <Eye size={16} aria-hidden="true" />
                    {accountDashboardCopy.exploreListings}
                  </ButtonLink>

                  <ButtonLink to="/activities" variant="secondary">
                    <Sparkles size={16} aria-hidden="true" />
                    {accountDashboardCopy.exploreActivities}
                  </ButtonLink>

                  <ButtonLink to="/market-insights" variant="secondary">
                    <BarChart3 size={16} aria-hidden="true" />
                    {accountDashboardCopy.insightAction}
                  </ButtonLink>
                </>
              )}
            </div>
          </div>

          {showDashboardDeepLinkNotice ? (
            <div
              className={`dashboard-deeplink-banner${
                focusedDashboardBooking ? '' : ' dashboard-deeplink-banner--warning'
              }`}
              role={focusedDashboardBooking ? 'status' : 'alert'}
            >
              <div>
                <strong>
                  {focusedDashboardBooking
                    ? copy.focusedBookingTitle
                    : copy.missingBookingTitle}
                </strong>
                <p>
                  {focusedDashboardBooking
                    ? copy.focusedBookingText
                    : copy.missingBookingText}
                </p>
              </div>

              <button
                className="button-link button-link--ghost"
                type="button"
                onClick={clearDashboardDeepLink}
              >
                {copy.clearFocusedBooking}
              </button>
            </div>
          ) : null}

            <div className="dashboard-role-sections" aria-label={dashboardWorkspaceCopy.aria}>
              {dashboardWorkspaceCards.map((card) => {
                const Icon = card.icon;

                return (
                  <article className="dashboard-role-card" key={card.title}>
                    <div className="dashboard-role-card__icon" aria-hidden="true">
                      <Icon size={19} />
                    </div>

                    <div className="dashboard-role-card__body">
                      <div>
                        <h3>{card.title}</h3>
                        <p>{card.text}</p>
                      </div>

                      <div className="dashboard-role-card__footer">
                        <span>
                          <strong>{card.metric}</strong>
                          <small>{card.meta}</small>
                        </span>

                        {card.sectionId ? (
                          <button
                            className="button-link button-link--ghost"
                            type="button"
                            onClick={() => scrollToDashboardSection(card.sectionId)}
                          >
                            {card.action}
                            <ArrowUpRight size={15} aria-hidden="true" />
                          </button>
                        ) : (
                          <ButtonLink to={card.to} variant="ghost">
                            {card.action}
                            <ArrowUpRight size={15} aria-hidden="true" />
                          </ButtonLink>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

              <DashboardWorkspaceTabs
                ariaLabel={dashboardTabCopy.aria}
                activeTabId={activeDashboardTab}
                tabs={dashboardTabs}
                onSelect={(tab) => scrollToDashboardSection(tab.sectionId)}
              />

            <div
              className="dashboard-section-heading"
              id="dashboard-overview"
              tabIndex={-1}
            >
              <p className="eyebrow">{dashboardSectionCopy.overviewTitle}</p>
              <h2>{dashboardSectionCopy.overviewTitle}</h2>
              <p>{dashboardSectionCopy.overviewText}</p>
            </div>

          <div className="dashboard-grid">
            {isOperatorDashboard ? (
              <>
                <article className="metric-card metric-card--accent">
                  <span>
                    <Home size={18} aria-hidden="true" />
                    {t.dashboard.totalListings}
                  </span>
                  <strong>{stats?.totalListings ?? 0}</strong>
                  <small>
                    {stats?.approvedListings ?? 0} {copy.approvedCount} ·{' '}
                    {stats?.rejectedListings ?? 0} {copy.rejectedCount}
                  </small>
                </article>

                <article className="metric-card">
                  <span>
                    <MessageCircle size={18} aria-hidden="true" />
                    {t.dashboard.pendingInquiries}
                  </span>
                  <strong>{stats?.receivedInquiries ?? 0}</strong>
                  <small>{copy.pendingInquiriesSmall}</small>
                </article>

                <article className="metric-card">
                  <span>
                    <ShieldCheck size={18} aria-hidden="true" />
                    {t.dashboard.profileScore}
                  </span>
                  <strong>{stats?.approvedListings || stats?.approvedActivities ? 'Active' : 'New'}</strong>
                  <small>{copy.profileQuality}</small>
                </article>

                <article className="metric-card">
                  <span>
                    <Clock3 size={18} aria-hidden="true" />
                    {copy.shortStays}
                  </span>
                  <strong>{stats?.pendingListings ?? 0}</strong>
                  <small>{copy.shortStaysSmall}</small>
                </article>

                <article className="metric-card">
                  <span>
                    <Sparkles size={18} aria-hidden="true" />
                    {copy.activities}
                  </span>
                  <strong>{stats?.totalActivities ?? 0}</strong>
                  <small>
                    {stats?.approvedActivities ?? 0} {copy.approvedCount} ·{' '}
                    {stats?.pendingActivities ?? 0} {copy.pending}
                  </small>
                </article>

                <article className="metric-card">
                  <span>
                    <CreditCard size={18} aria-hidden="true" />
                    {copy.payment}
                  </span>
                  <strong>{stats?.pendingPayments ?? 0}</strong>
                  <small>
                    {stats?.submittedBookings ?? 0} {copy.myBookings.toLowerCase()}
                  </small>
                </article>

                <article className="metric-card">
                  <span>
                    <Bell size={18} aria-hidden="true" />
                    {copy.notifications}
                  </span>
                  <strong>{notifications.length}</strong>
                  <small>
                    {unreadNotifications} {copy.unreadNotifications}
                  </small>
                </article>
              </>
            ) : (
              <>
                <article className="metric-card metric-card--accent">
                  <span>
                    <Users size={18} aria-hidden="true" />
                    {accountDashboardCopy.myRequests}
                  </span>
                  <strong>{stats?.submittedBookings ?? 0}</strong>
                  <small>
                    {stats?.submittedInquiries ?? 0} {accountDashboardCopy.inquiriesSent}
                  </small>
                </article>

                <article className="metric-card">
                  <span>
                    <CreditCard size={18} aria-hidden="true" />
                    {accountDashboardCopy.pendingPaymentsTitle}
                  </span>
                  <strong>{stats?.pendingPayments ?? 0}</strong>
                  <small>{accountDashboardCopy.pendingPaymentsSmall}</small>
                </article>

                <article className="metric-card">
                  <span>
                    <Bell size={18} aria-hidden="true" />
                    {copy.notifications}
                  </span>
                  <strong>{notifications.length}</strong>
                  <small>
                    {unreadNotifications} {copy.unreadNotifications}
                  </small>
                </article>

                <article className="metric-card">
                  <span>
                    <ShieldCheck size={18} aria-hidden="true" />
                    {accountDashboardCopy.roleSummary}
                  </span>
                  <strong>{accountRoleLabel}</strong>
                  <small>{accountRoleDescription}</small>
                </article>

                <article className="metric-card">
                  <span>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    {accountDashboardCopy.accountStatus}
                  </span>
                  <strong>
                    {user?.emailVerified
                      ? accountDashboardCopy.verifiedAccount
                      : accountDashboardCopy.unverifiedAccount}
                  </strong>
                  <small>{user?.email ?? ''}</small>
                </article>
              </>
            )}
          </div>

          {isOperatorDashboard ? (
            <>
          <div

            className="dashboard-section-heading"

            id="dashboard-operations"

            tabIndex={-1}

          >

            <p className="eyebrow">{dashboardSectionCopy.operationsTitle}</p>

            <h2>{dashboardSectionCopy.operationsTitle}</h2>

            <p>{dashboardSectionCopy.operationsText}</p>

          </div>


          <div className="table-card table-card--premium dashboard-operations-card">
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{copy.providerOperationsTitle}</p>
                <h2>{copy.providerOperationsTitle}</h2>
                <p>{copy.providerOperationsText}</p>
              </div>

              <div className="dashboard-booking-filter-group" aria-label={copy.receivedBookingsTitle}>
                {receivedBookingStatusFilters.map((filter) => (
                  <button
                    className={`dashboard-booking-filter ${
                      receivedBookingStatusFilter === filter.value
                        ? 'dashboard-booking-filter--active'
                        : ''
                    }`}
                    key={filter.value}
                    type="button"
                    onClick={() => setReceivedBookingStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {receivedBookingOperations.length > 0 ? (
              <div className="dashboard-operation-days">
                {receivedBookingOperations.map((day) => (
                  <article className="dashboard-operation-day" key={day.date}>
                    <div className="dashboard-operation-day__header">
                      <span>
                        <CalendarDays size={16} aria-hidden="true" />
                        {day.date === 'unscheduled'
                          ? copy.unscheduled
                          : formatBookingDate(day.date, language)}
                      </span>

                      <strong>
                        {day.totalBookings} {copy.receivedBookingsTitle.toLowerCase()}
                      </strong>
                    </div>

                    <div className="dashboard-operation-day__metrics">
                      <span>
                        {copy.totalGuests}
                        <strong>{day.totalGuests}</strong>
                      </span>

                      <span>
                        {copy.pendingReview}
                        <strong>{day.pendingBookings}</strong>
                      </span>

                      <span>
                        {copy.approvedBookings}
                        <strong>{day.approvedBookings}</strong>
                      </span>

                      <span>
                        {copy.cancellationRequests}
                        <strong>{day.cancellationRequests}</strong>
                      </span>

                      <span>
                        {copy.paidBookings}
                        <strong>{day.paidBookings}</strong>
                      </span>

                      <span>
                        {copy.capacity}
                        <strong>{day.capacityGuests ?? '—'}</strong>
                      </span>

                      <span>
                        {copy.availableCapacity}
                        <strong>{day.availableGuests ?? '—'}</strong>
                      </span>
                    </div>

                    <div className="dashboard-operation-day__bookings">
                      {day.bookings.slice(0, 4).map((booking) => (
                        <span key={booking.id}>
                          <StatusIcon status={booking.status} />
                          {getBookingTitle(booking, language)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>{copy.noOperations}</p>
              </div>
            )}
          </div>


          <div
              id="dashboard-received-bookings"
              tabIndex={-1}
              className="table-card table-card--premium dashboard-received-bookings-card"
            >
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{copy.receivedBookingsTitle}</p>
                <h2>{copy.receivedBookingsTitle}</h2>
                <p>{copy.receivedBookingsText}</p>
              </div>
            </div>

            {bookingActionError ? (
              <p className="form-error" role="alert">
                {bookingActionError}
              </p>
            ) : null}

            {bookingActionSuccess ? (
              <p className="form-success" role="status">
                {bookingActionSuccess}
              </p>
            ) : null}

            {filteredReceivedBookings.length > 0 ? (
              <div className="dashboard-received-bookings-list">
                {filteredReceivedBookings.map((booking) => (
                  <article
                    className={`dashboard-received-booking-item ${
                      dashboardBookingFocusId === booking.id ? 'dashboard-deeplink-highlight' : ''
                    }`}
                    data-dashboard-booking-id={booking.id}
                    key={booking.id}
                  >
                    <div>
                      <div className="dashboard-booking-kicker">
                        <span>{getBookingTypeLabel(booking, language)}</span>

                        <span className={`status-pill ${getStatusClass(booking.status)}`}>
                          <StatusIcon status={booking.status} />
                          {getBookingStatusLabel(booking.status, language)}
                        </span>
                      </div>

                      <strong>{getBookingTitle(booking, language)}</strong>
                      <span>{getBookingSubtitle(booking, language)}</span>

                      <div className="dashboard-booking-meta">
                        <span>
                          <CalendarDays size={15} aria-hidden="true" />
                          {copy.bookingDate}: {formatBookingDate(booking.scheduledDate, language)}
                        </span>

                        {booking.preferredTime ? (
                          <span>
                            <Clock3 size={15} aria-hidden="true" />
                            {copy.preferredTime}: {booking.preferredTime}
                          </span>
                        ) : null}

                        <span>
                          <Users size={15} aria-hidden="true" />
                          {booking.guests} {copy.guests}
                        </span>

                        <span>
                          <CreditCard size={15} aria-hidden="true" />
                          {copy.amount}: {formatPaymentAmount(booking, copy.paymentNotRequired)}
                        </span>
                      </div>

                      <div className="dashboard-received-booking-contact">
                        <span>
                          <strong>{copy.customer}:</strong>{' '}
                          {booking.contactName || '—'}
                        </span>

                        <span>
                          <strong>{copy.contact}:</strong>{' '}
                          {booking.contactEmail || booking.contactPhone || '—'}
                        </span>
                      </div>

                      {booking.message ? (
                        <p className="dashboard-booking-note">{booking.message}</p>
                      ) : null}

                      {booking.cancellationReason ? (
                        <p className="dashboard-booking-note">
                          {copy.cancellationReason}: {booking.cancellationReason}
                        </p>
                      ) : null}

                      <DashboardWhatsAppActions
                        item={booking}
                        itemType="booking"
                        language={language}
                      />
                    </div>

                    {booking.status === 'PENDING' ? (
                      <div className="dashboard-received-booking-actions">
                        <button
                          className="button-link button-link--primary"
                          type="button"
                          disabled={bookingUpdatingId === booking.id}
                          onClick={() => void runOwnerBookingAction(booking.id, 'OWNER_APPROVED')}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          {copy.approveBooking}
                        </button>

                        <button
                          className="button-link button-link--secondary"
                          type="button"
                          disabled={bookingUpdatingId === booking.id}
                          onClick={() => void runOwnerBookingAction(booking.id, 'OWNER_REJECTED')}
                        >
                          <XCircle size={16} aria-hidden="true" />
                          {copy.rejectBooking}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>{copy.emptyReceivedBookings}</p>
              </div>
            )}
          </div>

            </>
          ) : null}

          <div


            className="dashboard-section-heading"


            id="dashboard-my-bookings"


            tabIndex={-1}


          >


            <p className="eyebrow">{dashboardSectionCopy.bookingsTitle}</p>


            <h2>{dashboardSectionCopy.bookingsTitle}</h2>


            <p>{dashboardSectionCopy.bookingsText}</p>


          </div>



          <div className="table-card table-card--premium dashboard-bookings-card dashboard-bookings-card--enhanced">
            <div className="table-card__header">
              <div>
                <p className="eyebrow">{copy.payment}</p>
                <h2>{copy.myBookings}</h2>
              </div>
            </div>

            {paymentError ? (
              <p className="form-error" role="alert">
                {paymentError}
              </p>
            ) : null}

            {paymentSuccess ? (
              <p className="form-success" role="status">
                {paymentSuccess}
              </p>
            ) : null}

            {bookings.length > 0 ? (
              <div className="dashboard-bookings-list dashboard-bookings-list--enhanced">
                {bookings.map((booking) => {
                  const paymentStatus = booking.payment?.status ?? 'NOT_REQUIRED';
                  const paymentAmount = getPaymentAmountValue(booking);
                  const paymentPending = paymentStatus === 'PENDING';
                  const paymentPaid = paymentStatus === 'PAID';
                  const paymentFailed = paymentStatus === 'FAILED';
                  const paymentRequired =
                    paymentPending || paymentPaid || paymentFailed || paymentAmount > 0;

                  const paymentLabel = paymentPaid
                    ? copy.paymentPaid
                    : paymentPending
                      ? copy.paymentPending
                      : paymentFailed
                        ? copy.paymentFailed
                        : copy.paymentNotRequired;

                  const paymentMessage = paymentPaid
                    ? copy.paymentPaidText
                    : paymentPending
                      ? copy.paymentReadyText
                      : paymentFailed
                        ? copy.paymentFailedText
                        : copy.paymentNotRequiredText;

                  const timelineSteps: TimelineStep[] = [
                    {
                      label: copy.requestReceived,
                      state: 'done'
                    },
                    {
                      label: copy.providerReview,
                      state: paymentPending || paymentPaid ? 'done' : 'active'
                    },
                    {
                      label: paymentRequired ? copy.paymentStep : copy.paymentNotRequired,
                      state: paymentPaid
                        ? 'done'
                        : paymentFailed
                          ? 'rejected'
                          : paymentPending
                            ? 'active'
                            : 'pending'
                    },
                    {
                      label: copy.confirmedStep,
                      state: paymentPaid ? 'done' : 'pending'
                    }
                  ];

                  return (
                    <article
                      className={`dashboard-booking-item dashboard-booking-item--enhanced dashboard-booking-item--${getStatusClass(paymentStatus)} ${
                        dashboardBookingFocusId === booking.id ? 'dashboard-deeplink-highlight' : ''
                      }`}
                      data-dashboard-booking-id={booking.id}
                      key={booking.id}
                    >
                      <div className="dashboard-booking-main">
                        <div className="dashboard-booking-kicker">
                          <span>{getBookingTypeLabel(booking, language)}</span>

                          <span className={`status-pill ${getStatusClass(paymentStatus)}`}>
                            <StatusIcon status={paymentStatus} />
                            {paymentLabel}
                          </span>
                        </div>

                        <strong>{getBookingTitle(booking, language)}</strong>
                        <span>{getBookingSubtitle(booking, language)}</span>

                        <div className="dashboard-booking-meta">
                          <span>
                            <CalendarDays size={15} aria-hidden="true" />
                            {copy.bookingDate}: {formatBookingDate(booking.scheduledDate, language)}
                          </span>

                          <span>
                            <Users size={15} aria-hidden="true" />
                            {booking.guests} {copy.guests}
                          </span>

                          <span>
                            <CreditCard size={15} aria-hidden="true" />
                            {copy.amount}: {formatPaymentAmount(booking, copy.paymentNotRequired)}
                          </span>
                        </div>

                        <div className="dashboard-booking-timeline" aria-label={copy.bookingFlow}>
                          {timelineSteps.map((step) => (
                            <span className={getTimelineStepClass(step)} key={step.label}>
                              <StatusIcon status={step.state === 'rejected' ? 'FAILED' : step.state === 'done' ? 'PAID' : undefined} />
                              {step.label}
                            </span>
                          ))}
                        </div>

                        <p className="dashboard-booking-note">{paymentMessage}</p>

                        {booking.status === 'CANCELLATION_REQUESTED' ? (
                          <p className="dashboard-booking-note">
                            {copy.cancellationRequestedStatus}
                          </p>
                        ) : null}

                        {booking.cancellationReason ? (
                          <p className="dashboard-booking-note">
                            {copy.cancellationReason}: {booking.cancellationReason}
                          </p>
                        ) : null}
                      </div>

                      <div className="dashboard-booking-payment">
                        <span className={`status-pill ${getStatusClass(paymentStatus)}`}>
                          <StatusIcon status={paymentStatus} />
                          {paymentLabel}
                        </span>

                        <strong>{formatPaymentAmount(booking, copy.paymentNotRequired)}</strong>

                        {booking.payment && paymentStatus !== 'NOT_REQUIRED' ? (
                          <button
                            className="button-link button-link--secondary"
                            type="button"
                            disabled={receiptLoadingId === booking.id}
                            onClick={() => void openBookingReceipt(booking.id)}
                          >
                            {receiptLoadingId === booking.id
                              ? `${copy.loading}`
                              : copy.viewReceipt}
                          </button>
                        ) : null}

                        {paymentPending || paymentFailed ? (
                          <div className="dashboard-booking-actions">
                            <button
                              className="button-link button-link--secondary"
                              type="button"
                              disabled={paymentUpdatingId === booking.id}
                              onClick={() => void runPaymentAction(booking.id, 'session')}
                            >
                              {copy.startPayment}
                            </button>

                            {booking.payment?.providerSessionId ? (
                              <button
                                className="button-link button-link--primary"
                                type="button"
                                disabled={paymentUpdatingId === booking.id}
                                onClick={() => void runPaymentAction(booking.id, 'sync')}
                              >
                                {copy.refreshPayment}
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {booking.status !== 'OWNER_REJECTED' &&
                        booking.status !== 'CANCELLED' &&
                        booking.status !== 'CANCELLATION_REQUESTED' ? (
                          <button
                            className="button-link button-link--secondary"
                            type="button"
                            disabled={bookingUpdatingId === `cancel-${booking.id}`}
                            onClick={() => void runCustomerCancellationRequest(booking.id)}
                          >
                            {copy.requestCancellation}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>{copy.emptyBookings}</p>
                <ButtonLink to="/activities">
                  <Sparkles size={16} aria-hidden="true" />
                  {copy.viewMarketplace}
                </ButtonLink>
              </div>
            )}
          </div>

          {isOperatorDashboard ? (
            <>
          <div

            className="dashboard-section-heading"

            id="dashboard-portfolio"

            tabIndex={-1}

          >

            <p className="eyebrow">{dashboardSectionCopy.portfolioTitle}</p>

            <h2>{dashboardSectionCopy.portfolioTitle}</h2>

            <p>{dashboardSectionCopy.portfolioText}</p>

          </div>


          <div className="dashboard-split">
            <div className="table-card table-card--premium">
              <div className="table-card__header">
                <div>
                  <p className="eyebrow">{copy.portfolio}</p>
                  <h2>{copy.recentListings}</h2>
                </div>

                <ButtonLink to="/listings" variant="ghost">
                  {copy.viewMarketplace}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </ButtonLink>
              </div>

              {listings.length > 0 ? (
                <div className="responsive-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.dashboard.property}</th>
                        <th>{t.listings.location}</th>
                        <th>{t.addListing.type}</th>
                        <th>{t.addListing.price}</th>
                        <th>{copy.status}</th>
                        <th>{copy.actions}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {listings.map((listing) => (
                        <tr key={listing.id}>
                          <td>
                            <strong>{listing.title}</strong>
                            <span>{listing.transaction}</span>
                          </td>

                          <td>{listing.location}</td>
                          <td>{listing.type}</td>
                          <td>
                            {formatMarketplacePrice({
                              price: listing.price,
                              priceAmount: listing.priceAmount,
                              priceCurrency: listing.priceCurrency,
                              priceQualifier: listing.priceQualifier,
                              priceUnit: listing.priceUnit,
                              language
                            })}
                          </td>

                          <td>
                            <span className={`status-pill ${getStatusClass(listing.status)}`}>
                              <StatusIcon status={listing.status} />
                              {listing.status === 'APPROVED'
                                ? copy.approved
                                : listing.status === 'REJECTED'
                                  ? copy.rejected
                                  : copy.pending}
                            </span>
                          </td>

                          <td>
                            <div className="dashboard-row-actions">
                              <button
                                className="button-link button-link--ghost"
                                type="button"
                                onClick={() => setEditingListing(listing)}
                              >
                                {copy.editItem}
                              </button>

                              <DashboardWhatsAppActions
                                item={listing}
                                itemType="listing"
                                language={language}
                              />

                              <MediaQualityGuidance
                                item={listing}
                                itemType="listing"
                                language={language}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>{copy.emptyListings}</p>
                  <ButtonLink to="/add-listing">
                    <Plus size={16} aria-hidden="true" />
                    {copy.addFirstListing}
                  </ButtonLink>
                </div>
              )}
            </div>

            <aside className="dashboard-side-card">
              <div>
                <p className="eyebrow">{copy.recentActivities}</p>
                <h2>{copy.activities}</h2>
              </div>

              {activities.length > 0 ? (
                <div className="action-checklist">
                  {activities.map((activity) => (
                    <article className="dashboard-editable-item" key={activity.id}>
                      <span>
                        <StatusIcon status={activity.status} />
                        {activity.title}
                      </span>

                      <button
                        className="button-link button-link--ghost"
                        type="button"
                        onClick={() => setEditingActivity(activity)}
                      >
                        {copy.editItem}
                      </button>

                      <DashboardWhatsAppActions
                        item={activity}
                        itemType="activity"
                        language={language}
                      />

                      <MediaQualityGuidance
                        item={activity}
                        itemType="activity"
                        language={language}
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="action-checklist">
                  <span>{copy.emptyActivities}</span>
                  <ButtonLink to="/add-activity" variant="soft">
                    <Plus size={16} aria-hidden="true" />
                    {copy.addFirstActivity}
                  </ButtonLink>
                </div>
              )}


              <div
                  id="dashboard-notifications"
                  tabIndex={-1}
                  className="dashboard-notifications-card"
                >
                <div className="dashboard-notifications-header">
                  <div>
                    <p className="eyebrow">{copy.notifications}</p>
                    <h2>{copy.notifications}</h2>
                    <p>{copy.notificationsText}</p>
                  </div>

                  {unreadNotifications > 0 ? (
                    <button
                      className="button-link button-link--secondary dashboard-notification-read-button"
                      type="button"
                      disabled={notificationUpdatingId === 'all'}
                      onClick={() => void runMarkAllNotificationsRead()}
                    >
                      {copy.markAllAsRead}
                    </button>
                  ) : null}
                </div>

                {notificationActionError ? (
                  <p className="form-error" role="alert">
                    {notificationActionError}
                  </p>
                ) : null}

                {notifications.length > 0 ? (
                  <div className="dashboard-notifications-list">
                    {notifications.map((notification) => (
                      <article
                        className={`dashboard-notification-item ${
                          notification.readAt ? '' : 'dashboard-notification-item--unread'
                        }`}
                        key={notification.id}
                      >
                        <span>
                          <Bell size={15} aria-hidden="true" />
                          {notification.title}
                        </span>
                        <p>{notification.message}</p>

                        <div className="dashboard-notification-footer">
                          <small>{formatBookingDate(notification.createdAt, language)}</small>

                          {!notification.readAt ? (
                            <button
                              className="button-link button-link--ghost dashboard-notification-read-button"
                              type="button"
                              disabled={notificationUpdatingId === notification.id}
                              onClick={() => void runMarkNotificationRead(notification.id)}
                            >
                              {copy.markAsRead}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="action-checklist">
                    <span>{copy.emptyNotifications}</span>
                  </div>
                )}
              </div>

              <div>
                <p className="eyebrow">{copy.nextActions}</p>
                <h2>{copy.improveDiscovery}</h2>
                <p>{copy.improveText}</p>
              </div>

              <div className="action-checklist">
                <span>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {copy.addImages}
                </span>

                <span>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {copy.completeSpecs}
                </span>

                <span>
                  <BarChart3 size={16} aria-hidden="true" />
                  {copy.reviewPerformance}
                </span>
              </div>
            </aside>
          </div>

          <VerificationRequestWorkspace
            token={token}
            listings={listings}
            activities={activities}
            language={language}
          />

            </>
          ) : null}

          <div id="dashboard-advanced-tools" className="dashboard-advanced-tools-anchor" tabIndex={-1}>
            <Stage8DashboardPanel token={token} />
          </div>

          {editingListing ? (
            <OwnerMarketplaceEditModal
              listing={editingListing}
              token={token}
              language={language}
              onClose={() => setEditingListing(null)}
              onUpdated={() => refreshDashboard()}
            />
          ) : null}

          {editingActivity ? (
            <OwnerMarketplaceEditModal
              activity={editingActivity}
              token={token}
              language={language}
              onClose={() => setEditingActivity(null)}
              onUpdated={() => refreshDashboard()}
            />
          ) : null}

      {activeReceipt ? (
        <div className="receipt-modal__backdrop" role="presentation">
          <div
            aria-label={copy.viewReceipt}
            aria-modal="true"
            className="receipt-modal"
            role="dialog"
          >
            <ReceiptView
              receipt={activeReceipt}
              onClose={() => setActiveReceipt(null)}
            />
          </div>
        </div>
      ) : null}

      {receiptError ? (
        <div className="dashboard-toast" role="alert">
          {receiptError}
        </div>
      ) : null}
        </>
      ) : null}
    </section>
  );
}