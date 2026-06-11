import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Home,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  XCircle
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { getDashboardData, type DashboardData } from '../api/dashboard';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

function getStatusClass(status?: string) {
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'APPROVED') {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }

  if (status === 'REJECTED') {
    return <XCircle size={14} aria-hidden="true" />;
  }

  return <Clock3 size={14} aria-hidden="true" />;
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { token } = useAuth();

  useDocumentTitle('Dashboard');

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

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
          rejectedCount: 'مرفوض'
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
          rejectedCount: 'Rejected'
        };

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

  

const stats = dashboardData?.stats;
const listings = dashboardData?.listings ?? [];
const activities = dashboardData?.activities ?? [];

  return (
    <section className="page-section container">
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
                          <td>{listing.price}</td>

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