import { ClipboardCheck, PackageSearch, Repeat2, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listPmsInspectionRuns, listPmsMaintenancePlans, type PmsInspectionRun, type PmsMaintenancePlan } from '../api/pmsAdvanced';
import { useAuth } from '../auth/AuthContext';
import PmsAssetRegister from '../features/pms/assets/PmsAssetRegister';
import { hasPmsPermission, resolvePmsWorkspace } from '../features/pms/access';
import { PortalEmpty, PortalError, PortalLoading, PortalPanel } from '../features/portal/PortalState';
import { useLanguage } from '../i18n/LanguageContext';

export default function PmsAssetsInspections() {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const requestedCompanyId = searchParams.get('companyId');
  const workspace = resolvePmsWorkspace(user?.pmsAccess?.workspaces ?? [], requestedCompanyId);
  const companyId = workspace?.company.id ?? '';
  const canManageAssetRecords = hasPmsPermission(workspace?.permissionKeys, 'INVENTORY_MANAGE');
  const canRecordAssetMaintenance = hasPmsPermission(workspace?.permissionKeys, 'MAINTENANCE_MANAGE');
  const [assetTotal, setAssetTotal] = useState(0);
  const [plans, setPlans] = useState<PmsMaintenancePlan[]>([]);
  const [inspections, setInspections] = useState<PmsInspectionRun[]>([]);
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [operationsError, setOperationsError] = useState('');

  const copy = language === 'ar'
    ? {
        eyebrow: 'عمليات PMS',
        title: 'الأصول والصيانة الوقائية والفحوصات',
        description: 'إدارة دورة حياة الأصول ومواعيد الصيانة الوقائية ونتائج الفحوصات المنظمة من مساحة تشغيل واحدة.',
        maintenance: 'مساحة الصيانة',
        registered: 'الأصول المسجلة',
        activePlans: 'الخطط النشطة',
        inspectionRuns: 'جولات الفحص',
        openDefects: 'العيوب المفتوحة',
        loading: 'جارٍ تحميل ملخص الصيانة الوقائية والفحوصات…',
        error: 'تعذر تحميل ملخص الصيانة الوقائية والفحوصات.',
        plansTitle: 'ملخص الصيانة الوقائية',
        noPlans: 'لا توجد خطط متكررة',
        noPlansMessage: 'أنشئ خططاً دورية أو محددة التاريخ لتوليد أوامر عمل دون تكرار.',
        inspectionsTitle: 'ملخص الفحوصات المنظمة',
        noInspections: 'لا توجد جولات فحص',
        noInspectionsMessage: 'ستظهر أحدث الجولات والقوائم المكتملة هنا.',
        showing: (shown: number, total: number) => `عرض أحدث ${shown} من ${total}`,
      }
    : {
        eyebrow: 'PMS operations',
        title: 'Assets, preventive maintenance, and inspections',
        description: 'Manage asset lifecycle, preventive schedules, and structured inspection outcomes from one operations workspace.',
        maintenance: 'Maintenance workspace',
        registered: 'Registered assets',
        activePlans: 'Active plans',
        inspectionRuns: 'Inspection runs',
        openDefects: 'Open defects',
        loading: 'Loading preventive-maintenance and inspection summary…',
        error: 'The preventive-maintenance and inspection summary could not be loaded.',
        plansTitle: 'Preventive-maintenance summary',
        noPlans: 'No recurring plans',
        noPlansMessage: 'Create interval or date-based plans to generate idempotent work orders.',
        inspectionsTitle: 'Structured-inspection summary',
        noInspections: 'No inspection runs',
        noInspectionsMessage: 'The latest runs and completed checklists will appear here.',
        showing: (shown: number, total: number) => `Showing latest ${shown} of ${total}`,
      };

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    setOperationsLoading(true);
    setOperationsError('');
    void Promise.all([
      listPmsMaintenancePlans(token, companyId),
      listPmsInspectionRuns(token, companyId),
    ]).then(([planResult, inspectionResult]) => {
      if (!active) return;
      setPlans(planResult.plans);
      setInspections(inspectionResult.inspections);
    }).catch((loadError) => {
      if (active) setOperationsError(loadError instanceof ApiError ? loadError.message : copy.error);
    }).finally(() => {
      if (active) setOperationsLoading(false);
    });
    return () => { active = false; };
  }, [companyId, copy.error, token]);

  const activePlanCount = plans.filter((plan) => plan.status === 'ACTIVE').length;
  const openDefectCount = useMemo(
    () => inspections.flatMap((inspection) => inspection.defects ?? []).filter((defect) => defect.status === 'OPEN').length,
    [inspections],
  );
  const recentPlans = plans.slice(0, 5);
  const recentInspections = inspections.slice(0, 5);

  if (!token || !companyId) {
    return <section className="pms-route-content"><PortalError message={copy.error} /></section>;
  }

  return (
    <section className="pms-route-content" aria-labelledby="assets-inspections-title">
      <header className="pms-header"><div><p className="eyebrow">{copy.eyebrow}</p><h1 id="assets-inspections-title">{copy.title}</h1><p>{copy.description}</p></div><Link className="button-link button-link--secondary" to={`/pms/operations/maintenance?companyId=${encodeURIComponent(companyId)}`}>{copy.maintenance}</Link></header>
      <section className="pms-metric-grid" aria-label={copy.title}><article className="pms-metric-card"><PackageSearch aria-hidden="true" size={20} /><span>{copy.registered}</span><strong>{assetTotal}</strong></article><article className="pms-metric-card"><Repeat2 aria-hidden="true" size={20} /><span>{copy.activePlans}</span><strong>{activePlanCount}</strong></article><article className="pms-metric-card"><ClipboardCheck aria-hidden="true" size={20} /><span>{copy.inspectionRuns}</span><strong>{inspections.length}</strong></article><article className="pms-metric-card"><ShieldAlert aria-hidden="true" size={20} /><span>{copy.openDefects}</span><strong>{openDefectCount}</strong></article></section>

      <PmsAssetRegister canManageRecords={canManageAssetRecords} canRecordMaintenance={canRecordAssetMaintenance} companyId={companyId} language={language} onTotalChange={setAssetTotal} token={token} />

      {operationsLoading ? <PortalLoading label={copy.loading} /> : null}
      {operationsError ? <PortalError message={operationsError} /> : null}
      {!operationsLoading && !operationsError ? <div className="pms-content-grid pms-operations-summary-grid">
        <PortalPanel title={copy.plansTitle}>{recentPlans.length === 0 ? <PortalEmpty title={copy.noPlans} message={copy.noPlansMessage} /> : <><p className="pms-summary-count">{copy.showing(recentPlans.length, plans.length)}</p>{recentPlans.map((plan) => <article key={plan.id} className="pms-list-card"><div><strong>{plan.title}</strong><span>{plan.property.name}{plan.asset ? ` · ${plan.asset.assetCode}` : ''}</span></div><b>{new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-OM').format(new Date(plan.nextServiceDate))}</b></article>)}</>}</PortalPanel>
        <PortalPanel title={copy.inspectionsTitle}>{recentInspections.length === 0 ? <PortalEmpty title={copy.noInspections} message={copy.noInspectionsMessage} /> : <><p className="pms-summary-count">{copy.showing(recentInspections.length, inspections.length)}</p>{recentInspections.map((inspection) => <article key={inspection.id} className="pms-list-card"><div><strong>{inspection.title}</strong><span>{inspection.property.name}{inspection.unit ? ` · ${inspection.unit.unitNumber}` : ''} · {inspection.type}</span></div><b>{inspection.status}</b></article>)}</>}</PortalPanel>
      </div> : null}
    </section>
  );
}
