import { ClipboardCheck, PackageSearch, Repeat2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { listPmsAssets, listPmsInspectionRuns, listPmsMaintenancePlans, type PmsAsset, type PmsInspectionRun, type PmsMaintenancePlan } from '../api/pmsAdvanced';
import { useAuth } from '../auth/AuthContext';
import { PortalEmpty, PortalError, PortalLoading, PortalPanel } from '../features/portal/PortalState';

export default function PmsAssetsInspections() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('companyId') ?? undefined;
  const [assets, setAssets] = useState<PmsAsset[]>([]);
  const [plans, setPlans] = useState<PmsMaintenancePlan[]>([]);
  const [inspections, setInspections] = useState<PmsInspectionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!token) return;
      try {
        setLoading(true); setError('');
        const [assetResult, planResult, inspectionResult] = await Promise.all([
          listPmsAssets(token, companyId), listPmsMaintenancePlans(token, companyId), listPmsInspectionRuns(token, companyId),
        ]);
        if (!active) return;
        setAssets(assetResult.assets); setPlans(planResult.plans); setInspections(inspectionResult.inspections);
      } catch (loadError) {
        if (active) setError(loadError instanceof ApiError ? loadError.message : 'Assets and inspections could not be loaded.');
      } finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [token, companyId]);

  if (loading) return <section className="pms-portal"><PortalLoading label="Loading assets and inspections…" /></section>;
  if (error) return <section className="pms-portal"><PortalError message={error} /></section>;

  return <section className="pms-portal" aria-labelledby="assets-inspections-title"><div className="pms-main">
    <header className="pms-header"><div><p className="eyebrow">PMS operations</p><h1 id="assets-inspections-title">Assets, preventive maintenance, and inspections</h1><p>Track warranty, service history, recurring plans, structured findings, and work-order conversion.</p></div><Link className="button-link button-link--secondary" to={`/pms/maintenance${companyId ? `?companyId=${companyId}` : ''}`}>Maintenance workspace</Link></header>
    <section className="pms-metric-grid"><article className="pms-metric-card"><PackageSearch size={20} /><span>Registered assets</span><strong>{assets.length}</strong></article><article className="pms-metric-card"><Repeat2 size={20} /><span>Active plans</span><strong>{plans.filter((plan) => plan.status === 'ACTIVE').length}</strong></article><article className="pms-metric-card"><ClipboardCheck size={20} /><span>Inspection runs</span><strong>{inspections.length}</strong></article><article className="pms-metric-card"><ShieldAlert size={20} /><span>Open defects</span><strong>{inspections.flatMap((inspection) => inspection.defects ?? []).filter((defect) => defect.status === 'OPEN').length}</strong></article></section>
    <div className="pms-content-grid">
      <PortalPanel title="Asset register">{assets.length === 0 ? <PortalEmpty title="No assets" message="Register building systems, appliances, equipment, and warranty information." /> : assets.slice(0, 40).map((asset) => <article key={asset.id} className="pms-list-card"><div><strong>{asset.assetCode} · {asset.name}</strong><span>{asset.property.name}{asset.unit ? ` · ${asset.unit.unitNumber}` : ''} · {asset.category}</span></div><b>{asset.status}</b></article>)}</PortalPanel>
      <PortalPanel title="Preventive-maintenance plans">{plans.length === 0 ? <PortalEmpty title="No recurring plans" message="Create interval or date-based plans to generate idempotent work orders." /> : plans.slice(0, 30).map((plan) => <article key={plan.id} className="pms-list-card"><div><strong>{plan.title}</strong><span>{plan.property.name}{plan.asset ? ` · ${plan.asset.assetCode}` : ''}</span></div><b>{new Date(plan.nextServiceDate).toLocaleDateString()}</b></article>)}</PortalPanel>
      <PortalPanel title="Structured inspections">{inspections.length === 0 ? <PortalEmpty title="No inspection runs" message="Templates and completed checklists will appear here." /> : inspections.slice(0, 30).map((inspection) => <article key={inspection.id} className="pms-list-card"><div><strong>{inspection.title}</strong><span>{inspection.property.name}{inspection.unit ? ` · ${inspection.unit.unitNumber}` : ''} · {inspection.type}</span></div><b>{inspection.status}</b></article>)}</PortalPanel>
    </div>
  </div></section>;
}
