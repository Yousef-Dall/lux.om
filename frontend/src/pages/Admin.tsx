import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  ShieldCheck,
  Sparkles,
  XCircle
} from 'lucide-react';

import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { activities, listings } from '../data/mockData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

function getListingQualityScore(index: number, isFeatured?: boolean) {
  if (isFeatured) return 96;
  return Math.max(72, 88 - index * 3);
}

export default function Admin() {
  const { t, language } = useLanguage();

  useDocumentTitle('Admin');

  const approvedListings = listings.filter((listing) => listing.status !== 'PENDING');
  const pendingListings = listings.filter((listing) => listing.status === 'PENDING');
  const featuredCount = listings.filter((listing) => listing.featured).length;
  const featuredActivityCount = activities.filter((activity) => activity.featured).length;

  const copy =
    language === 'ar'
      ? {
          marketplaceControl: 'إدارة السوق',
          heroTitle: 'حافظ على جودة كل عقار ونشاط قبل النشر.',
          heroText:
            'راجع جودة الإعلانات، بيانات الملاك، المطورين، الأنشطة، وحالة النشر قبل ظهور أي محتوى للعامة.',
          qualityGate: 'بوابة الجودة مفعلة',
          publicReadyListings: 'عقارات جاهزة للنشر',
          waitingForReview: 'بانتظار المراجعة',
          featured: 'مميز',
          homepageHighlights: 'ظاهر في الصفحة الرئيسية',
          needsAttention: 'يحتاج انتباهاً',
          missingVerification: 'بيانات تحتاج مراجعة',
          reviewQueue: 'قائمة المراجعة',
          listingQueue: 'مراجعة العقارات',
          viewMarketplace: 'عرض السوق',
          quality: 'الجودة',
          action: 'الإجراء',
          approve: 'قبول',
          reject: 'رفض',
          approved: 'مقبول',
          pending: 'قيد المراجعة',
          privateOwner: 'مالك خاص',
          developerPartner: 'شريك تطوير',
          activitiesQueue: 'مراجعة الأنشطة',
          activitiesReady: 'أنشطة جاهزة للمراجعة',
          featuredActivities: 'أنشطة مميزة'
        }
      : {
          marketplaceControl: 'Marketplace control',
          heroTitle: 'Keep every public listing and activity polished, complete, and trustworthy.',
          heroText:
            'Review listing quality, owner details, developer context, activity information, visibility status, and approval readiness before anything goes live.',
          qualityGate: 'Quality gate active',
          publicReadyListings: 'Public-ready listings',
          waitingForReview: 'Waiting for review',
          featured: 'Featured',
          homepageHighlights: 'Highlighted on homepage',
          needsAttention: 'Needs attention',
          missingVerification: 'Missing verification details',
          reviewQueue: 'Review queue',
          listingQueue: 'Listing queue',
          viewMarketplace: 'View marketplace',
          quality: 'Quality',
          action: 'Action',
          approve: 'Approve',
          reject: 'Reject',
          approved: 'Approved',
          pending: 'Pending',
          privateOwner: 'Private owner',
          developerPartner: 'Developer partner',
          activitiesQueue: 'Activity queue',
          activitiesReady: 'Activities ready for review',
          featuredActivities: 'Featured activities'
        };

  return (
    <section className="page-section container">
      <SectionHeader
        eyebrow={t.admin.eyebrow}
        title={t.admin.title}
        description={t.admin.description}
      />

      <div className="admin-hero-card">
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

      <div className="dashboard-grid">
        <article className="metric-card metric-card--accent">
          <span>
            <CheckCircle2 size={18} aria-hidden="true" />
            {t.admin.approved}
          </span>
          <strong>{approvedListings.length}</strong>
          <small>{copy.publicReadyListings}</small>
        </article>

        <article className="metric-card">
          <span>
            <Clock3 size={18} aria-hidden="true" />
            {t.admin.pending}
          </span>
          <strong>{pendingListings.length}</strong>
          <small>{copy.waitingForReview}</small>
        </article>

        <article className="metric-card">
          <span>
            <Sparkles size={18} aria-hidden="true" />
            {copy.featured}
          </span>
          <strong>{featuredCount}</strong>
          <small>{copy.homepageHighlights}</small>
        </article>

        <article className="metric-card">
          <span>
            <Sparkles size={18} aria-hidden="true" />
            {copy.activitiesQueue}
          </span>
          <strong>{activities.length}</strong>
          <small>
            {featuredActivityCount} {copy.featuredActivities}
          </small>
        </article>

        <article className="metric-card">
          <span>
            <AlertCircle size={18} aria-hidden="true" />
            {copy.needsAttention}
          </span>
          <strong>1</strong>
          <small>{copy.missingVerification}</small>
        </article>
      </div>

      <div className="table-card table-card--premium">
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
              {listings.map((listing, index) => {
                const isApproved = listing.status !== 'PENDING';
                const qualityScore = getListingQualityScore(index, listing.featured);
                const owner = listing.developer ? listing.developer.name : copy.privateOwner;

                return (
                  <tr key={listing.id}>
                    <td>
                      <strong>{listing.title}</strong>
                      <span>{listing.transaction}</span>
                    </td>

                    <td>{listing.location}</td>
                    <td>{owner}</td>
                    <td>{listing.type}</td>

                    <td>
                      <span className="quality-score">
                        <span style={{ width: `${qualityScore}%` }} />
                        <strong>{qualityScore}%</strong>
                      </span>
                    </td>

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

                    <td>
                      <div className="admin-action-buttons">
                        <button type="button" className="icon-action icon-action--approve">
                          <CheckCircle2 size={16} aria-hidden="true" />
                          <span className="sr-only">{copy.approve}</span>
                        </button>

                        <button type="button" className="icon-action icon-action--reject">
                          <XCircle size={16} aria-hidden="true" />
                          <span className="sr-only">{copy.reject}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card table-card--premium">
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
              {activities.slice(0, 6).map((activity, index) => {
                const qualityScore = activity.featured ? 94 : Math.max(76, 88 - index * 2);

                return (
                  <tr key={activity.id}>
                    <td>
                      <strong>{activity.title}</strong>
                      <span>{activity.duration}</span>
                    </td>

                    <td>{activity.location}</td>
                    <td>{activity.provider ?? 'Activity provider'}</td>
                    <td>{activity.category}</td>

                    <td>
                      <span className="quality-score">
                        <span style={{ width: `${qualityScore}%` }} />
                        <strong>{qualityScore}%</strong>
                      </span>
                    </td>

                    <td>
                      <span className="status-pill approved">
                        <CheckCircle2 size={14} aria-hidden="true" />
                        {copy.approved}
                      </span>
                    </td>

                    <td>
                      <div className="admin-action-buttons">
                        <button type="button" className="icon-action icon-action--approve">
                          <CheckCircle2 size={16} aria-hidden="true" />
                          <span className="sr-only">{copy.approve}</span>
                        </button>

                        <button type="button" className="icon-action icon-action--reject">
                          <XCircle size={16} aria-hidden="true" />
                          <span className="sr-only">{copy.reject}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}