import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  Inbox,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  createAdminTravelAgency,
  deleteAdminTravelAgency,
  getAdminActivities,
  getAdminInquiries,
  getAdminListings,
  getAdminTravelAgencies,
  updateAdminActivityStatus,
  updateAdminListingStatus,
  updateAdminTravelAgency,
  type UpdateTravelAgencyPayload
} from '../api/admin';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type {
  ActivityStatus,
  ApiActivity,
  ApiListing,
  ApiTravelAgency,
  Inquiry,
  ListingStatus
} from '../types';

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

function getListingQualityScore(listing: ApiListing, index: number) {
  let score = 70;

  if (listing.images?.length || listing.image) score += 8;
  if (listing.amenities?.length) score += 6;
  if (listing.descriptionEn || listing.description) score += 6;
  if (listing.developer) score += 5;
  if (listing.nearestLandmark) score += 3;
  if (listing.featured) score += 5;

  return Math.min(98, Math.max(72, score - index));
}

function getActivityQualityScore(activity: ApiActivity, index: number) {
  let score = 72;

  if (activity.images?.length) score += 8;
  if (activity.highlights?.length) score += 6;
  if (activity.descriptionEn) score += 6;
  if (activity.travelAgency) score += 5;
  if (activity.nearestLandmark) score += 3;
  if (activity.featured) score += 5;

  return Math.min(98, Math.max(72, score - index));
}

function isApprovedStatus(status?: string) {
  return status === 'APPROVED';
}

function isPendingStatus(status?: string) {
  return status === 'PENDING' || !status;
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

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export default function Admin() {
  const { t, language } = useLanguage();
  const { token } = useAuth();

  useDocumentTitle('Admin');

  const [listings, setListings] = useState<ApiListing[]>([]);
  const [activities, setActivities] = useState<ApiActivity[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [travelAgencies, setTravelAgencies] = useState<ApiTravelAgency[]>([]);
  const [agencyForm, setAgencyForm] = useState(initialAgencyForm);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [creatingAgency, setCreatingAgency] = useState(false);

  const copy =
    language === 'ar'
      ? {
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
          createdAt: 'تاريخ الإرسال'
        }
      : {
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

  async function loadAdminData() {
    if (!token) return;

    try {
      setLoading(true);
      setLoadError('');

      const [listingsResponse, activitiesResponse, inquiriesResponse, agenciesResponse] =
  await Promise.all([
    getAdminListings(token),
    getAdminActivities(token),
    getAdminInquiries(token),
    getAdminTravelAgencies(token)
  ]);

      setListings(listingsResponse.listings);
      setActivities(activitiesResponse.activities);
      setInquiries(inquiriesResponse.inquiries);
      setTravelAgencies(agenciesResponse.travelAgencies);
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
  }, [token, language]);

  const metrics = useMemo(() => {
    const approvedListings = listings.filter((listing) => isApprovedStatus(listing.status)).length;
    const pendingListings = listings.filter((listing) => isPendingStatus(listing.status)).length;
    const pendingActivities = activities.filter((activity) => isPendingStatus(activity.status)).length;
    const featuredCount = listings.filter((listing) => listing.featured).length;
    const featuredActivityCount = activities.filter((activity) => activity.featured).length;

    return {
      approvedListings,
      pendingListings,
      pendingActivities,
      featuredCount,
      featuredActivityCount,
      needsAttention: pendingListings + pendingActivities,
      verifiedAgencies: travelAgencies.filter((agency) => agency.verified).length
    };
  }, [activities, listings, travelAgencies]);

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

  async function createTravelAgency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) return;

    try {
      setCreatingAgency(true);
      setLoadError('');

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
    } catch (error) {
      console.error(error);
      alert(error instanceof ApiError || error instanceof Error ? error.message : copy.error);
    } finally {
      setCreatingAgency(false);
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
          <div className="dashboard-grid">
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

            <form className="form-grid" onSubmit={createTravelAgency}>
              <label>
                {copy.agencyName}
                <input
                  required
                  value={agencyForm.nameEn}
                  onChange={(event) =>
                    setAgencyForm((current) => ({ ...current, nameEn: event.target.value }))
                  }
                  placeholder="Muscat Coast Tours"
                />
              </label>

              <label>
                {copy.agencyNameAr}
                <input
                  value={agencyForm.nameAr}
                  onChange={(event) =>
                    setAgencyForm((current) => ({ ...current, nameAr: event.target.value }))
                  }
                  placeholder="جولات ساحل مسقط"
                />
              </label>

              <label>
                {copy.headquarters}
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

              <label>
                {copy.logo}
                <input
                  type="url"
                  value={agencyForm.logo}
                  onChange={(event) =>
                    setAgencyForm((current) => ({ ...current, logo: event.target.value }))
                  }
                  placeholder="https://images.unsplash.com/..."
                />
              </label>

              <label>
                {copy.phone}
                <input
                  value={agencyForm.phone}
                  onChange={(event) =>
                    setAgencyForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="+968 9000 0000"
                />
              </label>

              <label>
                {copy.email}
                <input
                  type="email"
                  value={agencyForm.email}
                  onChange={(event) =>
                    setAgencyForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="agency@lux.om"
                />
              </label>

              <label>
                {copy.website}
                <input
                  type="url"
                  value={agencyForm.website}
                  onChange={(event) =>
                    setAgencyForm((current) => ({ ...current, website: event.target.value }))
                  }
                  placeholder="https://agency.om"
                />
              </label>

              <label>
                {copy.establishedYear}
                <input
                  type="number"
                  min="1800"
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

              <label>
                {copy.description}
                <textarea
                  rows={4}
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

              <label>
                {copy.descriptionAr}
                <textarea
                  rows={4}
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

              <div className="toggle-filter-grid">
                <button
                  type="button"
                  className={agencyForm.verified ? 'active' : ''}
                  onClick={() =>
                    setAgencyForm((current) => ({ ...current, verified: !current.verified }))
                  }
                >
                  {copy.verifiedAgency}
                </button>

                <button
                  type="button"
                  className={agencyForm.featured ? 'active' : ''}
                  onClick={() =>
                    setAgencyForm((current) => ({ ...current, featured: !current.featured }))
                  }
                >
                  {copy.featuredAgency}
                </button>
              </div>

              <button
                className="button-link button-link--primary"
                type="submit"
                disabled={creatingAgency}
              >
                {creatingAgency ? copy.creating : copy.create}
              </button>
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
                    const qualityScore = getListingQualityScore(listing, index);
                    const owner = listing.developer
                      ? language === 'ar'
                        ? listing.developer.nameAr || listing.developer.nameEn
                        : listing.developer.nameEn || listing.developer.nameAr
                      : listing.owner?.name || copy.privateOwner;

                    return (
                      <tr key={listing.id}>
                        <td>
                          <strong>{getListingTitle(listing, language)}</strong>
                          <span>{listing.transaction}</span>
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

                  {listings.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{copy.noListings}</td>
                    </tr>
                  ) : null}
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
                  {activities.map((activity, index) => {
                    const qualityScore = getActivityQualityScore(activity, index);

                    return (
                      <tr key={activity.id}>
                        <td>
                          <strong>{getActivityTitle(activity, language)}</strong>
                          <span>{activity.durationLabelEn || `${activity.durationMinutes ?? 0} min`}</span>
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

                  {activities.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{copy.noActivities}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-card table-card--premium">
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