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

import {
  createPaymentSession,
  syncBookingPayment,
  updateOwnerBookingStatus,
  type ApiBooking
} from '../api/bookings';
import { ApiError } from '../api/client';
import { getDashboardData, type DashboardData } from '../api/dashboard';
import {
  markAllNotificationsRead,
  markNotificationRead
} from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { formatMarketplacePrice } from '../utils/format';

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

function getTimelineStepClass(step: TimelineStep) {
  return `dashboard-booking-step dashboard-booking-step--${step.state}`;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { token } = useAuth();

  useDocumentTitle('Dashboard');

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [paymentUpdatingId, setPaymentUpdatingId] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');
  const [bookingUpdatingId, setBookingUpdatingId] = useState('');
  const [bookingActionError, setBookingActionError] = useState('');
  const [bookingActionSuccess, setBookingActionSuccess] = useState('');
  const [notificationUpdatingId, setNotificationUpdatingId] = useState('');
  const [notificationActionError, setNotificationActionError] = useState('');

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
          customer: 'العميل',
          contact: 'التواصل',
          preferredTime: 'الوقت المفضل',
          emptyBookings: 'لا توجد حجوزات مرتبطة بحسابك بعد.',
          emptyReceivedBookings: 'لا توجد طلبات حجز مستلمة حالياً.'
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
          customer: 'Customer',
          contact: 'Contact',
          preferredTime: 'Preferred time',
          emptyBookings: 'No bookings are connected to your account yet.',
          emptyReceivedBookings: 'No received booking requests yet.'
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
  const notifications = dashboardData?.notifications ?? [];
  const unreadNotifications = notifications.filter((notification) => !notification.readAt).length;

  return (
    <section className="page-section container dashboard-page">
      <SectionHeader
        eyebrow={t.dashboard.eyebrow}
        title={t.dashboard.title}
        description={t.dashboard.description}
        actions={
          <ButtonLink to="/add-listing" variant="soft">
            <Plus size={16} aria-hidden="true" />
            {t.common.listProperty}
          </ButtonLink>
        }
      />

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
              <p className="eyebrow">{copy.ownerWorkspace}</p>
              <h2>{copy.heroTitle}</h2>
              <p>{copy.heroText}</p>
            </div>

            <div className="dashboard-hero-actions">
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
            </div>
          </div>

          <div className="dashboard-grid">
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
          </div>


          <div className="table-card table-card--premium dashboard-received-bookings-card">
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

            {receivedBookings.length > 0 ? (
              <div className="dashboard-received-bookings-list">
                {receivedBookings.map((booking) => (
                  <article className="dashboard-received-booking-item" key={booking.id}>
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
                    </div>

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
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>{copy.emptyReceivedBookings}</p>
              </div>
            )}
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
                      className={`dashboard-booking-item dashboard-booking-item--enhanced dashboard-booking-item--${getStatusClass(paymentStatus)}`}
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
                      </div>

                      <div className="dashboard-booking-payment">
                        <span className={`status-pill ${getStatusClass(paymentStatus)}`}>
                          <StatusIcon status={paymentStatus} />
                          {paymentLabel}
                        </span>

                        <strong>{formatPaymentAmount(booking, copy.paymentNotRequired)}</strong>

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
                    <span key={activity.id}>
                      <StatusIcon status={activity.status} />
                      {activity.title}
                    </span>
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


              <div className="dashboard-notifications-card">
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
        </>
      ) : null}
    </section>
  );
}