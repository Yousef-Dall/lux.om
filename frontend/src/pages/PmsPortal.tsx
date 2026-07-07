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
  createPmsProperty,
  createPmsUnit,
  getPmsOverview,
  getPmsProperty,
  listPmsProperties,
  listPmsPropertyUnits,
  listPmsUnits,
  updatePmsProperty,
  updatePmsUnit,
  type PmsProperty,
  type PmsPropertyPayload,
  type PmsUnit,
  type PmsUnitPayload,
  type PmsUnitStatus,
  type PmsWorkspaceOverview,
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
    available: false,
  },
  { to: "/pms/rentals", key: "rentals", icon: ClipboardList, available: false },
  {
    to: "/pms/maintenance",
    key: "maintenance",
    icon: Wrench,
    available: false,
  },
  {
    to: "/pms/accounting",
    key: "accounting",
    icon: CreditCard,
    available: false,
  },
  { to: "/pms/reports", key: "reports", icon: BarChart3, available: false },
  { to: "/pms/settings", key: "settings", icon: Settings, available: false },
] as const;

const unitStatuses: PmsUnitStatus[] = [
  "VACANT",
  "OCCUPIED",
  "RESERVED",
  "MAINTENANCE",
  "UNAVAILABLE",
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

function StatusBadge({ status }: { status: PmsUnitStatus }) {
  return (
    <span
      className={`pms-status-badge pms-status-badge--${status.toLowerCase()}`}
    >
      {status}
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

  const [overview, setOverview] = useState<PmsWorkspaceOverview | null>(null);
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [units, setUnits] = useState<PmsUnit[]>([]);
  const [activeProperty, setActiveProperty] = useState<PmsProperty | null>(
    null,
  );
  const [propertyForm, setPropertyForm] =
    useState<PmsPropertyPayload>(emptyPropertyForm);
  const [unitForm, setUnitForm] = useState<PmsUnitPayload>(emptyUnitForm);
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
        };

  const section = selectedPropertyId
    ? "propertyDetail"
    : location.pathname.startsWith("/pms/units")
      ? "units"
      : location.pathname.startsWith("/pms/properties")
        ? "properties"
        : "overview";

  const canEdit = canEditInventory(overview?.workspace.member.role);

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
        setUnits([]);
      } else if (section === "propertyDetail" && selectedPropertyId) {
        const [propertyResponse, unitsResponse] = await Promise.all([
          getPmsProperty(token, selectedPropertyId),
          listPmsPropertyUnits(token, selectedPropertyId, { take: 200 }),
        ]);
        setActiveProperty(propertyResponse.property);
        setPropertyForm(propertyToForm(propertyResponse.property));
        setUnits(unitsResponse.units);
      } else if (section === "units") {
        const unitsResponse = await listPmsUnits(token, {
          companyId,
          take: 200,
        });
        setUnits(unitsResponse.units);
        setActiveProperty(null);
      } else {
        setProperties([]);
        setUnits([]);
        setActiveProperty(null);
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
  }, [copy.unavailable, selectedCompanyId, selectedPropertyId, section, token]);

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
                        <StatusBadge status={unit.status} />
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
