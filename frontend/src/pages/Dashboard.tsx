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
  Sparkles
} from 'lucide-react';

import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { activities, listings } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function Dashboard() {
  const { t, language } = useLanguage();

  useDocumentTitle('Dashboard');

  const featuredCount = listings.filter((listing) => listing.featured).length;
  const shortStayCount = listings.filter((listing) => listing.transaction === 'Short stay').length;
  const featuredActivityCount = activities.filter((activity) => activity.featured).length;

  const copy =
    language === 'ar'
      ? {
          ownerWorkspace: 'مساحة الملاك والشركاء',
          heroTitle: 'حافظ على جودة عقاراتك وأنشطتك وجاهزيتها للمراجعة.',
          heroText:
            'تابع جودة الإعلانات، الاستفسارات، حالة النشر، والفرص المرتبطة بالعقارات والأنشطة من لوحة واحدة.',
          viewListings: 'تصفح العقارات',
          listActivity: 'أضف نشاطاً',
          featured: 'مميز',
          pendingInquiriesSmall: 'استفساران يحتاجان رداً اليوم',
          profileQuality: 'جودة ملف المالك جيدة',
          shortStays: 'إقامات قصيرة',
          shortStaysSmall: 'جاهزة لاكتشاف الضيوف',
          activities: 'الأنشطة',
          activitiesSmall: `${featuredActivityCount} أنشطة مميزة`,
          portfolio: 'المحفظة',
          recentListings: 'أحدث العقارات',
          viewMarketplace: 'عرض السوق',
          status: 'الحالة',
          approved: 'مقبول',
          pending: 'قيد المراجعة',
          nextActions: 'أفضل الخطوات التالية',
          improveDiscovery: 'حسّن الظهور في البحث',
          improveText:
            'الإعلانات ذات الصور الواضحة، المواصفات الكاملة، والمعالم القريبة تظهر بشكل أفضل في البحث والفلاتر.',
          addImages: 'أضف صوراً عالية الجودة',
          completeSpecs: 'أكمل المواصفات المتقدمة',
          reviewPerformance: 'راجع أداء الاستفسارات'
        }
      : {
          ownerWorkspace: 'Owner and partner workspace',
          heroTitle: 'Keep listings and activities polished, visible, and ready for approval.',
          heroText:
            'Track listing quality, inquiries, publishing status, and marketplace opportunities from one clean dashboard view.',
          viewListings: 'View listings',
          listActivity: 'List an activity',
          featured: 'featured',
          pendingInquiriesSmall: '2 need a response today',
          profileQuality: 'Good owner profile quality',
          shortStays: 'Short stays',
          shortStaysSmall: 'Ready for guest discovery',
          activities: 'Activities',
          activitiesSmall: `${featuredActivityCount} featured activities`,
          portfolio: 'Portfolio',
          recentListings: 'Recent listings',
          viewMarketplace: 'View marketplace',
          status: 'Status',
          approved: 'Approved',
          pending: 'Pending',
          nextActions: 'Next best actions',
          improveDiscovery: 'Improve discovery',
          improveText:
            'Listings with clear photos, searchable amenities, nearby landmarks, and complete specs perform better in filtered searches.',
          addImages: 'Add premium images',
          completeSpecs: 'Complete advanced specs',
          reviewPerformance: 'Review inquiry performance'
        };

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
          <strong>{listings.length}</strong>
          <small>
            {featuredCount} {copy.featured}
          </small>
        </article>

        <article className="metric-card">
          <span>
            <MessageCircle size={18} aria-hidden="true" />
            {t.dashboard.pendingInquiries}
          </span>
          <strong>4</strong>
          <small>{copy.pendingInquiriesSmall}</small>
        </article>

        <article className="metric-card">
          <span>
            <ShieldCheck size={18} aria-hidden="true" />
            {t.dashboard.profileScore}
          </span>
          <strong>86%</strong>
          <small>{copy.profileQuality}</small>
        </article>

        <article className="metric-card">
          <span>
            <Sparkles size={18} aria-hidden="true" />
            {copy.shortStays}
          </span>
          <strong>{shortStayCount}</strong>
          <small>{copy.shortStaysSmall}</small>
        </article>

        <article className="metric-card">
          <span>
            <Sparkles size={18} aria-hidden="true" />
            {copy.activities}
          </span>
          <strong>{activities.length}</strong>
          <small>{copy.activitiesSmall}</small>
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
                {listings.slice(0, 6).map((listing) => {
                  const isApproved = listing.status !== 'PENDING';

                  return (
                    <tr key={listing.id}>
                      <td>
                        <strong>{listing.title}</strong>
                        <span>{listing.transaction}</span>
                      </td>

                      <td>{listing.location}</td>
                      <td>{listing.type}</td>
                      <td>{listing.price}</td>

                      <td>
                        <span className={`status-pill ${isApproved ? 'approved' : 'pending'}`}>
                          {isApproved ? (
                            <>
                              <CheckCircle2 size={14} aria-hidden="true" />
                              {copy.approved}
                            </>
                          ) : (
                            <>
                              <Clock3 size={14} aria-hidden="true" />
                              {copy.pending}
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="dashboard-side-card">
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
    </section>
  );
}