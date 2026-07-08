import {
  BarChart3,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { ApiError } from "../api/client";
import {
  createPmsCommunicationTemplate,
  createPmsInspection,
  createPmsLease,
  createPmsPolicy,
  createPmsProperty,
  createPmsTenant,
  createPmsUnit,
  createPmsWorkOrder,
  getPmsLease,
  getPmsOverview,
  getPmsProperty,
  getPmsReportsSummary,
  listPmsCommunicationTemplates,
  listPmsInspections,
  listPmsLeaseRentDueItems,
  listPmsLeases,
  listPmsPolicies,
  listPmsProperties,
  listPmsPropertyUnits,
  listPmsRentDueItems,
  listPmsTenants,
  listPmsUnits,
  listPmsWorkOrders,
  updatePmsRentDueItem,
  updatePmsProperty,
  updatePmsUnit,
  updatePmsWorkOrder,
  type PmsCommunicationTemplate,
  type PmsCommunicationTemplatePayload,
  type PmsInspection,
  type PmsInspectionPayload,
  type PmsLease,
  type PmsLeasePayload,
  type PmsMaintenancePriority,
  type PmsMaintenanceStatus,
  type PmsPolicy,
  type PmsPolicyPayload,
  type PmsProperty,
  type PmsPropertyPayload,
  type PmsRentDueItem,
  type PmsReportsSummary,
  type PmsTenant,
  type PmsTenantPayload,
  type PmsUnit,
  type PmsUnitPayload,
  type PmsUnitStatus,
  type PmsWorkspaceOverview,
  type PmsWorkOrder,
  type PmsWorkOrderPayload,
} from "../api/pms";
import { useAuth } from "../auth/AuthContext";
import MapLocationPanel from "../components/MapLocationPanel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/format";
import { parseCoordinatesFromMapInput } from "../utils/mapLocation";

const pmsNavigation = [
  { to: "/pms/overview", key: "overview", icon: Home, available: true },
  {
    to: "/pms/properties",
    key: "properties",
    icon: Building2,
    available: true,
  },
  { to: "/pms/units", key: "units", icon: KeyRound, available: true },
  {
    to: "/pms/tenants",
    key: "tenants",
    icon: UserRoundCheck,
    available: true,
  },
  { to: "/pms/rentals", key: "rentals", icon: ClipboardList, available: true },
  {
    to: "/pms/maintenance",
    key: "maintenance",
    icon: Wrench,
    available: true,
  },
  {
    to: "/pms/accounting",
    key: "accounting",
    icon: CreditCard,
    available: true,
  },
  { to: "/pms/reports", key: "reports", icon: BarChart3, available: true },
  { to: "/pms/settings", key: "settings", icon: Settings, available: true },
] as const;

const unitStatuses: PmsUnitStatus[] = [
  "VACANT",
  "OCCUPIED",
  "RESERVED",
  "MAINTENANCE",
  "UNAVAILABLE",
];

const rentFrequencies: Array<NonNullable<PmsLeasePayload["rentFrequency"]>> = [
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
];

const maintenancePriorities: PmsMaintenancePriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

const maintenanceStatuses: PmsMaintenanceStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_VENDOR",
  "RESOLVED",
  "CANCELLED",
];

const emptyPropertyForm: PmsPropertyPayload = {
  name: "",
  code: "",
  propertyType: "",
  description: "",
  addressLine: "",
  city: "",
  area: "",
  notes: "",
  active: true,
  mapPlaceLabel: "",
  mapAddress: "",
  mapGoogleUrl: "",
  latitude: "",
  longitude: "",
  developerProjectId: "",
  publicListingId: "",
};

const emptyUnitForm: PmsUnitPayload = {
  unitNumber: "",
  unitName: "",
  floor: "",
  bedrooms: null,
  bathrooms: null,
  areaSqm: null,
  status: "VACANT",
  occupancyStatus: null,
  rentAmount: "",
  currency: "OMR",
  notes: "",
  developerProjectId: "",
  publicListingId: "",
};

const emptyTenantForm: PmsTenantPayload = {
  fullName: "",
  phone: "",
  email: "",
  nationality: "",
  nationalId: "",
  passportNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactEmail: "",
  notes: "",
  active: true,
};

const emptyLeaseForm: PmsLeasePayload = {
  tenantId: "",
  propertyId: "",
  unitId: "",
  title: "",
  status: "ACTIVE",
  startDate: "",
  endDate: "",
  rentFrequency: "MONTHLY",
  rentAmount: "",
  currency: "OMR",
  securityDeposit: "",
  dueDayOfMonth: null,
  contractDraftId: "",
  notes: "",
  generateRentDueItems: true,
};

const emptyWorkOrderForm: PmsWorkOrderPayload = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  title: "",
  description: "",
  priority: "MEDIUM",
  status: "OPEN",
  assignedToText: "",
  vendorText: "",
  cost: "",
  currency: "OMR",
  scheduledFor: "",
  notes: "",
};

const emptyTemplateForm: PmsCommunicationTemplatePayload = {
  name: "",
  channel: "EMAIL",
  type: "",
  subject: "",
  body: "",
  active: true,
  notes: "",
};

const emptyPolicyForm: PmsPolicyPayload = {
  title: "",
  category: "GENERAL",
  body: "",
  active: true,
  notes: "",
};

const emptyInspectionForm: PmsInspectionPayload = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  leaseId: "",
  title: "",
  status: "SCHEDULED",
  scheduledFor: "",
  notes: "",
  feedback: "",
  rating: null,
};

function formatNumber(value: number, language: "en" | "ar") {
  return new Intl.NumberFormat(language === "ar" ? "ar-OM" : "en-GB").format(
    value,
  );
}

function formatPercent(value: number, language: "en" | "ar") {
  return `${new Intl.NumberFormat(language === "ar" ? "ar-OM" : "en-GB", {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function getRoleLabel(role: string, language: "en" | "ar") {
  const labels: Record<string, { en: string; ar: string }> = {
    PMS_OWNER: { en: "Owner", ar: "مالك المساحة" },
    PMS_MANAGER: { en: "Manager", ar: "مدير" },
    PMS_ACCOUNTANT: { en: "Accountant", ar: "محاسب" },
    PMS_MAINTENANCE: { en: "Maintenance", ar: "صيانة" },
    PMS_AGENT: { en: "Agent", ar: "وسيط" },
    PMS_VIEWER: { en: "Viewer", ar: "مشاهد" },
  };

  return labels[role]?.[language] ?? role;
}

function getCompanyName(
  company: { nameEn: string; nameAr?: string | null },
  language: "en" | "ar",
) {
  return language === "ar"
    ? company.nameAr || company.nameEn
    : company.nameEn || company.nameAr || "";
}

function canEditInventory(role?: string) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER" || role === "PMS_AGENT";
}

function canEditTenancies(role?: string) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER" || role === "PMS_AGENT";
}

function canCollectRent(role?: string) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER" || role === "PMS_ACCOUNTANT";
}

function canEditMaintenance(role?: string) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_MAINTENANCE" ||
    role === "PMS_AGENT"
  );
}

function canEditOperations(role?: string) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER";
}

function getUnitStatusLabel(status: PmsUnitStatus, language: "en" | "ar") {
  const labels: Record<PmsUnitStatus, { en: string; ar: string }> = {
    VACANT: { en: "Vacant", ar: "شاغرة" },
    OCCUPIED: { en: "Occupied", ar: "مشغولة" },
    RESERVED: { en: "Reserved", ar: "محجوزة" },
    MAINTENANCE: { en: "Maintenance", ar: "صيانة" },
    UNAVAILABLE: { en: "Unavailable", ar: "غير متاحة" },
  };

  return labels[status][language];
}

function numberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function cleanPropertyPayload(
  form: PmsPropertyPayload,
  companyId: string,
): PmsPropertyPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    code: form.code || null,
    propertyType: form.propertyType || null,
    description: form.description || null,
    addressLine: form.addressLine || null,
    city: form.city || null,
    area: form.area || null,
    notes: form.notes || null,
    mapPlaceLabel: form.mapPlaceLabel || null,
    mapAddress: form.mapAddress || null,
    mapGoogleUrl: form.mapGoogleUrl || null,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    developerProjectId: form.developerProjectId || null,
    publicListingId: form.publicListingId || null,
    active: form.active ?? true,
  };
}

function cleanPropertyUpdatePayload(
  form: PmsPropertyPayload,
): Partial<PmsPropertyPayload> {
  return {
    name: form.name,
    code: form.code || null,
    propertyType: form.propertyType || null,
    description: form.description || null,
    addressLine: form.addressLine || null,
    city: form.city || null,
    area: form.area || null,
    notes: form.notes || null,
    mapPlaceLabel: form.mapPlaceLabel || null,
    mapAddress: form.mapAddress || null,
    mapGoogleUrl: form.mapGoogleUrl || null,
    latitude: form.latitude || null,
    longitude: form.longitude || null,
    developerProjectId: form.developerProjectId || null,
    publicListingId: form.publicListingId || null,
    active: form.active ?? true,
  };
}

function cleanUnitPayload(form: PmsUnitPayload): PmsUnitPayload {
  return {
    ...form,
    unitName: form.unitName || null,
    floor: form.floor || null,
    bedrooms: numberOrNull(form.bedrooms),
    bathrooms: numberOrNull(form.bathrooms),
    areaSqm: numberOrNull(form.areaSqm),
    rentAmount: numberOrNull(form.rentAmount),
    currency: form.currency || "OMR",
    notes: form.notes || null,
    developerProjectId: form.developerProjectId || null,
    publicListingId: form.publicListingId || null,
  };
}

function cleanUnitUpdatePayload(
  form: Partial<PmsUnitPayload>,
): Partial<PmsUnitPayload> {
  const payload: Partial<PmsUnitPayload> = {};

  if ("unitNumber" in form) payload.unitNumber = form.unitNumber;
  if ("unitName" in form) payload.unitName = form.unitName || null;
  if ("floor" in form) payload.floor = form.floor || null;
  if ("bedrooms" in form) payload.bedrooms = numberOrNull(form.bedrooms);
  if ("bathrooms" in form) payload.bathrooms = numberOrNull(form.bathrooms);
  if ("areaSqm" in form) payload.areaSqm = numberOrNull(form.areaSqm);
  if ("status" in form) payload.status = form.status;
  if ("occupancyStatus" in form) payload.occupancyStatus = form.occupancyStatus;
  if ("rentAmount" in form) payload.rentAmount = numberOrNull(form.rentAmount);
  if ("currency" in form) payload.currency = form.currency || "OMR";
  if ("notes" in form) payload.notes = form.notes || null;
  if ("developerProjectId" in form) {
    payload.developerProjectId = form.developerProjectId || null;
  }
  if ("publicListingId" in form) {
    payload.publicListingId = form.publicListingId || null;
  }

  return payload;
}

function cleanTenantPayload(
  form: PmsTenantPayload,
  companyId: string,
): PmsTenantPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    phone: form.phone || null,
    email: form.email || null,
    nationality: form.nationality || null,
    nationalId: form.nationalId || null,
    passportNumber: form.passportNumber || null,
    emergencyContactName: form.emergencyContactName || null,
    emergencyContactPhone: form.emergencyContactPhone || null,
    emergencyContactEmail: form.emergencyContactEmail || null,
    notes: form.notes || null,
    active: form.active ?? true,
  };
}

function cleanLeasePayload(
  form: PmsLeasePayload,
  companyId: string,
): PmsLeasePayload & { companyId: string } {
  return {
    ...form,
    companyId,
    title: form.title || null,
    endDate: form.endDate || null,
    rentAmount: numberOrNull(form.rentAmount) ?? 0,
    currency: form.currency || "OMR",
    securityDeposit: numberOrNull(form.securityDeposit),
    dueDayOfMonth: numberOrNull(form.dueDayOfMonth),
    contractDraftId: form.contractDraftId || null,
    notes: form.notes || null,
    generateRentDueItems: form.generateRentDueItems ?? true,
  };
}

function cleanWorkOrderPayload(
  form: PmsWorkOrderPayload,
  companyId: string,
): PmsWorkOrderPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    unitId: form.unitId || null,
    tenantId: form.tenantId || null,
    description: form.description || null,
    assignedToText: form.assignedToText || null,
    vendorText: form.vendorText || null,
    cost: numberOrNull(form.cost),
    currency: form.currency || "OMR",
    scheduledFor: form.scheduledFor || null,
    resolvedAt: form.resolvedAt || null,
    notes: form.notes || null,
  };
}

function cleanTemplatePayload(
  form: PmsCommunicationTemplatePayload,
  companyId: string,
): PmsCommunicationTemplatePayload & { companyId: string } {
  return {
    ...form,
    companyId,
    type: form.type || null,
    subject: form.subject || null,
    notes: form.notes || null,
    active: form.active ?? true,
  };
}

function cleanPolicyPayload(
  form: PmsPolicyPayload,
  companyId: string,
): PmsPolicyPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    notes: form.notes || null,
    active: form.active ?? true,
  };
}

function cleanInspectionPayload(
  form: PmsInspectionPayload,
  companyId: string,
): PmsInspectionPayload & { companyId: string } {
  return {
    ...form,
    companyId,
    unitId: form.unitId || null,
    tenantId: form.tenantId || null,
    leaseId: form.leaseId || null,
    scheduledFor: form.scheduledFor || null,
    completedAt: form.completedAt || null,
    notes: form.notes || null,
    feedback: form.feedback || null,
    rating: numberOrNull(form.rating),
  };
}

function formatDate(value?: string | null, language: "en" | "ar" = "en") {
  if (!value) return "—";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-OM" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function propertyToForm(property: PmsProperty): PmsPropertyPayload {
  return {
    name: property.name,
    code: property.code ?? "",
    propertyType: property.propertyType ?? "",
    description: property.description ?? "",
    addressLine: property.addressLine ?? "",
    city: property.city ?? "",
    area: property.area ?? "",
    notes: property.notes ?? "",
    active: property.active,
    mapPlaceLabel: property.mapPlaceLabel ?? "",
    mapAddress: property.mapAddress ?? "",
    mapGoogleUrl: property.mapGoogleUrl ?? "",
    latitude: property.latitude ?? "",
    longitude: property.longitude ?? "",
    developerProjectId: property.developerProjectId ?? "",
    publicListingId: property.publicListingId ?? "",
  };
}

function formatStatusText(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`pms-status-badge pms-status-badge--${status.toLowerCase()}`}
    >
      {label ?? formatStatusText(status)}
    </span>
  );
}

export default function PmsPortal() {
  const { language } = useLanguage();
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCompanyId = searchParams.get("companyId") ?? undefined;
  const selectedPropertyId = params.propertyId;
  const selectedLeaseId = params.leaseId;

  const [overview, setOverview] = useState<PmsWorkspaceOverview | null>(null);
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [units, setUnits] = useState<PmsUnit[]>([]);
  const [tenants, setTenants] = useState<PmsTenant[]>([]);
  const [leases, setLeases] = useState<PmsLease[]>([]);
  const [rentDueItems, setRentDueItems] = useState<PmsRentDueItem[]>([]);
  const [workOrders, setWorkOrders] = useState<PmsWorkOrder[]>([]);
  const [reportsSummary, setReportsSummary] = useState<PmsReportsSummary | null>(null);
  const [templates, setTemplates] = useState<PmsCommunicationTemplate[]>([]);
  const [policies, setPolicies] = useState<PmsPolicy[]>([]);
  const [inspections, setInspections] = useState<PmsInspection[]>([]);
  const [activeProperty, setActiveProperty] = useState<PmsProperty | null>(
    null,
  );
  const [activeLease, setActiveLease] = useState<PmsLease | null>(null);
  const [propertyForm, setPropertyForm] =
    useState<PmsPropertyPayload>(emptyPropertyForm);
  const [unitForm, setUnitForm] = useState<PmsUnitPayload>(emptyUnitForm);
  const [tenantForm, setTenantForm] =
    useState<PmsTenantPayload>(emptyTenantForm);
  const [leaseForm, setLeaseForm] = useState<PmsLeasePayload>(emptyLeaseForm);
  const [workOrderForm, setWorkOrderForm] =
    useState<PmsWorkOrderPayload>(emptyWorkOrderForm);
  const [templateForm, setTemplateForm] =
    useState<PmsCommunicationTemplatePayload>(emptyTemplateForm);
  const [policyForm, setPolicyForm] =
    useState<PmsPolicyPayload>(emptyPolicyForm);
  const [inspectionForm, setInspectionForm] =
    useState<PmsInspectionPayload>(emptyInspectionForm);
  const [unitDrafts, setUnitDrafts] = useState<
    Record<string, Partial<PmsUnitPayload>>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useDocumentTitle("lux PMS");

  const copy =
    language === "ar"
      ? {
          eyebrow: "lux PMS",
          portal: "بوابة إدارة العقارات",
          portalText:
            "مساحة B2B منفصلة لإدارة المحافظ والوحدات والإيجارات والعمليات المالية تدريجياً.",
          active: "مفعّل",
          trial: "تجريبي",
          suspended: "معلق",
          expired: "منتهي",
          company: "الشركة",
          role: "صلاحيتك",
          loading: "جاري تحميل بوابة PMS...",
          unavailable: "تعذر تحميل بيانات PMS.",
          saved: "تم الحفظ بنجاح.",
          overview: "نظرة عامة",
          properties: "العقارات",
          units: "الوحدات",
          tenants: "المستأجرون",
          rentals: "الإيجارات",
          maintenance: "الصيانة",
          accounting: "المحاسبة",
          reports: "التقارير",
          settings: "الإعدادات",
          soon: "قريباً",
          headline: "مركز إدارة محفظة العقارات",
          headlineText:
            "هذه بوابة PMS الخاصة. المخزون هنا خاص ولا يظهر في سوق lux.om إلا إذا تم ربطه أو نشره لاحقاً بشكل واضح.",
          totalPmsProperties: "عقارات PMS خاصة",
          totalPmsUnits: "إجمالي الوحدات",
          vacantPmsUnits: "وحدات شاغرة",
          occupiedPmsUnits: "وحدات مشغولة",
          maintenancePmsUnits: "وحدات صيانة",
          occupancyRate: "نسبة الإشغال",
          totalListings: "إعلانات عامة مرتبطة",
          approvedListings: "إعلانات منشورة",
          totalProjects: "مشاريع مرتبطة",
          readiness: "جاهزية المساحة",
          entitlementReady: "تم تفعيل صلاحية PMS للشركة.",
          accessScoped:
            "صلاحيتك مرتبطة بهذه الشركة فقط وليست صلاحية عامة على المنصة.",
          privateInventory: "مخزون PMS خاص ومنفصل عن السوق العام.",
          emptyProperties: "لا توجد عقارات PMS خاصة بعد.",
          emptyUnits: "لا توجد وحدات بعد.",
          emptyRentals: "لا توجد جداول إيجار نشطة بعد.",
          emptyAccounting: "لا توجد دفعات مستحقة أو متأخرة حالياً.",
          switchCompany: "تبديل الشركة",
          createProperty: "إضافة عقار PMS",
          editProperty: "تعديل العقار",
          createUnit: "إضافة وحدة",
          propertyName: "اسم العقار",
          code: "الكود الداخلي",
          type: "النوع",
          city: "المدينة",
          area: "المنطقة",
          address: "العنوان",
          description: "الوصف",
          notes: "ملاحظات خاصة",
          googleMap: "رابط Google Maps أو الإحداثيات",
          placeLabel: "اسم نقطة الخريطة",
          latitude: "خط العرض",
          longitude: "خط الطول",
          activeLabel: "نشط",
          save: "حفظ",
          unitNumber: "رقم الوحدة",
          unitName: "اسم الوحدة",
          floor: "الدور",
          bedrooms: "غرف",
          bathrooms: "حمامات",
          areaSqm: "المساحة م²",
          rent: "الإيجار",
          currency: "العملة",
          status: "الحالة",
          linkedPublicListing: "رابط إعلان عام اختياري",
          linkedProject: "رابط مشروع اختياري",
          privateNote: "لن يظهر هذا المخزون في السوق العام تلقائياً.",
          view: "عرض",
          update: "تحديث",
          cannotEdit: "صلاحيتك تسمح بالعرض فقط.",
          tenantName: "اسم المستأجر",
          phone: "الهاتف",
          email: "البريد الإلكتروني",
          nationality: "الجنسية",
          nationalId: "رقم الهوية",
          passportNumber: "رقم الجواز",
          emergencyContact: "جهة اتصال للطوارئ",
          createTenant: "إضافة مستأجر",
          createLease: "إضافة عقد إيجار",
          lease: "العقد",
          leaseTitle: "عنوان العقد",
          startDate: "تاريخ البداية",
          endDate: "تاريخ النهاية",
          frequency: "الدورية",
          deposit: "التأمين",
          dueDay: "يوم الاستحقاق",
          activeLeases: "عقود نشطة",
          expiringLeases: "عقود قاربت الانتهاء",
          unpaidRent: "دفعات غير مدفوعة",
          overdueRent: "دفعات متأخرة",
          paidRent: "دفعات مدفوعة",
          rentCollection: "تحصيل الإيجار",
          markPaid: "تسجيل مدفوع",
          confirmMarkPaid: "هل تريد تسجيل هذه الدفعة كمدفوعة؟",
          paidAmount: "المبلغ المدفوع",
          dueDate: "تاريخ الاستحقاق",
          amount: "المبلغ",
          partiallyPaid: "مدفوع جزئياً",
          emptyTenants: "لا يوجد مستأجرون بعد.",
          emptyLeases: "لا توجد عقود PMS بعد.",
          emptyRentDue: "لا توجد دفعات إيجار PMS بعد.",
          createWorkOrder: "إضافة طلب صيانة",
          workOrderTitle: "عنوان طلب الصيانة",
          priority: "الأولوية",
          assignedTo: "المسؤول",
          vendor: "المورّد",
          cost: "التكلفة",
          scheduledFor: "موعد مجدول",
          maintenanceRequests: "طلبات الصيانة",
          emptyMaintenance: "لا توجد طلبات صيانة بعد.",
          resolve: "إنهاء",
          confirmResolve: "هل تريد إنهاء طلب الصيانة هذا؟",
          createTemplate: "إضافة قالب تواصل",
          templateName: "اسم القالب",
          channel: "القناة",
          subject: "الموضوع",
          body: "النص",
          createPolicy: "إضافة سياسة",
          policyTitle: "عنوان السياسة",
          category: "التصنيف",
          createInspection: "إضافة فحص",
          inspectionTitle: "عنوان الفحص",
          feedback: "ملاحظات/تقييم",
          rating: "التقييم",
          accountingSummary: "ملخص المحاسبة",
          incomeCollected: "الدخل المحصل",
          outstandingRent: "إيجار مستحق",
          overdueAmount: "مبالغ متأخرة",
          expenses: "المصروفات",
          maintenanceCosts: "تكاليف الصيانة",
          lateFeeFoundation: "أساس رسوم التأخير",
          occupancyReport: "تقرير الإشغال",
          revenueReport: "تقرير الإيرادات",
          overdueTopList: "أعلى المتأخرات",
          leaseRenewals: "تجديدات العقود",
          inspections: "الفحوصات",
          communications: "التواصل",
          policies: "السياسات",
          emptyReports: "لا توجد بيانات تقارير كافية بعد.",
        }
      : {
          eyebrow: "lux PMS",
          portal: "Property Management System portal",
          portalText:
            "A separate private B2B workspace for portfolio, unit, rental, maintenance, and accounting operations.",
          active: "Active",
          trial: "Trial",
          suspended: "Suspended",
          expired: "Expired",
          company: "Company",
          role: "Your role",
          loading: "Loading PMS portal...",
          unavailable: "Could not load PMS data.",
          saved: "Saved successfully.",
          overview: "Overview",
          properties: "Properties",
          units: "Units",
          tenants: "Tenants",
          rentals: "Rentals",
          maintenance: "Maintenance",
          accounting: "Accounting",
          reports: "Reports",
          settings: "Settings",
          soon: "Soon",
          headline: "Private property inventory command center",
          headlineText:
            "This PMS inventory is private by default. It does not appear on lux.om marketplace unless you explicitly link or publish it later.",
          totalPmsProperties: "Private PMS properties",
          totalPmsUnits: "Total units",
          vacantPmsUnits: "Vacant units",
          occupiedPmsUnits: "Occupied units",
          maintenancePmsUnits: "Maintenance units",
          occupancyRate: "Occupancy rate",
          totalListings: "Linked public listings",
          approvedListings: "Published listings",
          totalProjects: "Linked projects",
          readiness: "Workspace readiness",
          entitlementReady: "PMS entitlement is enabled for this company.",
          accessScoped:
            "Your PMS access is scoped to this company, not global marketplace power.",
          privateInventory:
            "PMS inventory is private and separate from the public marketplace.",
          emptyProperties: "No private PMS properties yet.",
          emptyUnits: "No units yet.",
          emptyRentals: "No active rent schedules yet.",
          emptyAccounting: "No due or overdue rent payments right now.",
          switchCompany: "Switch company",
          createProperty: "Create PMS property",
          editProperty: "Edit property",
          createUnit: "Create unit",
          propertyName: "Property name",
          code: "Internal code",
          type: "Type",
          city: "City",
          area: "Area",
          address: "Address",
          description: "Description",
          notes: "Private notes",
          googleMap: "Google Maps URL or coordinates",
          placeLabel: "Map pin label",
          latitude: "Latitude",
          longitude: "Longitude",
          activeLabel: "Active",
          save: "Save",
          unitNumber: "Unit number",
          unitName: "Unit name",
          floor: "Floor",
          bedrooms: "Beds",
          bathrooms: "Baths",
          areaSqm: "Area sqm",
          rent: "Rent",
          currency: "Currency",
          status: "Status",
          linkedPublicListing: "Optional public listing link",
          linkedProject: "Optional project link",
          privateNote:
            "This inventory will not appear on the public marketplace automatically.",
          view: "View",
          update: "Update",
          cannotEdit: "Your PMS role is view-only for inventory changes.",
          tenantName: "Tenant name",
          phone: "Phone",
          email: "Email",
          nationality: "Nationality",
          nationalId: "National ID",
          passportNumber: "Passport number",
          emergencyContact: "Emergency contact",
          createTenant: "Create tenant",
          createLease: "Create lease",
          lease: "Lease",
          leaseTitle: "Lease title",
          startDate: "Start date",
          endDate: "End date",
          frequency: "Frequency",
          deposit: "Deposit",
          dueDay: "Due day",
          activeLeases: "Active leases",
          expiringLeases: "Expiring leases",
          unpaidRent: "Unpaid rent",
          overdueRent: "Overdue rent",
          paidRent: "Paid rent",
          rentCollection: "Rent collection",
          markPaid: "Mark paid",
          confirmMarkPaid: "Mark this rent due item as fully paid?",
          paidAmount: "Paid amount",
          dueDate: "Due date",
          amount: "Amount",
          partiallyPaid: "Partially paid",
          emptyTenants: "No PMS tenants yet.",
          emptyLeases: "No PMS leases yet.",
          emptyRentDue: "No PMS rent due items yet.",
          createWorkOrder: "Create work order",
          workOrderTitle: "Work order title",
          priority: "Priority",
          assignedTo: "Assigned to",
          vendor: "Vendor",
          cost: "Cost",
          scheduledFor: "Scheduled for",
          maintenanceRequests: "Maintenance requests",
          emptyMaintenance: "No maintenance requests yet.",
          resolve: "Resolve",
          confirmResolve: "Resolve this maintenance work order?",
          createTemplate: "Create communication template",
          templateName: "Template name",
          channel: "Channel",
          subject: "Subject",
          body: "Body",
          createPolicy: "Create policy",
          policyTitle: "Policy title",
          category: "Category",
          createInspection: "Create inspection",
          inspectionTitle: "Inspection title",
          feedback: "Feedback",
          rating: "Rating",
          accountingSummary: "Accounting summary",
          incomeCollected: "Income collected",
          outstandingRent: "Outstanding rent",
          overdueAmount: "Overdue amount",
          expenses: "Expenses",
          maintenanceCosts: "Maintenance costs",
          lateFeeFoundation: "Late fee foundation",
          occupancyReport: "Occupancy report",
          revenueReport: "Revenue report",
          overdueTopList: "Overdue top list",
          leaseRenewals: "Lease renewals",
          inspections: "Inspections",
          communications: "Communications",
          policies: "Policies",
          emptyReports: "Not enough PMS report data yet.",
        };

  const section = selectedLeaseId
    ? "leaseDetail"
    : selectedPropertyId
      ? "propertyDetail"
      : location.pathname.startsWith("/pms/units")
        ? "units"
        : location.pathname.startsWith("/pms/properties")
          ? "properties"
          : location.pathname.startsWith("/pms/tenants")
            ? "tenants"
            : location.pathname.startsWith("/pms/rentals")
              ? "rentals"
              : location.pathname.startsWith("/pms/maintenance")
                ? "maintenance"
                : location.pathname.startsWith("/pms/accounting")
                  ? "accounting"
                  : location.pathname.startsWith("/pms/reports")
                    ? "reports"
                    : location.pathname.startsWith("/pms/settings")
                      ? "settings"
                      : "overview";

  const canEdit = canEditInventory(overview?.workspace.member.role);
  const canEditTenantRecords = canEditTenancies(overview?.workspace.member.role);
  const canCollect = canCollectRent(overview?.workspace.member.role);
  const canManageMaintenance = canEditMaintenance(overview?.workspace.member.role);
  const canManageOperations = canEditOperations(overview?.workspace.member.role);

  async function loadPortal() {
    if (!token) return;

    try {
      setLoading(true);
      setError("");
      const overviewResponse = await getPmsOverview(token, selectedCompanyId);
      setOverview(overviewResponse);
      const companyId = overviewResponse.workspace.company.id;

      if (section === "properties") {
        const propertyResponse = await listPmsProperties(token, {
          companyId,
          take: 100,
        });
        setProperties(propertyResponse.properties);
        setActiveProperty(null);
        setActiveLease(null);
        setUnits([]);
        setTenants([]);
        setLeases([]);
        setRentDueItems([]);
      } else if (section === "propertyDetail" && selectedPropertyId) {
        const [propertyResponse, unitsResponse] = await Promise.all([
          getPmsProperty(token, selectedPropertyId),
          listPmsPropertyUnits(token, selectedPropertyId, { take: 200 }),
        ]);
        setActiveProperty(propertyResponse.property);
        setPropertyForm(propertyToForm(propertyResponse.property));
        setUnits(unitsResponse.units);
        setActiveLease(null);
      } else if (section === "units") {
        const unitsResponse = await listPmsUnits(token, {
          companyId,
          take: 200,
        });
        setUnits(unitsResponse.units);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "tenants") {
        const tenantsResponse = await listPmsTenants(token, {
          companyId,
          take: 100,
        });
        setTenants(tenantsResponse.tenants);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "rentals") {
        const [tenantsResponse, propertiesResponse, unitsResponse, leasesResponse] =
          await Promise.all([
            listPmsTenants(token, { companyId, take: 100 }),
            listPmsProperties(token, { companyId, take: 100 }),
            listPmsUnits(token, { companyId, take: 200 }),
            listPmsLeases(token, { companyId, take: 100 }),
          ]);
        setTenants(tenantsResponse.tenants);
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setLeases(leasesResponse.leases);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "leaseDetail" && selectedLeaseId) {
        const [leaseResponse, rentDueResponse] = await Promise.all([
          getPmsLease(token, selectedLeaseId),
          listPmsLeaseRentDueItems(token, selectedLeaseId, { take: 200 }),
        ]);
        setActiveLease(leaseResponse.lease);
        setRentDueItems(rentDueResponse.rentDueItems);
        setActiveProperty(null);
      } else if (section === "maintenance") {
        const [propertiesResponse, unitsResponse, tenantsResponse, workOrdersResponse] =
          await Promise.all([
            listPmsProperties(token, { companyId, take: 100 }),
            listPmsUnits(token, { companyId, take: 200 }),
            listPmsTenants(token, { companyId, take: 100 }),
            listPmsWorkOrders(token, { companyId, take: 100 }),
          ]);
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setTenants(tenantsResponse.tenants);
        setWorkOrders(workOrdersResponse.workOrders);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "accounting") {
        const [rentDueResponse, summaryResponse] = await Promise.all([
          listPmsRentDueItems(token, {
            companyId,
            take: 200,
          }),
          getPmsReportsSummary(token, companyId),
        ]);
        setRentDueItems(rentDueResponse.rentDueItems);
        setReportsSummary(summaryResponse);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "reports") {
        const summaryResponse = await getPmsReportsSummary(token, companyId);
        setReportsSummary(summaryResponse);
        setActiveProperty(null);
        setActiveLease(null);
      } else if (section === "settings") {
        const [propertiesResponse, unitsResponse, tenantsResponse, leasesResponse, templatesResponse, policiesResponse, inspectionsResponse] =
          await Promise.all([
            listPmsProperties(token, { companyId, take: 100 }),
            listPmsUnits(token, { companyId, take: 200 }),
            listPmsTenants(token, { companyId, take: 100 }),
            listPmsLeases(token, { companyId, take: 100 }),
            listPmsCommunicationTemplates(token, { companyId, take: 100 }),
            listPmsPolicies(token, { companyId, take: 100 }),
            listPmsInspections(token, { companyId, take: 100 }),
          ]);
        setProperties(propertiesResponse.properties);
        setUnits(unitsResponse.units);
        setTenants(tenantsResponse.tenants);
        setLeases(leasesResponse.leases);
        setTemplates(templatesResponse.templates);
        setPolicies(policiesResponse.policies);
        setInspections(inspectionsResponse.inspections);
        setActiveProperty(null);
        setActiveLease(null);
      } else {
        setProperties([]);
        setUnits([]);
        setTenants([]);
        setLeases([]);
        setRentDueItems([]);
        setWorkOrders([]);
        setReportsSummary(null);
        setTemplates([]);
        setPolicies([]);
        setInspections([]);
        setActiveProperty(null);
        setActiveLease(null);
      }
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError instanceof ApiError ? loadError.message : copy.unavailable,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPortal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copy.unavailable, selectedCompanyId, selectedLeaseId, selectedPropertyId, section, token]);

  const overviewMetrics = useMemo(() => {
    if (!overview) return [];

    return [
      {
        key: "totalPmsProperties",
        label: copy.totalPmsProperties,
        value: formatNumber(overview.metrics.totalPmsProperties, language),
      },
      {
        key: "totalPmsUnits",
        label: copy.totalPmsUnits,
        value: formatNumber(overview.metrics.totalPmsUnits, language),
      },
      {
        key: "vacantPmsUnits",
        label: copy.vacantPmsUnits,
        value: formatNumber(overview.metrics.vacantPmsUnits, language),
      },
      {
        key: "occupiedPmsUnits",
        label: copy.occupiedPmsUnits,
        value: formatNumber(overview.metrics.occupiedPmsUnits, language),
      },
      {
        key: "maintenancePmsUnits",
        label: copy.maintenancePmsUnits,
        value: formatNumber(overview.metrics.maintenancePmsUnits, language),
      },
      {
        key: "pmsOccupancyRate",
        label: copy.occupancyRate,
        value: formatPercent(overview.metrics.pmsOccupancyRate, language),
      },
      {
        key: "totalPmsTenants",
        label: copy.tenants,
        value: formatNumber(overview.metrics.totalPmsTenants, language),
      },
      {
        key: "activePmsLeases",
        label: copy.activeLeases,
        value: formatNumber(overview.metrics.activePmsLeases, language),
      },
      {
        key: "expiringPmsLeases",
        label: copy.expiringLeases,
        value: formatNumber(overview.metrics.expiringPmsLeases, language),
      },
      {
        key: "unpaidPmsRentDueItems",
        label: copy.unpaidRent,
        value: formatNumber(overview.metrics.unpaidPmsRentDueItems, language),
      },
      {
        key: "overduePmsRentDueItems",
        label: copy.overdueRent,
        value: formatNumber(overview.metrics.overduePmsRentDueItems, language),
      },
      {
        key: "paidPmsRentDueItems",
        label: copy.paidRent,
        value: formatNumber(overview.metrics.paidPmsRentDueItems, language),
      },
      {
        key: "openPmsWorkOrders",
        label: copy.maintenanceRequests,
        value: formatNumber(overview.metrics.openPmsWorkOrders, language),
      },
      {
        key: "urgentPmsWorkOrders",
        label: copy.priority,
        value: formatNumber(overview.metrics.urgentPmsWorkOrders, language),
      },
      {
        key: "scheduledPmsInspections",
        label: copy.inspections,
        value: formatNumber(overview.metrics.scheduledPmsInspections, language),
      },
      {
        key: "totalListings",
        label: copy.totalListings,
        value: formatNumber(overview.metrics.totalListings, language),
      },
      {
        key: "approvedListings",
        label: copy.approvedListings,
        value: formatNumber(overview.metrics.approvedListings, language),
      },
      {
        key: "totalProjects",
        label: copy.totalProjects,
        value: formatNumber(overview.metrics.totalProjects, language),
      },
    ];
  }, [copy, language, overview]);

  const statusLabel =
    overview?.workspace.entitlement.status === "ACTIVE"
      ? copy.active
      : overview?.workspace.entitlement.status === "TRIAL"
        ? copy.trial
        : overview?.workspace.entitlement.status === "SUSPENDED"
          ? copy.suspended
          : copy.expired;

  function handleMapInput(value: string) {
    const parsed = parseCoordinatesFromMapInput(value);
    setPropertyForm((current) => ({
      ...current,
      mapGoogleUrl: value,
      ...(parsed
        ? {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
          }
        : {}),
    }));
  }

  async function handleCreateProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await createPmsProperty(
        token,
        cleanPropertyPayload(propertyForm, overview.workspace.company.id),
      );
      setPropertyForm(emptyPropertyForm);
      setSuccess(copy.saved);
      navigate(
        `/pms/properties/${response.property.id}?companyId=${overview.workspace.company.id}`,
      );
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeProperty) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await updatePmsProperty(
        token,
        activeProperty.id,
        cleanPropertyUpdatePayload(propertyForm),
      );
      setActiveProperty(response.property);
      setPropertyForm(propertyToForm(response.property));
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !activeProperty) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsUnit(token, activeProperty.id, cleanUnitPayload(unitForm));
      setUnitForm(emptyUnitForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUnit(unit: PmsUnit) {
    if (!token) return;
    const draft = unitDrafts[unit.id];
    if (!draft) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsUnit(token, unit.id, cleanUnitUpdatePayload(draft));
      setSuccess(copy.saved);
      setUnitDrafts((current) => {
        const next = { ...current };
        delete next[unit.id];
        return next;
      });
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleCreateTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsTenant(
        token,
        cleanTenantPayload(tenantForm, overview.workspace.company.id),
      );
      setTenantForm(emptyTenantForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateLease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await createPmsLease(
        token,
        cleanLeasePayload(leaseForm, overview.workspace.company.id),
      );
      setLeaseForm(emptyLeaseForm);
      setSuccess(copy.saved);
      navigate(
        `/pms/rentals/${response.lease.id}?companyId=${overview.workspace.company.id}`,
      );
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkRentPaid(item: PmsRentDueItem) {
    if (!token) return;
    if (!window.confirm(copy.confirmMarkPaid)) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsRentDueItem(token, item.id, {
        paidAmount: item.amount,
      });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }


  async function handleCreateWorkOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsWorkOrder(
        token,
        cleanWorkOrderPayload(workOrderForm, overview.workspace.company.id),
      );
      setWorkOrderForm(emptyWorkOrderForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleResolveWorkOrder(workOrder: PmsWorkOrder) {
    if (!token) return;
    if (!window.confirm(copy.confirmResolve)) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await updatePmsWorkOrder(token, workOrder.id, { status: "RESOLVED" });
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsCommunicationTemplate(
        token,
        cleanTemplatePayload(templateForm, overview.workspace.company.id),
      );
      setTemplateForm(emptyTemplateForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsPolicy(
        token,
        cleanPolicyPayload(policyForm, overview.workspace.company.id),
      );
      setPolicyForm(emptyPolicyForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !overview) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await createPmsInspection(
        token,
        cleanInspectionPayload(inspectionForm, overview.workspace.company.id),
      );
      setInspectionForm(emptyInspectionForm);
      setSuccess(copy.saved);
      await loadPortal();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof ApiError ? saveError.message : copy.unavailable,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="pms-portal" aria-labelledby="pms-title">
      <aside className="pms-sidebar" aria-label={copy.portal}>
        <NavLink className="pms-sidebar__brand" to="/pms/overview">
          <span>lux</span>
          <strong>PMS</strong>
        </NavLink>

        <nav className="pms-sidebar__nav">
          {pmsNavigation.map((item) => {
            const Icon = item.icon;
            const label = copy[item.key];

            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "pms-sidebar__link",
                    isActive && item.available && "pms-sidebar__link--active",
                    !item.available && "pms-sidebar__link--disabled",
                  )
                }
                onClick={(event) => {
                  if (!item.available) event.preventDefault();
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {!item.available ? <small>{copy.soon}</small> : null}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="pms-main">
        <header className="pms-header">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 id="pms-title">{copy.portal}</h1>
            <p>{copy.portalText}</p>
          </div>

          {overview ? (
            <div className="pms-company-card">
              <span>{copy.company}</span>
              <strong>
                {getCompanyName(overview.workspace.company, language)}
              </strong>
              <small>
                {copy.role}:{" "}
                {getRoleLabel(overview.workspace.member.role, language)}
              </small>
              <em>{statusLabel}</em>
            </div>
          ) : null}
        </header>

        {overview && overview.companies.length > 1 ? (
          <label className="pms-company-switcher">
            {copy.switchCompany}
            <select
              value={overview.workspace.company.id}
              onChange={(event) => {
                setSearchParams({ companyId: event.target.value });
              }}
            >
              {overview.companies.map((workspace) => (
                <option key={workspace.company.id} value={workspace.company.id}>
                  {getCompanyName(workspace.company, language)} ·{" "}
                  {getRoleLabel(workspace.role, language)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {loading ? (
          <div className="pms-loading" role="status">
            <Loader2 size={22} aria-hidden="true" />
            {copy.loading}
          </div>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {success ? <p className="form-success">{success}</p> : null}

        {overview ? (
          <div className="pms-content-grid">
            {section === "overview" ? (
              <>
                <section className="pms-hero-card">
                  <div>
                    <p className="eyebrow">{copy.overview}</p>
                    <h2>{copy.headline}</h2>
                    <p>{copy.headlineText}</p>
                  </div>

                  <div
                    className="pms-readiness-list"
                    aria-label={copy.readiness}
                  >
                    <div>
                      <ShieldCheck size={18} aria-hidden="true" />
                      <span>{copy.entitlementReady}</span>
                    </div>
                    <div>
                      <UserRoundCheck size={18} aria-hidden="true" />
                      <span>{copy.accessScoped}</span>
                    </div>
                    <div>
                      <Building2 size={18} aria-hidden="true" />
                      <span>{copy.privateInventory}</span>
                    </div>
                  </div>
                </section>

                <section className="pms-metric-grid" aria-label={copy.overview}>
                  {overviewMetrics.map((metric) => (
                    <article key={metric.key} className="pms-metric-card">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </article>
                  ))}
                </section>

                <section className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.readiness}</p>
                    <h2>{copy.overview}</h2>
                  </div>

                  <div className="pms-empty-state-list">
                    {overview.emptyStates.properties ? (
                      <Link
                        to={`/pms/properties?companyId=${overview.workspace.company.id}`}
                      >
                        <Building2 size={18} aria-hidden="true" />
                        <span>{copy.emptyProperties}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                    ) : null}

                    {overview.emptyStates.rentals ? (
                      <div>
                        <FileText size={18} aria-hidden="true" />
                        <span>{copy.emptyRentals}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </div>
                    ) : null}

                    {overview.emptyStates.accounting ? (
                      <div>
                        <CreditCard size={18} aria-hidden="true" />
                        <span>{copy.emptyAccounting}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </div>
                    ) : null}
                  </div>
                </section>
              </>
            ) : null}

            {section === "properties" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.privateInventory}</p>
                    <h2>{copy.properties}</h2>
                  </div>

                  {properties.length === 0 ? (
                    <p>{copy.emptyProperties}</p>
                  ) : null}

                  <div className="pms-inventory-list">
                    {properties.map((property) => (
                      <article key={property.id} className="pms-inventory-card">
                        <div>
                          <strong>{property.name}</strong>
                          <span>
                            {[
                              property.code,
                              property.propertyType,
                              property.city,
                              property.area,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <small>
                          {formatNumber(property.counts.units, language)}{" "}
                          {copy.units}
                        </small>
                        <Link
                          className="button-link button-link--secondary"
                          to={`/pms/properties/${property.id}?companyId=${property.companyId}`}
                        >
                          {copy.view}
                        </Link>
                      </article>
                    ))}
                  </div>
                </div>

                <form className="pms-form-card" onSubmit={handleCreateProperty}>
                  <div>
                    <p className="eyebrow">{copy.privateNote}</p>
                    <h2>{copy.createProperty}</h2>
                  </div>
                  {!canEdit ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <PropertyFields
                    copy={copy}
                    form={propertyForm}
                    setForm={setPropertyForm}
                    onMapInput={handleMapInput}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEdit || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createProperty}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "propertyDetail" && activeProperty ? (
              <section className="pms-panel-grid">
                <form className="pms-form-card" onSubmit={handleUpdateProperty}>
                  <div>
                    <p className="eyebrow">{copy.privateInventory}</p>
                    <h2>{copy.editProperty}</h2>
                  </div>
                  {!canEdit ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <PropertyFields
                    copy={copy}
                    form={propertyForm}
                    setForm={setPropertyForm}
                    onMapInput={handleMapInput}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEdit || saving}
                  >
                    <Save size={16} aria-hidden="true" />
                    {copy.save}
                  </button>
                </form>

                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">
                      {activeProperty.code || copy.properties}
                    </p>
                    <h2>{activeProperty.name}</h2>
                  </div>

                  <MapLocationPanel
                    title={activeProperty.name}
                    location={
                      activeProperty.city || activeProperty.area || "Oman"
                    }
                    placeLabel={activeProperty.mapPlaceLabel}
                    address={
                      activeProperty.mapAddress || activeProperty.addressLine
                    }
                    googleMapsUrl={activeProperty.mapGoogleUrl}
                    latitude={activeProperty.latitude}
                    longitude={activeProperty.longitude}
                  />
                </div>

                <form className="pms-form-card" onSubmit={handleCreateUnit}>
                  <div>
                    <p className="eyebrow">{copy.privateNote}</p>
                    <h2>{copy.createUnit}</h2>
                  </div>
                  {!canEdit ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <UnitFields
                    copy={copy}
                    form={unitForm}
                    setForm={setUnitForm}
                    language={language}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEdit || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createUnit}
                  </button>
                </form>

                <UnitTable
                  copy={copy}
                  units={units}
                  language={language}
                  canEdit={canEdit}
                  saving={saving}
                  unitDrafts={unitDrafts}
                  setUnitDrafts={setUnitDrafts}
                  onUpdateUnit={handleUpdateUnit}
                />
              </section>
            ) : null}

            {section === "units" ? (
              <UnitTable
                copy={copy}
                units={units}
                language={language}
                canEdit={canEdit}
                saving={saving}
                unitDrafts={unitDrafts}
                setUnitDrafts={setUnitDrafts}
                onUpdateUnit={handleUpdateUnit}
              />
            ) : null}

            {section === "tenants" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.tenants}</p>
                    <h2>{copy.tenants}</h2>
                  </div>
                  {tenants.length === 0 ? <p>{copy.emptyTenants}</p> : null}
                  <div className="pms-inventory-list">
                    {tenants.map((tenant) => (
                      <article key={tenant.id} className="pms-inventory-card">
                        <div>
                          <strong>{tenant.fullName}</strong>
                          <span>
                            {[tenant.phone, tenant.email, tenant.nationality]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                        <small>
                          {formatNumber(tenant.counts.leases, language)} {copy.rentals}
                        </small>
                      </article>
                    ))}
                  </div>
                </div>

                <form className="pms-form-card" onSubmit={handleCreateTenant}>
                  <div>
                    <p className="eyebrow">{copy.privateNote}</p>
                    <h2>{copy.createTenant}</h2>
                  </div>
                  {!canEditTenantRecords ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <TenantFields
                    copy={copy}
                    form={tenantForm}
                    setForm={setTenantForm}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEditTenantRecords || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createTenant}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "rentals" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <LeaseTable
                  copy={copy}
                  leases={leases}
                  language={language}
                />

                <form className="pms-form-card" onSubmit={handleCreateLease}>
                  <div>
                    <p className="eyebrow">{copy.rentals}</p>
                    <h2>{copy.createLease}</h2>
                  </div>
                  {!canEditTenantRecords ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <LeaseFields
                    copy={copy}
                    form={leaseForm}
                    setForm={setLeaseForm}
                    tenants={tenants}
                    properties={properties}
                    units={units}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canEditTenantRecords || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createLease}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "leaseDetail" && activeLease ? (
              <section className="pms-panel-grid">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.lease}</p>
                    <h2>{activeLease.title || activeLease.unit.unitNumber}</h2>
                  </div>
                  <div className="pms-detail-list">
                    <span>{copy.tenantName}: <strong>{activeLease.tenant.fullName}</strong></span>
                    <span>{copy.propertyName}: <strong>{activeLease.property.name}</strong></span>
                    <span>{copy.unitNumber}: <strong>{activeLease.unit.unitNumber}</strong></span>
                    <span>{copy.startDate}: <strong>{formatDate(activeLease.startDate, language)}</strong></span>
                    <span>{copy.endDate}: <strong>{formatDate(activeLease.endDate, language)}</strong></span>
                    <span>{copy.rent}: <strong>{activeLease.rentAmount} {activeLease.currency}</strong></span>
                    <span>{copy.status}: <strong>{activeLease.status}</strong></span>
                  </div>
                </div>
                <RentDueTable
                  copy={copy}
                  items={rentDueItems}
                  language={language}
                  canCollect={canCollect}
                  saving={saving}
                  onMarkPaid={handleMarkRentPaid}
                />
              </section>
            ) : null}

            {section === "maintenance" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <MaintenanceTable
                  copy={copy}
                  workOrders={workOrders}
                  language={language}
                  canManage={canManageMaintenance}
                  saving={saving}
                  onResolve={handleResolveWorkOrder}
                />

                <form className="pms-form-card" onSubmit={handleCreateWorkOrder}>
                  <div>
                    <p className="eyebrow">{copy.maintenance}</p>
                    <h2>{copy.createWorkOrder}</h2>
                  </div>
                  {!canManageMaintenance ? (
                    <p className="form-error">{copy.cannotEdit}</p>
                  ) : null}
                  <WorkOrderFields
                    copy={copy}
                    form={workOrderForm}
                    setForm={setWorkOrderForm}
                    properties={properties}
                    units={units}
                    tenants={tenants}
                  />
                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={!canManageMaintenance || saving}
                  >
                    <Plus size={16} aria-hidden="true" />
                    {copy.createWorkOrder}
                  </button>
                </form>
              </section>
            ) : null}

            {section === "accounting" ? (
              <section className="pms-panel-grid">
                <ReportsSummaryPanel
                  copy={copy}
                  summary={reportsSummary}
                  language={language}
                />
                <RentDueTable
                  copy={copy}
                  items={rentDueItems}
                  language={language}
                  canCollect={canCollect}
                  saving={saving}
                  onMarkPaid={handleMarkRentPaid}
                />
              </section>
            ) : null}

            {section === "reports" ? (
              <ReportsSummaryPanel
                copy={copy}
                summary={reportsSummary}
                language={language}
              />
            ) : null}

            {section === "settings" ? (
              <section className="pms-panel-grid pms-panel-grid--inventory">
                <div className="pms-next-actions">
                  <div className="pms-next-actions__header">
                    <p className="eyebrow">{copy.communications}</p>
                    <h2>{copy.settings}</h2>
                  </div>
                  <div className="pms-inventory-list">
                    {templates.map((template) => (
                      <article key={template.id} className="pms-inventory-card">
                        <div>
                          <strong>{template.name}</strong>
                          <span>{template.channel} · {template.type || copy.communications}</span>
                        </div>
                      </article>
                    ))}
                    {policies.map((policy) => (
                      <article key={policy.id} className="pms-inventory-card">
                        <div>
                          <strong>{policy.title}</strong>
                          <span>{policy.category}</span>
                        </div>
                      </article>
                    ))}
                    {inspections.map((inspection) => (
                      <article key={inspection.id} className="pms-inventory-card">
                        <div>
                          <strong>{inspection.title}</strong>
                          <span>{inspection.status} · {inspection.property.name}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <form className="pms-form-card" onSubmit={handleCreateTemplate}>
                  <div>
                    <p className="eyebrow">{copy.communications}</p>
                    <h2>{copy.createTemplate}</h2>
                  </div>
                  {!canManageOperations ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <TemplateFields copy={copy} form={templateForm} setForm={setTemplateForm} />
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageOperations || saving}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createTemplate}
                  </button>
                </form>

                <form className="pms-form-card" onSubmit={handleCreatePolicy}>
                  <div>
                    <p className="eyebrow">{copy.policies}</p>
                    <h2>{copy.createPolicy}</h2>
                  </div>
                  {!canManageOperations ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <PolicyFields copy={copy} form={policyForm} setForm={setPolicyForm} />
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageOperations || saving}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createPolicy}
                  </button>
                </form>

                <form className="pms-form-card" onSubmit={handleCreateInspection}>
                  <div>
                    <p className="eyebrow">{copy.inspections}</p>
                    <h2>{copy.createInspection}</h2>
                  </div>
                  {!canManageMaintenance ? <p className="form-error">{copy.cannotEdit}</p> : null}
                  <InspectionFields
                    copy={copy}
                    form={inspectionForm}
                    setForm={setInspectionForm}
                    properties={properties}
                    units={units}
                    tenants={tenants}
                    leases={leases}
                  />
                  <button className="button-link button-link--primary" type="submit" disabled={!canManageMaintenance || saving}>
                    <Plus size={16} aria-hidden="true" />
                    {copy.createInspection}
                  </button>
                </form>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type PmsCopy = Record<string, string>;

function PropertyFields({
  copy,
  form,
  setForm,
  onMapInput,
}: {
  copy: PmsCopy;
  form: PmsPropertyPayload;
  setForm: (
    updater: (current: PmsPropertyPayload) => PmsPropertyPayload,
  ) => void;
  onMapInput: (value: string) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.propertyName}
        <input
          required
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.code}
        <input
          value={form.code ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, code: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.type}
        <input
          value={form.propertyType ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              propertyType: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.city}
        <input
          value={form.city ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, city: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.area}
        <input
          value={form.area ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, area: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.address}
        <input
          value={form.addressLine ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              addressLine: event.target.value,
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.description}
        <textarea
          value={form.description ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.googleMap}
        <input
          value={form.mapGoogleUrl ?? ""}
          onChange={(event) => onMapInput(event.target.value)}
        />
      </label>
      <label>
        {copy.placeLabel}
        <input
          value={form.mapPlaceLabel ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              mapPlaceLabel: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.latitude}
        <input
          value={form.latitude ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, latitude: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.longitude}
        <input
          value={form.longitude ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              longitude: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.linkedProject}
        <input
          value={form.developerProjectId ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              developerProjectId: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.linkedPublicListing}
        <input
          value={form.publicListingId ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              publicListingId: event.target.value,
            }))
          }
        />
      </label>
      <label className="pms-checkbox-field">
        <input
          type="checkbox"
          checked={Boolean(form.active)}
          onChange={(event) =>
            setForm((current) => ({ ...current, active: event.target.checked }))
          }
        />
        {copy.activeLabel}
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function UnitFields({
  copy,
  form,
  setForm,
  language,
}: {
  copy: PmsCopy;
  form: PmsUnitPayload;
  setForm: (updater: (current: PmsUnitPayload) => PmsUnitPayload) => void;
  language: "en" | "ar";
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.unitNumber}
        <input
          required
          value={form.unitNumber}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              unitNumber: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.unitName}
        <input
          value={form.unitName ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, unitName: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.floor}
        <input
          value={form.floor ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, floor: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.status}
        <select
          value={form.status ?? "VACANT"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              status: event.target.value as PmsUnitStatus,
              occupancyStatus: null,
            }))
          }
        >
          {unitStatuses.map((status) => (
            <option key={status} value={status}>
              {getUnitStatusLabel(status, language)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.bedrooms}
        <input
          type="number"
          min="0"
          value={form.bedrooms ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              bedrooms: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.bathrooms}
        <input
          type="number"
          min="0"
          value={form.bathrooms ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              bathrooms: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.areaSqm}
        <input
          type="number"
          min="0"
          value={form.areaSqm ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              areaSqm: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.rent}
        <input
          type="number"
          min="0"
          value={form.rentAmount ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              rentAmount: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.currency}
        <input
          maxLength={3}
          value={form.currency ?? "OMR"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              currency: event.target.value.toUpperCase(),
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function UnitTable({
  copy,
  units,
  language,
  canEdit,
  saving,
  unitDrafts,
  setUnitDrafts,
  onUpdateUnit,
}: {
  copy: PmsCopy;
  units: PmsUnit[];
  language: "en" | "ar";
  canEdit: boolean;
  saving: boolean;
  unitDrafts: Record<string, Partial<PmsUnitPayload>>;
  setUnitDrafts: (
    updater: (
      current: Record<string, Partial<PmsUnitPayload>>,
    ) => Record<string, Partial<PmsUnitPayload>>,
  ) => void;
  onUpdateUnit: (unit: PmsUnit) => Promise<void>;
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.privateInventory}</p>
        <h2>{copy.units}</h2>
      </div>

      {units.length === 0 ? <p>{copy.emptyUnits}</p> : null}

      {units.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.unitNumber}</th>
                <th>{copy.propertyName}</th>
                <th>{copy.status}</th>
                <th>{copy.bedrooms}</th>
                <th>{copy.areaSqm}</th>
                <th>{copy.rent}</th>
                <th>{copy.update}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => {
                const draft = unitDrafts[unit.id] ?? {};
                const draftStatus = (draft.status ??
                  unit.status) as PmsUnitStatus;
                return (
                  <tr key={unit.id}>
                    <td>
                      <strong>{unit.unitNumber}</strong>
                      {unit.unitName ? <small>{unit.unitName}</small> : null}
                    </td>
                    <td>{unit.property.name}</td>
                    <td>
                      {canEdit ? (
                        <select
                          value={draftStatus}
                          onChange={(event) =>
                            setUnitDrafts((current) => ({
                              ...current,
                              [unit.id]: {
                                ...current[unit.id],
                                status: event.target.value as PmsUnitStatus,
                              },
                            }))
                          }
                        >
                          {unitStatuses.map((status) => (
                            <option key={status} value={status}>
                              {getUnitStatusLabel(status, language)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge
                          status={unit.status}
                          label={getUnitStatusLabel(unit.status, language)}
                        />
                      )}
                    </td>
                    <td>{unit.bedrooms ?? "—"}</td>
                    <td>{unit.areaSqm ?? "—"}</td>
                    <td>
                      {unit.rentAmount
                        ? `${unit.rentAmount} ${unit.currency}`
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="button-link button-link--secondary"
                        type="button"
                        disabled={!canEdit || saving || !unitDrafts[unit.id]}
                        onClick={() => void onUpdateUnit(unit)}
                      >
                        {copy.update}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function TenantFields({
  copy,
  form,
  setForm,
}: {
  copy: PmsCopy;
  form: PmsTenantPayload;
  setForm: (updater: (current: PmsTenantPayload) => PmsTenantPayload) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.tenantName}
        <input
          required
          value={form.fullName}
          onChange={(event) =>
            setForm((current) => ({ ...current, fullName: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.phone}
        <input
          value={form.phone ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, phone: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.email}
        <input
          type="email"
          value={form.email ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, email: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.nationality}
        <input
          value={form.nationality ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              nationality: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.nationalId}
        <input
          value={form.nationalId ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, nationalId: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.passportNumber}
        <input
          value={form.passportNumber ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              passportNumber: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.emergencyContact}
        <input
          value={form.emergencyContactName ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              emergencyContactName: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.phone}
        <input
          value={form.emergencyContactPhone ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              emergencyContactPhone: event.target.value,
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function LeaseFields({
  copy,
  form,
  setForm,
  tenants,
  properties,
  units,
}: {
  copy: PmsCopy;
  form: PmsLeasePayload;
  setForm: (updater: (current: PmsLeasePayload) => PmsLeasePayload) => void;
  tenants: PmsTenant[];
  properties: PmsProperty[];
  units: PmsUnit[];
}) {
  const availableUnits = units.filter(
    (unit) => !form.propertyId || unit.propertyId === form.propertyId,
  );

  return (
    <div className="pms-form-grid">
      <label>
        {copy.tenantName}
        <select
          required
          value={form.tenantId}
          onChange={(event) =>
            setForm((current) => ({ ...current, tenantId: event.target.value }))
          }
        >
          <option value="">—</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.fullName}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.propertyName}
        <select
          required
          value={form.propertyId}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              propertyId: event.target.value,
              unitId: "",
            }))
          }
        >
          <option value="">—</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.unitNumber}
        <select
          required
          value={form.unitId}
          onChange={(event) =>
            setForm((current) => ({ ...current, unitId: event.target.value }))
          }
        >
          <option value="">—</option>
          {availableUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unitNumber} · {unit.status}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.leaseTitle}
        <input
          value={form.title ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.startDate}
        <input
          required
          type="date"
          value={form.startDate}
          onChange={(event) =>
            setForm((current) => ({ ...current, startDate: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.endDate}
        <input
          type="date"
          value={form.endDate ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, endDate: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.frequency}
        <select
          value={form.rentFrequency ?? "MONTHLY"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              rentFrequency: event.target.value as NonNullable<
                PmsLeasePayload["rentFrequency"]
              >,
            }))
          }
        >
          {rentFrequencies.map((frequency) => (
            <option key={frequency} value={frequency}>
              {frequency}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.rent}
        <input
          required
          type="number"
          min="0"
          value={form.rentAmount}
          onChange={(event) =>
            setForm((current) => ({ ...current, rentAmount: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.deposit}
        <input
          type="number"
          min="0"
          value={form.securityDeposit ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              securityDeposit: event.target.value,
            }))
          }
        />
      </label>
      <label>
        {copy.dueDay}
        <input
          type="number"
          min="1"
          max="31"
          value={form.dueDayOfMonth ?? ""}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              dueDayOfMonth: numberOrNull(event.target.value),
            }))
          }
        />
      </label>
      <label>
        {copy.currency}
        <input
          maxLength={3}
          value={form.currency ?? "OMR"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              currency: event.target.value.toUpperCase(),
            }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.notes}
        <textarea
          value={form.notes ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function LeaseTable({
  copy,
  leases,
  language,
}: {
  copy: PmsCopy;
  leases: PmsLease[];
  language: "en" | "ar";
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.rentals}</p>
        <h2>{copy.rentals}</h2>
      </div>
      {leases.length === 0 ? <p>{copy.emptyLeases}</p> : null}
      {leases.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.tenantName}</th>
                <th>{copy.propertyName}</th>
                <th>{copy.unitNumber}</th>
                <th>{copy.rent}</th>
                <th>{copy.endDate}</th>
                <th>{copy.status}</th>
                <th>{copy.view}</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((lease) => (
                <tr key={lease.id}>
                  <td>{lease.tenant.fullName}</td>
                  <td>{lease.property.name}</td>
                  <td>{lease.unit.unitNumber}</td>
                  <td>{lease.rentAmount} {lease.currency}</td>
                  <td>{formatDate(lease.endDate, language)}</td>
                  <td>{lease.status}</td>
                  <td>
                    <Link
                      className="button-link button-link--secondary"
                      to={`/pms/rentals/${lease.id}?companyId=${lease.companyId}`}
                    >
                      {copy.view}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}


function MaintenanceTable({
  copy,
  workOrders,
  language,
  canManage,
  saving,
  onResolve,
}: {
  copy: PmsCopy;
  workOrders: PmsWorkOrder[];
  language: "en" | "ar";
  canManage: boolean;
  saving: boolean;
  onResolve: (workOrder: PmsWorkOrder) => Promise<void>;
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.maintenance}</p>
        <h2>{copy.maintenanceRequests}</h2>
      </div>
      {workOrders.length === 0 ? <p>{copy.emptyMaintenance}</p> : null}
      {workOrders.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.workOrderTitle}</th>
                <th>{copy.propertyName}</th>
                <th>{copy.unitNumber}</th>
                <th>{copy.priority}</th>
                <th>{copy.status}</th>
                <th>{copy.cost}</th>
                <th>{copy.update}</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td>{workOrder.title}</td>
                  <td>{workOrder.property.name}</td>
                  <td>{workOrder.unit?.unitNumber ?? "—"}</td>
                  <td><StatusBadge status={workOrder.priority} /></td>
                  <td><StatusBadge status={workOrder.status} /></td>
                  <td>{workOrder.cost ? `${workOrder.cost} ${workOrder.currency}` : "—"}</td>
                  <td>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={!canManage || saving || workOrder.status === "RESOLVED"}
                      onClick={() => void onResolve(workOrder)}
                    >
                      {copy.resolve}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <small>{formatDate(new Date().toISOString(), language)}</small>
    </section>
  );
}

function WorkOrderFields({
  copy,
  form,
  setForm,
  properties,
  units,
  tenants,
}: {
  copy: PmsCopy;
  form: PmsWorkOrderPayload;
  setForm: (updater: (current: PmsWorkOrderPayload) => PmsWorkOrderPayload) => void;
  properties: PmsProperty[];
  units: PmsUnit[];
  tenants: PmsTenant[];
}) {
  const propertyUnits = form.propertyId
    ? units.filter((unit) => unit.propertyId === form.propertyId)
    : units;

  return (
    <div className="pms-form-grid">
      <label>
        {copy.propertyName}
        <select
          required
          value={form.propertyId}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              propertyId: event.target.value,
              unitId: "",
            }))
          }
        >
          <option value="">—</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.unitNumber}
        <select
          value={form.unitId ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, unitId: event.target.value }))
          }
        >
          <option value="">—</option>
          {propertyUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unitNumber}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.tenantName}
        <select
          value={form.tenantId ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, tenantId: event.target.value }))
          }
        >
          <option value="">—</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.fullName}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.workOrderTitle}
        <input
          required
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.priority}
        <select
          value={form.priority ?? "MEDIUM"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              priority: event.target.value as PmsMaintenancePriority,
            }))
          }
        >
          {maintenancePriorities.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.status}
        <select
          value={form.status ?? "OPEN"}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              status: event.target.value as PmsMaintenanceStatus,
            }))
          }
        >
          {maintenanceStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy.assignedTo}
        <input
          value={form.assignedToText ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, assignedToText: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.vendor}
        <input
          value={form.vendorText ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, vendorText: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.cost}
        <input
          type="number"
          min="0"
          value={form.cost ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, cost: event.target.value }))
          }
        />
      </label>
      <label>
        {copy.scheduledFor}
        <input
          type="date"
          value={form.scheduledFor ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, scheduledFor: event.target.value }))
          }
        />
      </label>
      <label className="pms-form-grid__wide">
        {copy.description}
        <textarea
          value={form.description ?? ""}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>
    </div>
  );
}

function ReportsSummaryPanel({
  copy,
  summary,
  language,
}: {
  copy: PmsCopy;
  summary: PmsReportsSummary | null;
  language: "en" | "ar";
}) {
  if (!summary) {
    return <p>{copy.emptyReports}</p>;
  }

  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.reports}</p>
        <h2>{copy.accountingSummary}</h2>
      </div>
      <div className="pms-metric-grid">
        <article className="pms-metric-card">
          <span>{copy.incomeCollected}</span>
          <strong>{summary.accounting.incomeCollected ?? "0"} OMR</strong>
        </article>
        <article className="pms-metric-card">
          <span>{copy.outstandingRent}</span>
          <strong>{summary.accounting.outstandingRent ?? "0"} OMR</strong>
        </article>
        <article className="pms-metric-card">
          <span>{copy.overdueAmount}</span>
          <strong>{summary.accounting.overdueRent ?? "0"} OMR</strong>
        </article>
        <article className="pms-metric-card">
          <span>{copy.maintenanceCosts}</span>
          <strong>{summary.accounting.maintenanceCosts ?? "0"} OMR</strong>
        </article>
        <article className="pms-metric-card">
          <span>{copy.occupancyReport}</span>
          <strong>{formatPercent(summary.reports.occupancy.occupancyRate, language)}</strong>
        </article>
        <article className="pms-metric-card">
          <span>{copy.inspections}</span>
          <strong>{formatNumber(summary.reports.inspections.needsAction, language)}</strong>
        </article>
      </div>
      <div className="pms-detail-list">
        <span>{copy.lateFeeFoundation}: <strong>{summary.accounting.lateFeeNote}</strong></span>
        <span>{copy.maintenanceRequests}: <strong>{formatNumber(summary.reports.maintenance.open + summary.reports.maintenance.inProgress, language)}</strong></span>
        <span>{copy.communications}: <strong>{formatNumber(summary.reports.communications.activeTemplates, language)}</strong></span>
        <span>{copy.policies}: <strong>{formatNumber(summary.reports.policies.activePolicies, language)}</strong></span>
      </div>
      {summary.reports.overdueTopList.length > 0 ? (
        <div className="pms-table-scroll">
          <h3>{copy.overdueTopList}</h3>
          <table className="pms-table">
            <tbody>
              {summary.reports.overdueTopList.map((item) => (
                <tr key={item.id}>
                  <td>{item.tenant.fullName}</td>
                  <td>{item.unit.unitNumber}</td>
                  <td>{formatDate(item.dueDate, language)}</td>
                  <td>{item.amount} {item.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {summary.reports.leaseRenewals.length > 0 ? (
        <div className="pms-table-scroll">
          <h3>{copy.leaseRenewals}</h3>
          <table className="pms-table">
            <tbody>
              {summary.reports.leaseRenewals.map((lease) => (
                <tr key={lease.id}>
                  <td>{lease.tenant.fullName}</td>
                  <td>{lease.unit.unitNumber}</td>
                  <td>{formatDate(lease.endDate, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function TemplateFields({
  copy,
  form,
  setForm,
}: {
  copy: PmsCopy;
  form: PmsCommunicationTemplatePayload;
  setForm: (updater: (current: PmsCommunicationTemplatePayload) => PmsCommunicationTemplatePayload) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.templateName}
        <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      </label>
      <label>
        {copy.channel}
        <select value={form.channel ?? "EMAIL"} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as PmsCommunicationTemplatePayload["channel"] }))}>
          {(["EMAIL", "WHATSAPP", "SMS", "INTERNAL"] as const).map((channel) => <option key={channel} value={channel}>{channel}</option>)}
        </select>
      </label>
      <label>
        {copy.type}
        <input value={form.type ?? ""} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} />
      </label>
      <label>
        {copy.subject}
        <input value={form.subject ?? ""} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
      </label>
      <label className="pms-form-grid__wide">
        {copy.body}
        <textarea required value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
      </label>
    </div>
  );
}

function PolicyFields({
  copy,
  form,
  setForm,
}: {
  copy: PmsCopy;
  form: PmsPolicyPayload;
  setForm: (updater: (current: PmsPolicyPayload) => PmsPolicyPayload) => void;
}) {
  return (
    <div className="pms-form-grid">
      <label>
        {copy.policyTitle}
        <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label>
        {copy.category}
        <select value={form.category ?? "GENERAL"} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as PmsPolicyPayload["category"] }))}>
          {(["GENERAL", "RENT", "MAINTENANCE", "PAYMENT", "MOVE_IN_OUT", "SAFETY"] as const).map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="pms-form-grid__wide">
        {copy.body}
        <textarea required value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
      </label>
    </div>
  );
}

function InspectionFields({
  copy,
  form,
  setForm,
  properties,
  units,
  tenants,
  leases,
}: {
  copy: PmsCopy;
  form: PmsInspectionPayload;
  setForm: (updater: (current: PmsInspectionPayload) => PmsInspectionPayload) => void;
  properties: PmsProperty[];
  units: PmsUnit[];
  tenants: PmsTenant[];
  leases: PmsLease[];
}) {
  const propertyUnits = form.propertyId ? units.filter((unit) => unit.propertyId === form.propertyId) : units;

  return (
    <div className="pms-form-grid">
      <label>
        {copy.propertyName}
        <select required value={form.propertyId} onChange={(event) => setForm((current) => ({ ...current, propertyId: event.target.value, unitId: "" }))}>
          <option value="">—</option>
          {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </label>
      <label>
        {copy.unitNumber}
        <select value={form.unitId ?? ""} onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}>
          <option value="">—</option>
          {propertyUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}
        </select>
      </label>
      <label>
        {copy.tenantName}
        <select value={form.tenantId ?? ""} onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))}>
          <option value="">—</option>
          {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName}</option>)}
        </select>
      </label>
      <label>
        {copy.lease}
        <select value={form.leaseId ?? ""} onChange={(event) => setForm((current) => ({ ...current, leaseId: event.target.value }))}>
          <option value="">—</option>
          {leases.map((lease) => <option key={lease.id} value={lease.id}>{lease.title || lease.unit.unitNumber}</option>)}
        </select>
      </label>
      <label>
        {copy.inspectionTitle}
        <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
      </label>
      <label>
        {copy.status}
        <select value={form.status ?? "SCHEDULED"} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as PmsInspectionPayload["status"] }))}>
          {(["SCHEDULED", "COMPLETED", "NEEDS_ACTION", "CANCELLED"] as const).map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </label>
      <label>
        {copy.scheduledFor}
        <input type="date" value={form.scheduledFor ?? ""} onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} />
      </label>
      <label>
        {copy.rating}
        <input type="number" min="1" max="5" value={form.rating ?? ""} onChange={(event) => setForm((current) => ({ ...current, rating: numberOrNull(event.target.value) }))} />
      </label>
      <label className="pms-form-grid__wide">
        {copy.feedback}
        <textarea value={form.feedback ?? ""} onChange={(event) => setForm((current) => ({ ...current, feedback: event.target.value }))} />
      </label>
    </div>
  );
}

function RentDueTable({
  copy,
  items,
  language,
  canCollect,
  saving,
  onMarkPaid,
}: {
  copy: PmsCopy;
  items: PmsRentDueItem[];
  language: "en" | "ar";
  canCollect: boolean;
  saving: boolean;
  onMarkPaid: (item: PmsRentDueItem) => Promise<void>;
}) {
  return (
    <section className="pms-next-actions pms-unit-table-card">
      <div className="pms-next-actions__header">
        <p className="eyebrow">{copy.accounting}</p>
        <h2>{copy.rentCollection}</h2>
      </div>
      {items.length === 0 ? <p>{copy.emptyRentDue}</p> : null}
      {items.length > 0 ? (
        <div className="pms-table-scroll">
          <table className="pms-table">
            <thead>
              <tr>
                <th>{copy.dueDate}</th>
                <th>{copy.tenantName}</th>
                <th>{copy.unitNumber}</th>
                <th>{copy.amount}</th>
                <th>{copy.paidAmount}</th>
                <th>{copy.status}</th>
                <th>{copy.update}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.dueDate, language)}</td>
                  <td>{item.tenant.fullName}</td>
                  <td>{item.unit.unitNumber}</td>
                  <td>{item.amount} {item.currency}</td>
                  <td>{item.paidAmount} {item.currency}</td>
                  <td><StatusBadge status={item.status} /></td>
                  <td>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={!canCollect || saving || item.status === "PAID"}
                      onClick={() => void onMarkPaid(item)}
                    >
                      {copy.markPaid}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
