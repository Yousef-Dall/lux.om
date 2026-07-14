import { ClipboardCheck, PackageSearch, Repeat2, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import PmsAssetRegister from '../features/pms/assets/PmsAssetRegister';
import PmsInspectionWorkspace from '../features/pms/inspections/PmsInspectionWorkspace';
import PmsPreventiveMaintenanceWorkspace from '../features/pms/maintenance/PmsPreventiveMaintenanceWorkspace';
import { hasPmsPermission, resolvePmsWorkspace } from '../features/pms/access';
import { PortalError } from '../features/portal/PortalState';
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
  const [planSummary, setPlanSummary] = useState({ active: 0, due: 0, total: 0 });
  const [inspectionSummary, setInspectionSummary] = useState({ scheduled: 0, needsAction: 0, openDefects: 0, total: 0 });

  const copy = language === 'ar'
    ? {
        eyebrow: 'عمليات PMS',
        title: 'الأصول والصيانة الوقائية والفحوصات',
        description: 'إدارة دورة حياة الأصول ومواعيد الصيانة الوقائية وتنفيذ الفحوصات المنظمة من مساحة تشغيل واحدة.',
        maintenance: 'مساحة الصيانة',
        registered: 'الأصول المسجلة',
        activePlans: 'الخطط النشطة',
        inspectionRuns: 'جولات الفحص',
        openDefects: 'العيوب المفتوحة',
        error: 'تعذر فتح مساحة الأصول والفحوصات.',
      }
    : {
        eyebrow: 'PMS operations',
        title: 'Assets, preventive maintenance, and inspections',
        description: 'Manage asset lifecycle, preventive schedules, and practical structured-inspection execution from one operations workspace.',
        maintenance: 'Maintenance workspace',
        registered: 'Registered assets',
        activePlans: 'Active plans',
        inspectionRuns: 'Inspection runs',
        openDefects: 'Open defects',
        error: 'The asset and inspection workspace could not be opened.',
      };

  if (!token || !companyId) {
    return <section className="pms-route-content"><PortalError message={copy.error} /></section>;
  }

  return (
    <section className="pms-route-content" aria-labelledby="assets-inspections-title">
      <header className="pms-header"><div><p className="eyebrow">{copy.eyebrow}</p><h1 id="assets-inspections-title">{copy.title}</h1><p>{copy.description}</p></div><Link className="button-link button-link--secondary" to={`/pms/operations/maintenance?companyId=${encodeURIComponent(companyId)}`}>{copy.maintenance}</Link></header>
      <section className="pms-metric-grid" aria-label={copy.title}>
        <article className="pms-metric-card"><PackageSearch aria-hidden="true" size={20} /><span>{copy.registered}</span><strong>{assetTotal}</strong></article>
        <article className="pms-metric-card"><Repeat2 aria-hidden="true" size={20} /><span>{copy.activePlans}</span><strong>{planSummary.active}</strong></article>
        <article className="pms-metric-card"><ClipboardCheck aria-hidden="true" size={20} /><span>{copy.inspectionRuns}</span><strong>{inspectionSummary.total}</strong></article>
        <article className="pms-metric-card"><ShieldAlert aria-hidden="true" size={20} /><span>{copy.openDefects}</span><strong>{inspectionSummary.openDefects}</strong></article>
      </section>

      <PmsAssetRegister canManageRecords={canManageAssetRecords} canRecordMaintenance={canRecordAssetMaintenance} companyId={companyId} language={language} onTotalChange={setAssetTotal} token={token} />

      <PmsPreventiveMaintenanceWorkspace canGenerateAcrossCompany={workspace?.propertyScope?.allProperties ?? false} canManage={canRecordAssetMaintenance} companyId={companyId} language={language} onSummaryChange={setPlanSummary} token={token} />

      <PmsInspectionWorkspace canManage={canRecordAssetMaintenance} companyId={companyId} language={language} onSummaryChange={setInspectionSummary} token={token} />
    </section>
  );
}
