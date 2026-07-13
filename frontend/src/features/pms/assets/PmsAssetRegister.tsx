import { CalendarClock, ChevronLeft, ChevronRight, History, PackagePlus, Pencil, Search, Wrench } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  createPmsAsset,
  createPmsAssetEvent,
  listPmsAssets,
  updatePmsAsset,
  type PmsAsset,
  type PmsAssetEventType,
  type PmsAssetPagination,
  type PmsAssetPayload,
  type PmsAssetStatus,
} from '../../../api/pmsAdvanced';
import {
  listPmsProperties,
  listPmsUnits,
  listPmsVendors,
  type PmsProperty,
  type PmsUnit,
  type PmsVendor,
} from '../../../api/pms';
import { ApiError } from '../../../api/client';
import AccessibleDialog from '../../../components/AccessibleDialog';
import { PortalEmpty } from '../../portal/PortalState';

const PAGE_SIZE = 25;
const assetStatuses: PmsAssetStatus[] = ['ACTIVE', 'OUT_OF_SERVICE', 'RETIRED', 'DISPOSED'];
const maintenanceEventTypes: Array<Exclude<PmsAssetEventType, 'CREATED' | 'UPDATED' | 'RETIRED' | 'DISPOSED'>> = ['SERVICED', 'REPAIRED', 'WARRANTY_CLAIM'];
const inventoryEventTypes: Array<Exclude<PmsAssetEventType, 'CREATED' | 'UPDATED'>> = [...maintenanceEventTypes, 'RETIRED', 'DISPOSED'];
const sortOptions = ['nextServiceDate:asc', 'warrantyExpiry:asc', 'name:asc', 'assetCode:asc', 'updatedAt:desc'] as const;

type Language = 'en' | 'ar';
type SortValue = typeof sortOptions[number];

type Props = {
  token: string;
  companyId: string;
  language: Language;
  canManageRecords: boolean;
  canRecordMaintenance: boolean;
  onTotalChange?: (total: number) => void;
};

const copy = {
  en: {
    title: 'Asset register',
    description: 'Browse, register, place, service, and retire company assets without losing their operating history.',
    add: 'Register asset',
    search: 'Search asset code, name, serial, property, unit, or vendor',
    property: 'Property',
    allProperties: 'All properties',
    status: 'Status',
    allStatuses: 'All statuses',
    dueOnly: 'Warranty or service due',
    sort: 'Sort',
    apply: 'Apply filters',
    clear: 'Clear',
    loading: 'Loading asset register…',
    failed: 'The asset register could not be loaded.',
    noAssets: 'No assets match this view',
    noAssetsMessage: 'Adjust the filters or register the first building system, appliance, or equipment record.',
    code: 'Asset code',
    name: 'Name',
    category: 'Category',
    placement: 'Placement',
    vendor: 'Vendor',
    service: 'Next service',
    warranty: 'Warranty expiry',
    actions: 'Actions',
    view: 'View asset',
    edit: 'Edit asset',
    history: 'Record asset event',
    previous: 'Previous',
    next: 'Next',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
    createTitle: 'Register asset',
    editTitle: 'Edit asset',
    formDescription: 'Property placement, identity, warranty, purchase, and service details are stored in the asset audit trail.',
    close: 'Close dialog',
    unit: 'Unit',
    propertyWide: 'Property-wide asset',
    manufacturer: 'Manufacturer',
    model: 'Model',
    serial: 'Serial number',
    installation: 'Installation date',
    interval: 'Service interval in days',
    purchaseCost: 'Purchase cost',
    currency: 'Currency',
    notes: 'Notes',
    save: 'Save asset',
    saving: 'Saving…',
    detailsTitle: 'Asset details',
    detailsDescription: 'Identity, placement, lifecycle state, linked work, and recent service history.',
    linkedWork: 'Linked records',
    workOrders: 'work orders',
    maintenancePlans: 'preventive plans',
    documents: 'documents',
    recentHistory: 'Recent history',
    noHistory: 'No asset history is available.',
    eventTitle: 'Record asset event',
    eventDescription: 'Service, repair, warranty, retirement, and disposal events are append-only history records.',
    eventType: 'Event type',
    occurredAt: 'Occurred at',
    cost: 'Cost',
    nextServiceDate: 'Next service date',
    record: 'Record event',
    recording: 'Recording…',
    permission: 'You can inspect this register, but your role cannot change asset records.',
    maintenancePermission: 'You can record service, repair, and warranty history, but you cannot edit asset identity or retirement state.',
    required: 'Complete the required asset fields.',
    filtersLabel: 'Asset register filters',
    tableCaption: 'PMS asset register results',
  },
  ar: {
    title: 'سجل الأصول',
    description: 'استعرض أصول الشركة وسجّلها وحدد موقعها وصيانتها وإحالتها للتقاعد مع الحفاظ على سجلها التشغيلي.',
    add: 'تسجيل أصل',
    search: 'ابحث برمز الأصل أو الاسم أو الرقم التسلسلي أو العقار أو الوحدة أو المورد',
    property: 'العقار',
    allProperties: 'كل العقارات',
    status: 'الحالة',
    allStatuses: 'كل الحالات',
    dueOnly: 'ضمان أو صيانة مستحقة',
    sort: 'الترتيب',
    apply: 'تطبيق المرشحات',
    clear: 'مسح',
    loading: 'جارٍ تحميل سجل الأصول…',
    failed: 'تعذر تحميل سجل الأصول.',
    noAssets: 'لا توجد أصول مطابقة',
    noAssetsMessage: 'عدّل المرشحات أو سجّل أول نظام أو جهاز أو معدة في العقار.',
    code: 'رمز الأصل',
    name: 'الاسم',
    category: 'الفئة',
    placement: 'الموقع',
    vendor: 'المورد',
    service: 'الصيانة القادمة',
    warranty: 'انتهاء الضمان',
    actions: 'الإجراءات',
    view: 'عرض الأصل',
    edit: 'تعديل الأصل',
    history: 'تسجيل حدث للأصل',
    previous: 'السابق',
    next: 'التالي',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} من ${total}`,
    createTitle: 'تسجيل أصل',
    editTitle: 'تعديل الأصل',
    formDescription: 'يتم حفظ الموقع والهوية والضمان والشراء ومواعيد الصيانة ضمن سجل تدقيق الأصل.',
    close: 'إغلاق النافذة',
    unit: 'الوحدة',
    propertyWide: 'أصل على مستوى العقار',
    manufacturer: 'الشركة المصنعة',
    model: 'الطراز',
    serial: 'الرقم التسلسلي',
    installation: 'تاريخ التركيب',
    interval: 'فترة الصيانة بالأيام',
    purchaseCost: 'تكلفة الشراء',
    currency: 'العملة',
    notes: 'ملاحظات',
    save: 'حفظ الأصل',
    saving: 'جارٍ الحفظ…',
    detailsTitle: 'تفاصيل الأصل',
    detailsDescription: 'الهوية والموقع وحالة دورة الحياة والسجلات المرتبطة وسجل الصيانة الحديث.',
    linkedWork: 'السجلات المرتبطة',
    workOrders: 'أوامر عمل',
    maintenancePlans: 'خطط وقائية',
    documents: 'مستندات',
    recentHistory: 'السجل الحديث',
    noHistory: 'لا يوجد سجل لهذا الأصل.',
    eventTitle: 'تسجيل حدث للأصل',
    eventDescription: 'أحداث الصيانة والإصلاح والضمان والتقاعد والتخلص سجلات تاريخية تضاف دون استبدال السابق.',
    eventType: 'نوع الحدث',
    occurredAt: 'وقت الحدث',
    cost: 'التكلفة',
    nextServiceDate: 'تاريخ الصيانة القادمة',
    record: 'تسجيل الحدث',
    recording: 'جارٍ التسجيل…',
    permission: 'يمكنك استعراض السجل، لكن دورك لا يسمح بتغيير سجلات الأصول.',
    maintenancePermission: 'يمكنك تسجيل سجل الصيانة والإصلاح والضمان، لكن لا يمكنك تعديل هوية الأصل أو حالة التقاعد.',
    required: 'أكمل حقول الأصل المطلوبة.',
    filtersLabel: 'مرشحات سجل الأصول',
    tableCaption: 'نتائج سجل أصول PMS',
  },
};

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function enumLabel(value: string, language: Language) {
  const labels: Record<string, { en: string; ar: string }> = {
    ACTIVE: { en: 'Active', ar: 'نشط' },
    OUT_OF_SERVICE: { en: 'Out of service', ar: 'خارج الخدمة' },
    RETIRED: { en: 'Retired', ar: 'متقاعد' },
    DISPOSED: { en: 'Disposed', ar: 'تم التخلص منه' },
    CREATED: { en: 'Created', ar: 'تم الإنشاء' },
    UPDATED: { en: 'Updated', ar: 'تم التحديث' },
    SERVICED: { en: 'Serviced', ar: 'تمت الصيانة' },
    REPAIRED: { en: 'Repaired', ar: 'تم الإصلاح' },
    WARRANTY_CLAIM: { en: 'Warranty claim', ar: 'مطالبة ضمان' },
    nextServiceDate: { en: 'Next service', ar: 'الصيانة القادمة' },
    warrantyExpiry: { en: 'Warranty expiry', ar: 'انتهاء الضمان' },
    name: { en: 'Name', ar: 'الاسم' },
    assetCode: { en: 'Asset code', ar: 'رمز الأصل' },
    updatedAt: { en: 'Recently updated', ar: 'آخر تحديث' },
    asc: { en: 'Ascending', ar: 'تصاعدي' },
    desc: { en: 'Descending', ar: 'تنازلي' },
  };
  return labels[value]?.[language] ?? value.replaceAll('_', ' ');
}

function formatDate(value: string | null | undefined, language: Language) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-OM', { dateStyle: 'medium' }).format(new Date(value));
}

function formatDateTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-OM', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatMoney(value: string | number | null | undefined, currency: string, language: Language) {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat(language === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency,
    maximumFractionDigits: 3,
  }).format(amount);
}

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function dateTimeInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function loadAllProperties(token: string, companyId: string) {
  const collected: PmsProperty[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await listPmsProperties(token, { companyId, active: 'ACTIVE', sortBy: 'name', direction: 'asc', take: 100, skip });
    collected.push(...page.properties);
    if (collected.length >= page.pagination.total || page.properties.length === 0) return collected;
  }
}

async function loadAllVendors(token: string, companyId: string) {
  const collected: PmsVendor[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await listPmsVendors(token, { companyId, active: 'ACTIVE', sortBy: 'name', direction: 'asc', take: 100, skip });
    collected.push(...page.vendors);
    if (collected.length >= page.pagination.total || page.vendors.length === 0) return collected;
  }
}

async function loadAllUnits(token: string, companyId: string, propertyId: string) {
  const collected: PmsUnit[] = [];
  for (let skip = 0; ; skip += 200) {
    const page = await listPmsUnits(token, { companyId, propertyId, sortBy: 'unitNumber', direction: 'asc', take: 200, skip });
    collected.push(...page.units);
    if (collected.length >= page.pagination.total || page.units.length === 0) return collected;
  }
}

function assetPayload(form: HTMLFormElement, companyId: string): PmsAssetPayload | null {
  const data = new FormData(form);
  const propertyId = String(data.get('propertyId') ?? '').trim();
  const assetCode = String(data.get('assetCode') ?? '').trim();
  const name = String(data.get('name') ?? '').trim();
  const category = String(data.get('category') ?? '').trim();
  if (!propertyId || !assetCode || !name || !category) return null;
  const nullableText = (key: string) => String(data.get(key) ?? '').trim() || null;
  const nullableNumber = (key: string) => {
    const value = String(data.get(key) ?? '').trim();
    return value ? Number(value) : null;
  };
  return {
    companyId,
    propertyId,
    unitId: nullableText('unitId'),
    vendorId: nullableText('vendorId'),
    assetCode,
    name,
    category,
    manufacturer: nullableText('manufacturer'),
    model: nullableText('model'),
    serialNumber: nullableText('serialNumber'),
    installationDate: nullableText('installationDate'),
    warrantyExpiry: nullableText('warrantyExpiry'),
    serviceIntervalDays: nullableNumber('serviceIntervalDays'),
    nextServiceDate: nullableText('nextServiceDate'),
    status: String(data.get('status') ?? 'ACTIVE') as PmsAssetStatus,
    purchaseCost: nullableNumber('purchaseCost'),
    currency: String(data.get('currency') ?? 'OMR').trim().toUpperCase(),
    notes: nullableText('notes'),
  };
}

export default function PmsAssetRegister({ token, companyId, language, canManageRecords, canRecordMaintenance, onTotalChange }: Props) {
  const c = copy[language];
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('assetPage') ?? 1) || 1);
  const query = searchParams.get('assetQ') ?? '';
  const propertyId = searchParams.get('assetProperty') ?? '';
  const status = (searchParams.get('assetStatus') ?? '') as PmsAssetStatus | '';
  const dueOnly = searchParams.get('assetDue') === 'true';
  const sort = (sortOptions.includes(searchParams.get('assetSort') as SortValue) ? searchParams.get('assetSort') : sortOptions[0]) as SortValue;
  const [sortBy, direction] = sort.split(':') as [NonNullable<Parameters<typeof listPmsAssets>[1]>['sortBy'], 'asc' | 'desc'];
  const [searchInput, setSearchInput] = useState(query);
  const [assets, setAssets] = useState<PmsAsset[]>([]);
  const [pagination, setPagination] = useState<PmsAssetPagination | null>(null);
  const [properties, setProperties] = useState<PmsProperty[]>([]);
  const [vendors, setVendors] = useState<PmsVendor[]>([]);
  const [units, setUnits] = useState<PmsUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PmsAsset | null>(null);
  const [formPropertyId, setFormPropertyId] = useState('');
  const [detail, setDetail] = useState<PmsAsset | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventAsset, setEventAsset] = useState<PmsAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const rowTriggerRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const eventTypeRef = useRef<HTMLSelectElement>(null);

  const replaceQuery = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => setSearchInput(query), [query]);

  useEffect(() => {
    let active = true;
    void Promise.all([loadAllProperties(token, companyId), (canManageRecords || canRecordMaintenance) ? loadAllVendors(token, companyId) : Promise.resolve([])]).then(([propertyRows, vendorRows]) => {
      if (!active) return;
      setProperties(propertyRows);
      setVendors(vendorRows);
    }).catch((loadError) => {
      if (active) setError(apiMessage(loadError, c.failed));
    });
    return () => { active = false; };
  }, [c.failed, canManageRecords, canRecordMaintenance, companyId, token]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void listPmsAssets(token, {
      companyId,
      propertyId: propertyId || undefined,
      status: status || undefined,
      dueOnly: dueOnly || undefined,
      search: query || undefined,
      sortBy,
      direction,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      signal: controller.signal,
    }).then((result) => {
      setAssets(result.assets);
      setPagination(result.pagination);
      onTotalChange?.(result.pagination.total);
      if (page > 1 && result.assets.length === 0 && result.pagination.total > 0) {
        replaceQuery({ assetPage: String(Math.ceil(result.pagination.total / PAGE_SIZE)) });
      }
    }).catch((loadError) => {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(apiMessage(loadError, c.failed));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [c.failed, companyId, direction, dueOnly, onTotalChange, page, propertyId, query, refreshKey, replaceQuery, sortBy, status, token]);

  useEffect(() => {
    if (!formOpen || !formPropertyId) {
      setUnits([]);
      return;
    }
    let active = true;
    void loadAllUnits(token, companyId, formPropertyId).then((rows) => {
      if (active) setUnits(rows);
    }).catch((loadError) => {
      if (active) setDialogError(apiMessage(loadError, c.failed));
    });
    return () => { active = false; };
  }, [c.failed, companyId, formOpen, formPropertyId, token]);

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    replaceQuery({ assetQ: searchInput.trim() || null, assetPage: null });
  }

  function openCreate() {
    setEditing(null);
    setDialogError('');
    setFormPropertyId(propertyId || properties[0]?.id || '');
    setFormOpen(true);
  }

  function openEdit(asset: PmsAsset, trigger: HTMLButtonElement) {
    rowTriggerRef.current = trigger;
    setEditing(asset);
    setDialogError('');
    setFormPropertyId(asset.propertyId);
    setFormOpen(true);
  }

  async function submitAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = assetPayload(event.currentTarget, companyId);
    if (!payload) {
      setDialogError(c.required);
      return;
    }
    setBusy(true);
    setDialogError('');
    try {
      if (editing) await updatePmsAsset(token, editing.id, payload);
      else await createPmsAsset(token, payload);
      setFormOpen(false);
      setEditing(null);
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      setDialogError(apiMessage(saveError, c.failed));
    } finally {
      setBusy(false);
    }
  }

  function openDetails(asset: PmsAsset, trigger: HTMLButtonElement) {
    rowTriggerRef.current = trigger;
    setDetail(asset);
  }

  function openEvent() {
    if (!detail) return;
    setDialogError('');
    setEventAsset(detail);
    setDetail(null);
    setEventOpen(true);
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eventAsset) return;
    const data = new FormData(event.currentTarget);
    const type = String(data.get('type')) as Exclude<PmsAssetEventType, 'CREATED'>;
    const costValue = String(data.get('cost') ?? '').trim();
    setBusy(true);
    setDialogError('');
    try {
      await createPmsAssetEvent(token, eventAsset.id, {
        companyId,
        type,
        occurredAt: String(data.get('occurredAt')),
        cost: costValue ? Number(costValue) : null,
        currency: costValue ? String(data.get('currency') ?? eventAsset.currency).trim().toUpperCase() : null,
        notes: String(data.get('notes') ?? '').trim() || null,
        nextServiceDate: String(data.get('nextServiceDate') ?? '').trim() || null,
      });
      setEventOpen(false);
      setEventAsset(null);
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      setDialogError(apiMessage(saveError, c.failed));
    } finally {
      setBusy(false);
    }
  }

  const from = pagination?.total ? pagination.skip + 1 : 0;
  const to = pagination ? pagination.skip + pagination.count : 0;
  const allowedEventTypes = canManageRecords ? inventoryEventTypes : maintenanceEventTypes;
  const canRecordEvents = canManageRecords || canRecordMaintenance;
  const selectedProperty = useMemo(() => properties.find((property) => property.id === formPropertyId), [formPropertyId, properties]);

  return (
    <section className="pms-asset-register" aria-labelledby="asset-register-title">
      <header className="pms-asset-register__header">
        <div><p className="eyebrow"><Wrench aria-hidden="true" size={16} /> PMS operations</p><h2 id="asset-register-title">{c.title}</h2><p>{c.description}</p></div>
        {canManageRecords ? <button className="button-link button-link--primary" disabled={properties.length === 0} onClick={openCreate} ref={addTriggerRef} type="button"><PackagePlus aria-hidden="true" size={17} />{c.add}</button> : null}
      </header>
      {!canManageRecords ? <p className="pms-asset-register__permission" role="note">{canRecordMaintenance ? c.maintenancePermission : c.permission}</p> : null}

      <form aria-label={c.filtersLabel} className="pms-asset-filters" onSubmit={submitFilters}>
        <label className="pms-asset-filters__search"><span>{c.search}</span><div><Search aria-hidden="true" size={17} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div></label>
        <label><span>{c.property}</span><select value={propertyId} onChange={(event) => replaceQuery({ assetProperty: event.target.value || null, assetPage: null })}><option value="">{c.allProperties}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
        <label><span>{c.status}</span><select value={status} onChange={(event) => replaceQuery({ assetStatus: event.target.value || null, assetPage: null })}><option value="">{c.allStatuses}</option>{assetStatuses.map((value) => <option key={value} value={value}>{enumLabel(value, language)}</option>)}</select></label>
        <label><span>{c.sort}</span><select value={sort} onChange={(event) => replaceQuery({ assetSort: event.target.value, assetPage: null })}>{sortOptions.map((value) => <option key={value} value={value}>{value.split(':').map((part) => enumLabel(part, language)).join(' · ')}</option>)}</select></label>
        <label className="pms-asset-filters__check"><input checked={dueOnly} onChange={(event) => replaceQuery({ assetDue: event.target.checked ? 'true' : null, assetPage: null })} type="checkbox" /><span>{c.dueOnly}</span></label>
        <div className="pms-asset-filters__actions"><button className="button-link button-link--primary" type="submit">{c.apply}</button><button className="button-link button-link--secondary" onClick={() => { setSearchInput(''); replaceQuery({ assetQ: null, assetProperty: null, assetStatus: null, assetDue: null, assetSort: null, assetPage: null }); }} type="button">{c.clear}</button></div>
      </form>

      {error ? <div className="pms-asset-register__state pms-asset-register__state--error" role="alert">{error}</div> : null}
      {loading ? <div className="pms-asset-register__state" role="status">{c.loading}</div> : null}
      {!loading && !error && assets.length === 0 ? <PortalEmpty title={c.noAssets} message={c.noAssetsMessage} /> : null}
      {!loading && assets.length ? (
        <div className="pms-asset-table-wrap">
          <table className="pms-asset-table"><caption>{c.tableCaption}</caption><thead><tr><th>{c.code}</th><th>{c.name}</th><th>{c.placement}</th><th>{c.vendor}</th><th>{c.service}</th><th>{c.warranty}</th><th>{c.status}</th><th>{c.actions}</th></tr></thead>
            <tbody>{assets.map((asset) => <tr key={asset.id}><td data-label={c.code}><strong>{asset.assetCode}</strong><small>{asset.category}</small></td><td data-label={c.name}>{asset.name}<small>{[asset.manufacturer, asset.model].filter(Boolean).join(' · ') || asset.serialNumber || '—'}</small></td><td data-label={c.placement}>{asset.property.name}<small>{asset.unit?.unitNumber ?? c.propertyWide}</small></td><td data-label={c.vendor}>{asset.vendor?.name ?? '—'}</td><td data-label={c.service}>{formatDate(asset.nextServiceDate, language)}</td><td data-label={c.warranty}>{formatDate(asset.warrantyExpiry, language)}</td><td data-label={c.status}><span className={`pms-asset-status pms-asset-status--${asset.status.toLowerCase()}`}>{enumLabel(asset.status, language)}</span></td><td data-label={c.actions}><div className="pms-asset-row-actions"><button onClick={(event) => openDetails(asset, event.currentTarget)} type="button">{c.view}</button>{canManageRecords ? <button onClick={(event) => openEdit(asset, event.currentTarget)} type="button"><Pencil aria-hidden="true" size={15} />{c.edit}</button> : null}</div></td></tr>)}</tbody>
          </table>
        </div>
      ) : null}

      {pagination && pagination.total > 0 ? <nav aria-label={c.title} className="pms-asset-pagination"><button disabled={page <= 1 || loading} onClick={() => replaceQuery({ assetPage: String(page - 1) })} type="button"><ChevronLeft aria-hidden="true" size={17} />{c.previous}</button><span>{c.pageRange(from, to, pagination.total)}</span><button disabled={to >= pagination.total || loading} onClick={() => replaceQuery({ assetPage: String(page + 1) })} type="button">{c.next}<ChevronRight aria-hidden="true" size={17} /></button></nav> : null}

      <AccessibleDialog closeLabel={c.close} description={c.formDescription} initialFocusRef={firstFieldRef} onClose={() => { if (!busy) setFormOpen(false); }} open={formOpen} returnFocusRef={editing ? rowTriggerRef : addTriggerRef} size="large" title={editing ? c.editTitle : c.createTitle}>
        <form className="pms-asset-form" onSubmit={submitAsset}>
          {dialogError ? <div className="pms-asset-form__error" role="alert">{dialogError}</div> : null}
          <label><span>{c.property}</span><select name="propertyId" onChange={(event) => setFormPropertyId(event.target.value)} required value={formPropertyId}><option value="" disabled>{c.property}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <label><span>{c.unit}</span><select defaultValue={editing?.unitId ?? ''} key={`${editing?.id ?? 'new'}:${formPropertyId}`} name="unitId"><option value="">{c.propertyWide}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitNumber}</option>)}</select></label>
          <label><span>{c.code}</span><input defaultValue={editing?.assetCode ?? ''} name="assetCode" ref={firstFieldRef} required /></label>
          <label><span>{c.name}</span><input defaultValue={editing?.name ?? ''} name="name" required /></label>
          <label><span>{c.category}</span><input defaultValue={editing?.category ?? ''} name="category" required /></label>
          <label><span>{c.status}</span><select defaultValue={editing?.status ?? 'ACTIVE'} name="status">{assetStatuses.map((value) => <option key={value} value={value}>{enumLabel(value, language)}</option>)}</select></label>
          <label><span>{c.manufacturer}</span><input defaultValue={editing?.manufacturer ?? ''} name="manufacturer" /></label>
          <label><span>{c.model}</span><input defaultValue={editing?.model ?? ''} name="model" /></label>
          <label><span>{c.serial}</span><input defaultValue={editing?.serialNumber ?? ''} name="serialNumber" /></label>
          <label><span>{c.vendor}</span><select defaultValue={editing?.vendorId ?? ''} name="vendorId"><option value="">—</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
          <label><span>{c.installation}</span><input defaultValue={dateInput(editing?.installationDate)} name="installationDate" type="date" /></label>
          <label><span>{c.warranty}</span><input defaultValue={dateInput(editing?.warrantyExpiry)} name="warrantyExpiry" type="date" /></label>
          <label><span>{c.interval}</span><input defaultValue={editing?.serviceIntervalDays ?? ''} min="1" name="serviceIntervalDays" type="number" /></label>
          <label><span>{c.nextServiceDate}</span><input defaultValue={dateInput(editing?.nextServiceDate)} name="nextServiceDate" type="date" /></label>
          <label><span>{c.purchaseCost}</span><input defaultValue={editing?.purchaseCost ?? ''} min="0" name="purchaseCost" step="0.001" type="number" /></label>
          <label><span>{c.currency}</span><input defaultValue={editing?.currency ?? 'OMR'} maxLength={3} minLength={3} name="currency" required /></label>
          <label className="pms-asset-form__wide"><span>{c.notes}</span><textarea defaultValue={editing?.notes ?? ''} name="notes" rows={3} /></label>
          <div className="pms-asset-form__context">{selectedProperty ? selectedProperty.name : ''}</div>
          <div className="pms-asset-form__actions"><button className="button-link button-link--secondary" disabled={busy} onClick={() => setFormOpen(false)} type="button">{c.close}</button><button className="button-link button-link--primary" disabled={busy} type="submit">{busy ? c.saving : c.save}</button></div>
        </form>
      </AccessibleDialog>

      <AccessibleDialog closeLabel={c.close} description={c.detailsDescription} onClose={() => setDetail(null)} open={Boolean(detail)} returnFocusRef={rowTriggerRef} size="large" title={detail ? `${c.detailsTitle} · ${detail.assetCode}` : c.detailsTitle}>
        {detail ? <div className="pms-asset-detail"><div className="pms-asset-detail__summary"><div><span>{c.name}</span><strong>{detail.name}</strong></div><div><span>{c.placement}</span><strong>{detail.property.name}{detail.unit ? ` · ${detail.unit.unitNumber}` : ''}</strong></div><div><span>{c.status}</span><strong>{enumLabel(detail.status, language)}</strong></div><div><span>{c.serial}</span><strong>{detail.serialNumber ?? '—'}</strong></div><div><span>{c.vendor}</span><strong>{detail.vendor?.name ?? '—'}</strong></div><div><span>{c.purchaseCost}</span><strong>{formatMoney(detail.purchaseCost, detail.currency, language)}</strong></div></div><section aria-labelledby="asset-linked-title"><h3 id="asset-linked-title">{c.linkedWork}</h3><p>{detail._count.workOrders} {c.workOrders} · {detail._count.maintenancePlans} {c.maintenancePlans} · {detail._count.documents} {c.documents}</p></section><section aria-labelledby="asset-history-title"><h3 id="asset-history-title"><History aria-hidden="true" size={18} />{c.recentHistory}</h3>{detail.events.length ? <ol className="pms-asset-history">{detail.events.map((item) => <li key={item.id}><div><strong>{enumLabel(item.type, language)}</strong><time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt, language)}</time></div><p>{item.notes || '—'}{item.cost ? ` · ${formatMoney(item.cost, item.currency ?? detail.currency, language)}` : ''}</p></li>)}</ol> : <p>{c.noHistory}</p>}</section>{canRecordEvents ? <div className="pms-asset-detail__actions">{canManageRecords ? <button className="button-link button-link--secondary" onClick={() => { const asset = detail; setDetail(null); setEditing(asset); setDialogError(''); setFormPropertyId(asset.propertyId); setFormOpen(true); }} type="button"><Pencil aria-hidden="true" size={16} />{c.edit}</button> : null}<button className="button-link button-link--primary" onClick={openEvent} type="button"><CalendarClock aria-hidden="true" size={16} />{c.history}</button></div> : null}</div> : null}
      </AccessibleDialog>

      <AccessibleDialog closeLabel={c.close} description={c.eventDescription} initialFocusRef={eventTypeRef} onClose={() => { if (!busy) { setEventOpen(false); setEventAsset(null); } }} open={eventOpen} returnFocusRef={rowTriggerRef} size="medium" title={c.eventTitle}>
        <form className="pms-asset-form pms-asset-form--event" onSubmit={submitEvent}>{dialogError ? <div className="pms-asset-form__error" role="alert">{dialogError}</div> : null}<label><span>{c.eventType}</span><select name="type" ref={eventTypeRef}>{allowedEventTypes.map((value) => <option key={value} value={value}>{enumLabel(value, language)}</option>)}</select></label><label><span>{c.occurredAt}</span><input defaultValue={dateTimeInput()} name="occurredAt" required type="datetime-local" /></label><label><span>{c.cost}</span><input min="0" name="cost" step="0.001" type="number" /></label><label><span>{c.currency}</span><input defaultValue={eventAsset?.currency ?? 'OMR'} maxLength={3} minLength={3} name="currency" /></label><label><span>{c.nextServiceDate}</span><input name="nextServiceDate" type="date" /></label><label className="pms-asset-form__wide"><span>{c.notes}</span><textarea name="notes" rows={3} /></label><div className="pms-asset-form__actions"><button className="button-link button-link--secondary" disabled={busy} onClick={() => { setEventOpen(false); setEventAsset(null); }} type="button">{c.close}</button><button className="button-link button-link--primary" disabled={busy} type="submit">{busy ? c.recording : c.record}</button></div></form>
      </AccessibleDialog>
    </section>
  );
}
