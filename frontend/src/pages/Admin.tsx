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
  createAdminDeveloper,
  createAdminTravelAgency,
  deleteAdminDeveloper,
  deleteAdminTravelAgency,
  getAdminActivities,
  getAdminDevelopers,
  getAdminInquiries,
  getAdminListings,
  getAdminTravelAgencies,
  updateAdminActivityStatus,
  updateAdminDeveloper,
  updateAdminListingStatus,
  updateAdminTravelAgency,
  type UpdateDeveloperPayload,
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
  ApiDeveloperCompany,
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

  useDocumentTitle('Admin');

  const [listings, setListings] = useState<ApiListing[]>([]);
  const [activities, setActivities] = useState<ApiActivity[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
const [travelAgencies, setTravelAgencies] = useState<ApiTravelAgency[]>([]);
const [developers, setDevelopers] = useState<ApiDeveloperCompany[]>([]);

const [agencyForm, setAgencyForm] = useState(initialAgencyForm);
const [developerForm, setDeveloperForm] = useState(initialDeveloperForm);

const [loading, setLoading] = useState(true);
const [loadError, setLoadError] = useState('');
const [updatingId, setUpdatingId] = useState('');

const [creatingAgency, setCreatingAgency] = useState(false);
const [agencyFormError, setAgencyFormError] = useState('');
const [agencyFormSuccess, setAgencyFormSuccess] = useState('');

const [creatingDeveloper, setCreatingDeveloper] = useState(false);
const [developerFormError, setDeveloperFormError] = useState('');
const [developerFormSuccess, setDeveloperFormSuccess] = useState('');
  

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

  async function loadAdminData() {
    if (!token) return;

    try {
      setLoading(true);
      setLoadError('');

      const [
  listingsResponse,
  activitiesResponse,
  inquiriesResponse,
  agenciesResponse,
  developersResponse
] = await Promise.all([
  getAdminListings(token),
  getAdminActivities(token),
  getAdminInquiries(token),
  getAdminTravelAgencies(token),
  getAdminDevelopers(token)
]);

setListings(listingsResponse.listings);
setActivities(activitiesResponse.activities);
setInquiries(inquiriesResponse.inquiries);
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
  }, [token, language]);

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
    verifiedDevelopers: developers.filter((developer) => developer.verified).length
  };
}, [activities, developers, listings, travelAgencies]);
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

  return (
  <section className="page-section container admin-page">
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
            <article className="metric-card">
  <span>
    <Building2 size={18} aria-hidden="true" />
    {copy.developers}
  </span>

  <strong>{metrics.verifiedDevelopers}</strong>
  <small>{copy.verifiedDevelopers}</small>
</article>
          </div>

          <div className="table-card table-card--premium">
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