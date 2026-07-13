import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Columns3,
  ContactRound,
  GitMerge,
  MailCheck,
  Plus,
  RefreshCw,
  TrendingUp,
  UserRound,
  UsersRound
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getCrmLead, type CrmLead, type CrmWorkspaceAccess } from '../api/crm';
import {
  archiveCrmDeal,
  convertCrmLead,
  createCrmAccount,
  createCrmAccountContact,
  createCrmDeal,
  createCrmPipeline,
  getCrmAccount,
  getCrmContactDetail,
  getCrmDeal,
  getCrmForecast,
  getCrmLeadScoreHistory,
  getCrmCommunicationPolicy,
  listCrmAccounts,
  listCrmDeals,
  listCrmPipelines,
  mergeCrmContacts,
  previewCrmContactMerge,
  transitionCrmDeal,
  updateCrmCommunicationGovernance,
  updateCrmCommunicationPolicy,
  updateCrmPipelineStage,
  type CrmAccountSummary,
  type CrmCommunicationPolicy,
  type CrmContactDetail,
  type CrmContactMergePreview,
  type CrmContactMergeResolution,
  type CrmContactMergeResult,
  type CrmDeal,
  type CrmDuplicateCandidate,
  type CrmForecastResponse,
  type CrmPipeline,
  type CrmScoreSnapshot
} from '../api/crmAdvanced';
import { useAuth } from '../auth/AuthContext';
import CrmContactMergeDialog from '../features/crm/contacts/CrmContactMergeDialog';
import CrmDealStageTransitionDialog, {
  type CrmDealTransitionValues
} from '../features/crm/deals/CrmDealStageTransitionDialog';
import { WorkspaceSelector, type CrmWorkspaceChoice } from '../features/crm/WorkspaceSelector';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

type Tab = 'accounts' | 'deals' | 'pipelines' | 'forecast' | 'governance';

export type CrmOperationsSection =
  | 'accounts'
  | 'contacts'
  | 'deals'
  | 'pipelines'
  | 'analytics'
  | 'communications'
  | 'scoring'
  | 'communication-settings';

const sectionTabs: Record<CrmOperationsSection, Tab | 'scoring'> = {
  accounts: 'accounts',
  contacts: 'accounts',
  deals: 'deals',
  pipelines: 'pipelines',
  analytics: 'forecast',
  communications: 'governance',
  scoring: 'scoring',
  'communication-settings': 'governance'
};


function message(error: unknown) {
  return error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'CRM operation failed.';
}

function money(value: string | number | null | undefined, currency: string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-OM', { style: 'currency', currency, maximumFractionDigits: 3 }).format(Number.isFinite(amount) ? amount : 0);
}

function workspaceChoices(access: CrmWorkspaceAccess | null | undefined): CrmWorkspaceChoice[] {
  if (!access) return [];
  const values: CrmWorkspaceChoice[] = [];
  const personal = access.workspaces?.find((item) => item.type === 'PERSONAL');
  if (personal?.workspaceId && personal.canView) values.push({ key: personal.workspaceId, workspaceId: personal.workspaceId, label: 'Personal CRM', canManage: personal.canManage, canManageWorkspace: true, propertyScope: personal.propertyScope });
  for (const company of access.companyWorkspaces.filter((item) => item.canView)) {
    values.push({ key: company.workspaceId, workspaceId: company.workspaceId, companyId: company.companyId, label: company.nameEn, canManage: company.canManage, canManageWorkspace: company.canManageWorkspace, propertyScope: company.propertyScope });
  }
  const platform = access.workspaces?.find((item) => item.type === 'PLATFORM');
  if (platform?.workspaceId && access.isAdmin) values.push({ key: platform.workspaceId, workspaceId: platform.workspaceId, label: 'lux.om operator CRM', canManage: true, canManageWorkspace: true, propertyScope: platform.propertyScope });
  return values;
}

export default function CrmOperations({ section }: { section: CrmOperationsSection }) {
  const { token, crmAccess: access } = useAuth();
  const { language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { accountId, contactId, dealId } = useParams<{ accountId?: string; contactId?: string; dealId?: string }>();
  const choices = useMemo(() => workspaceChoices(access), [access]);
  const requestedWorkspaceId = params.get('workspaceId');
  const convertLeadId = params.get('convertLeadId');
  const [workspaceId, setWorkspaceId] = useState('');
  const tab = sectionTabs[section];
  const [accounts, setAccounts] = useState<CrmAccountSummary[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
  const [forecast, setForecast] = useState<CrmForecastResponse | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Awaited<ReturnType<typeof getCrmAccount>>['account'] | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);
  const [selectedContact, setSelectedContact] = useState<CrmContactDetail | null>(null);
  const [duplicates, setDuplicates] = useState<CrmDuplicateCandidate[]>([]);
  const [scoreHistory, setScoreHistory] = useState<CrmScoreSnapshot[]>([]);
  const [conversionLead, setConversionLead] = useState<CrmLead | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showPipelineForm, setShowPipelineForm] = useState(false);
  const [pendingDealTransition, setPendingDealTransition] = useState<{
    deal: CrmDeal;
    targetStage: CrmPipeline['stages'][number];
  } | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState('');
  const dealTransitionTriggerRef = useRef<HTMLSelectElement>(null);
  const [pendingContactMerge, setPendingContactMerge] = useState<CrmDuplicateCandidate | null>(null);
  const [contactMergePreview, setContactMergePreview] = useState<CrmContactMergePreview | null>(null);
  const [contactMergeResult, setContactMergeResult] = useState<CrmContactMergeResult | null>(null);
  const [contactMergeBusy, setContactMergeBusy] = useState(false);
  const [contactMergeError, setContactMergeError] = useState('');
  const contactMergeTriggerRef = useRef<HTMLButtonElement>(null);
  const [communicationPolicy, setCommunicationPolicy] = useState<CrmCommunicationPolicy | null>(null);
  const activeChoice = choices.find((item) => item.workspaceId === workspaceId);
  const canManage = Boolean(activeChoice?.canManage);
  const canConfigure = Boolean(access?.isAdmin || activeChoice?.canManageWorkspace);
  useDocumentTitle(`CRM ${section.replace('-', ' ')} | lux.om`);

  useEffect(() => {
    setWorkspaceId((current) => {
      if (requestedWorkspaceId && choices.some((item) => item.workspaceId === requestedWorkspaceId)) {
        return requestedWorkspaceId;
      }
      if (choices.some((item) => item.workspaceId === current)) return current;
      return choices[0]?.workspaceId ?? '';
    });
  }, [choices, requestedWorkspaceId]);

  useEffect(() => {
    if (!workspaceId || requestedWorkspaceId === workspaceId) return;
    const next = new URLSearchParams(params);
    next.set('workspaceId', workspaceId);
    setParams(next, { replace: true });
  }, [params, requestedWorkspaceId, setParams, workspaceId]);

  async function load() {
    if (!token || !workspaceId) return;
    setRefreshing(true);
    setError('');
    try {
      const [accountResult, dealResult, pipelineResult, forecastResult, policyResult] = await Promise.all([
        listCrmAccounts(token, workspaceId),
        listCrmDeals(token, workspaceId),
        listCrmPipelines(token, workspaceId),
        getCrmForecast(token, workspaceId),
        canConfigure ? getCrmCommunicationPolicy(token, workspaceId) : Promise.resolve(null)
      ]);
      setAccounts(accountResult.accounts);
      setDeals(dealResult.deals);
      setPipelines(pipelineResult.pipelines);
      setForecast(forecastResult);
      setCommunicationPolicy(policyResult?.policy ?? null);
      if (convertLeadId) {
        const [leadResult, scores] = await Promise.all([getCrmLead(token, convertLeadId), getCrmLeadScoreHistory(token, convertLeadId)]);
        setConversionLead(leadResult.lead);
        setScoreHistory(scores.snapshots);
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void load(); }, [workspaceId]);

  useEffect(() => {
    if (!token || !workspaceId) return;
    if (accountId) void selectAccount(accountId, false);
    else if (contactId) void selectContact(contactId, false);
    else if (dealId) void selectDeal(dealId, false);
  }, [accountId, contactId, dealId, token, workspaceId]);

  async function selectAccount(id: string, updateRoute = true) {
    if (!token) return;
    try {
      const result = await getCrmAccount(token, id);
      setSelectedAccount(result.account);
      setSelectedDeal(null);
      setSelectedContact(null);
      if (updateRoute) navigate({ pathname: `/crm/accounts/${id}`, search: params.toString() ? `?${params.toString()}` : '' });
    } catch (cause) { setError(message(cause)); }
  }

  async function selectDeal(id: string, updateRoute = true) {
    if (!token) return;
    try {
      const result = await getCrmDeal(token, id);
      setSelectedDeal(result.deal);
      setSelectedAccount(null);
      setSelectedContact(null);
      if (updateRoute) navigate({ pathname: `/crm/deals/${id}`, search: params.toString() ? `?${params.toString()}` : '' });
    } catch (cause) { setError(message(cause)); }
  }

  async function selectContact(id: string, updateRoute = true) {
    if (!token) return;
    try {
      const result = await getCrmContactDetail(token, id);
      setSelectedContact({ ...result.contact, suppressions: result.suppressions });
      setDuplicates(result.duplicates);
      if (updateRoute) navigate({ pathname: `/crm/contacts/${id}`, search: params.toString() ? `?${params.toString()}` : '' });
    } catch (cause) { setError(message(cause)); }
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    const data = new FormData(event.currentTarget);
    try {
      await createCrmAccount(token, {
        workspaceId,
        type: data.get('type'),
        name: data.get('name'),
        legalName: data.get('legalName') || null,
        registrationNumber: data.get('registrationNumber') || null,
        pmsPropertyId: activeChoice?.propertyScope?.allProperties === false ? activeChoice.propertyScope.propertyIds[0] ?? null : null,
        teamUserIds: []
      });
      setShowAccountForm(false);
      setSuccess('CRM account created.');
      await load();
    } catch (cause) { setError(message(cause)); }
  }

  async function submitAccountContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedAccount) return;
    const data = new FormData(event.currentTarget);
    try {
      await createCrmAccountContact(token, selectedAccount.id, {
        fullName: data.get('fullName'),
        email: data.get('email') || null,
        phone: data.get('phone') || null,
        notes: data.get('notes') || null
      });
      setShowContactForm(false);
      setSuccess('Contact added to the account with workspace-scoped identity safeguards.');
      await selectAccount(selectedAccount.id);
      await load();
    } catch (cause) { setError(message(cause)); }
  }

  async function submitPipeline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    const data = new FormData(event.currentTarget);
    try {
      await createCrmPipeline(token, {
        workspaceId,
        name: data.get('name'),
        description: data.get('description') || null,
        isDefault: data.get('isDefault') === 'on',
        stages: [
          { key: `DISCOVERY_${Date.now()}`, name: 'Discovery', position: 10, type: 'OPEN', defaultProbability: 10, requiredFields: [], slaHours: 48 },
          { key: `QUALIFIED_${Date.now()}`, name: 'Qualified', position: 20, type: 'OPEN', defaultProbability: 35, requiredFields: ['accountId'], slaHours: 72 },
          { key: `PROPOSAL_${Date.now()}`, name: 'Proposal', position: 30, type: 'OPEN', defaultProbability: 65, requiredFields: ['expectedValue', 'currency'], slaHours: 120 },
          { key: `WON_${Date.now()}`, name: 'Won', position: 40, type: 'WON', defaultProbability: 100, requiredFields: [], slaHours: null },
          { key: `LOST_${Date.now()}`, name: 'Lost', position: 50, type: 'LOST', defaultProbability: 0, requiredFields: [], slaHours: null }
        ]
      });
      setShowPipelineForm(false);
      setSuccess('Configurable CRM pipeline created.');
      await load();
    } catch (cause) { setError(message(cause)); }
  }

  async function submitStage(event: FormEvent<HTMLFormElement>, stage: CrmPipeline['stages'][number]) {
    event.preventDefault();
    if (!token) return;
    const data = new FormData(event.currentTarget);
    try {
      await updateCrmPipelineStage(token, stage.id, {
        name: data.get('name'),
        defaultProbability: Number(data.get('defaultProbability')),
        slaHours: data.get('slaHours') ? Number(data.get('slaHours')) : null
      });
      setSuccess('Pipeline stage settings updated.');
      await load();
    } catch (cause) { setError(message(cause)); }
  }

  async function submitCommunicationPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !communicationPolicy) return;
    const data = new FormData(event.currentTarget);
    try {
      const result = await updateCrmCommunicationPolicy(token, {
        workspaceId: communicationPolicy.workspaceId,
        timezone: String(data.get('timezone')),
        quietHoursStart: Number(data.get('quietHoursStart')),
        quietHoursEnd: Number(data.get('quietHoursEnd')),
        hourlyRateLimit: Number(data.get('hourlyRateLimit')),
        retentionDays: Number(data.get('retentionDays'))
      });
      setCommunicationPolicy(result.policy);
      setSuccess('Workspace communication policy updated.');
    } catch (cause) { setError(message(cause)); }
  }

  async function submitDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !workspaceId) return;
    const data = new FormData(event.currentTarget);
    const pipeline = pipelines.find((item) => item.id === String(data.get('pipelineId')));
    const stage = pipeline?.stages.find((item) => item.id === String(data.get('stageId')))
      ?? pipeline?.stages.find((item) => item.type === 'OPEN');
    if (!pipeline || !stage) return;
    try {
      await createCrmDeal(token, {
        workspaceId,
        name: data.get('name'),
        accountId: data.get('accountId'),
        primaryContactId: data.get('primaryContactId') || null,
        pipelineId: pipeline.id,
        stageId: stage.id,
        expectedValue: data.get('expectedValue') ? Number(data.get('expectedValue')) : null,
        currency: data.get('currency') || 'OMR',
        probability: stage.defaultProbability,
        forecastCategory: 'PIPELINE',
        pmsPropertyId: activeChoice?.propertyScope?.allProperties === false ? activeChoice.propertyScope.propertyIds[0] ?? null : null,
        teamUserIds: []
      });
      setShowDealForm(false);
      setSuccess('Deal created.');
      await load();
    } catch (cause) { setError(message(cause)); }
  }

  async function submitConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !conversionLead) return;
    const data = new FormData(event.currentTarget);
    try {
      const pipelineId = String(data.get('pipelineId') || '');
      const selectedPipeline = pipelines.find((pipeline) => pipeline.id === pipelineId);
      const requestedStageId = String(data.get('stageId') || '');
      const stageId = selectedPipeline?.stages.some((stage) => stage.id === requestedStageId)
        ? requestedStageId
        : selectedPipeline?.stages.find((stage) => stage.type === 'OPEN')?.id;
      const existingAccountId = String(data.get('accountId') || '');
      await convertCrmLead(token, conversionLead.id, {
        accountId: existingAccountId || undefined,
        accountType: data.get('accountType') || 'INDIVIDUAL',
        accountName: existingAccountId ? undefined : data.get('accountName') || conversionLead.contact.fullName,
        dealName: data.get('dealName') || conversionLead.title,
        pipelineId: selectedPipeline?.id,
        stageId
      });
      setSuccess('Lead converted without changing its original history.');
      setConversionLead(null);
      const nextParams = new URLSearchParams(params);
      nextParams.delete('convertLeadId');
      setParams(nextParams);
      await load();
    } catch (cause) { setError(message(cause)); }
  }

  function requestDealTransition(deal: CrmDeal, stageId: string, trigger: HTMLSelectElement) {
    const pipeline = pipelines.find((item) => item.id === deal.pipelineId);
    const target = pipeline?.stages.find((stage) => stage.id === stageId);
    if (!target || target.id === deal.stageId) return;
    dealTransitionTriggerRef.current = trigger;
    setTransitionError('');
    setPendingDealTransition({ deal, targetStage: target });
  }

  async function confirmDealTransition(values: CrmDealTransitionValues) {
    if (!token || !pendingDealTransition || transitionBusy) return;
    const { deal, targetStage } = pendingDealTransition;
    setTransitionBusy(true);
    setTransitionError('');
    try {
      await transitionCrmDeal(token, deal.id, targetStage.id, {
        reason: values.reason ?? 'Pipeline board transition',
        lostReason: values.lostReason,
        wonReason: values.wonReason
      });
      setPendingDealTransition(null);
      setSuccess(language === 'ar' ? `تم نقل ${deal.name} إلى ${targetStage.name}.` : `${deal.name} moved to ${targetStage.name}.`);
      await load();
      if (selectedDeal?.id === deal.id) await selectDeal(deal.id);
    } catch (cause) {
      setTransitionError(message(cause));
    } finally {
      setTransitionBusy(false);
    }
  }

  async function requestContactMerge(candidate: CrmDuplicateCandidate, trigger: HTMLButtonElement) {
    if (!token || !selectedContact) return;
    contactMergeTriggerRef.current = trigger;
    setPendingContactMerge(candidate);
    setContactMergePreview(null);
    setContactMergeResult(null);
    setContactMergeError('');
    try {
      const result = await previewCrmContactMerge(token, selectedContact.id, candidate.id);
      setContactMergePreview(result.preview);
    } catch (cause) {
      setContactMergeError(message(cause));
    }
  }

  async function confirmContactMerge(resolutions: CrmContactMergeResolution) {
    if (!token || !selectedContact || !pendingContactMerge || contactMergeBusy) return;
    setContactMergeBusy(true);
    setContactMergeError('');
    try {
      const result = await mergeCrmContacts(token, selectedContact.id, pendingContactMerge.id, resolutions);
      setContactMergeResult(result);
      await Promise.all([selectContact(selectedContact.id, false), load()]);
    } catch (cause) {
      setContactMergeError(message(cause));
    } finally {
      setContactMergeBusy(false);
    }
  }

  async function setEmailConsent(status: 'CONSENTED' | 'LEGITIMATE_INTEREST' | 'OPTED_OUT') {
    if (!token || !selectedContact) return;
    try {
      await updateCrmCommunicationGovernance(token, selectedContact.id, { channel: 'EMAIL', status, lawfulBasis: status === 'CONSENTED' ? 'Recorded consent' : status === 'LEGITIMATE_INTEREST' ? 'Documented relationship' : null, preferred: status !== 'OPTED_OUT' });
      await selectContact(selectedContact.id);
      setSuccess('Communication governance updated.');
    } catch (cause) { setError(message(cause)); }
  }

  if (!access?.hasAccess || choices.length === 0) return <section className="page-section container crm-page"><div className="crm-state"><AlertCircle /><h1>No CRM access</h1><Link className="button-link" to="/dashboard">Back to dashboard</Link></div></section>;

  const defaultPipeline = pipelines.find((item) => item.isDefault) ?? pipelines[0];

  return (
    <section className="crm-page crm-operations" aria-labelledby="crm-operations-title">
      <header className="crm-hero container">
        <div><p className="eyebrow"><TrendingUp size={17} /> Revenue operating system</p><h1 id="crm-operations-title">CRM accounts, deals, pipelines, and governance</h1><p>Run workspace-scoped relationships, opportunity forecasts, durable scoring, source history, and consent-aware communications.</p></div>
        <div className="crm-hero__actions"><Link className="button-link button-link--ghost" to="/crm/leads"><ArrowLeft size={16} /> Leads</Link><button className="button-link button-link--secondary" type="button" onClick={() => void load()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refresh</button></div>
      </header>

      <div className="container crm-operations__workspace"><WorkspaceSelector label="Workspace" value={workspaceId} choices={choices} onChange={(value) => {
        const next = new URLSearchParams(params);
        next.set('workspaceId', value);
        const rootPath = section === 'accounts' ? '/crm/accounts' : section === 'contacts' ? '/crm/contacts' : section === 'deals' ? '/crm/deals' : section === 'pipelines' ? '/crm/settings/pipelines' : section === 'analytics' ? '/crm/analytics' : section === 'scoring' ? '/crm/settings/scoring' : section === 'communication-settings' ? '/crm/settings/communications' : '/crm/communications';
        setWorkspaceId(value);
        setSelectedAccount(null);
        setSelectedDeal(null);
        setSelectedContact(null);
        navigate({ pathname: rootPath, search: `?${next.toString()}` }, { replace: true });
      }} /></div>

      <main className="container crm-operations__main">
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        {success ? <div className="form-success" role="status">{success}</div> : null}

        {conversionLead ? <section className="crm-operations__panel"><header><div><p className="eyebrow">Explicit conversion</p><h2>Convert {conversionLead.contact.fullName}</h2></div><button type="button" className="button-link button-link--ghost" onClick={() => setConversionLead(null)}>Close</button></header><p>The original lead and score history remain unchanged and linked to the new account and deal.</p><form className="crm-form-grid" onSubmit={submitConversion}><label><span>Existing account</span><select name="accountId" defaultValue=""><option value="">Create a new account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><span>New account type</span><select name="accountType"><option value="INDIVIDUAL">Individual</option><option value="COMPANY">Company</option><option value="PROPERTY_OWNER">Property owner</option><option value="INVESTOR">Investor</option></select></label><label><span>New account name</span><input name="accountName" defaultValue={conversionLead.contact.fullName} /></label><label><span>Deal name</span><input name="dealName" defaultValue={conversionLead.title} required /></label><label><span>Pipeline</span><select name="pipelineId" defaultValue={defaultPipeline?.id}>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label><label><span>Starting stage</span><select name="stageId" defaultValue={defaultPipeline?.stages[0]?.id}>{defaultPipeline?.stages.filter((stage) => stage.type === 'OPEN').map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label><button className="button-link button-link--primary" type="submit">Create account and deal</button></form><div className="crm-score-history"><h3>Durable score history</h3>{scoreHistory.length === 0 ? <p>No snapshots.</p> : scoreHistory.map((score) => <article key={score.id}><strong>{score.score} · {score.band}</strong><span>{score.version}</span><small>{new Date(score.calculatedAt).toLocaleString()} · {score.trend}</small></article>)}</div></section> : null}

        {section === 'contacts' ? <section className="crm-operations__grid">
          <div className="crm-operations__panel">
            <header><div><p className="eyebrow"><ContactRound size={15} /> Relationship people</p><h2>Contacts by account</h2></div></header>
            {accounts.length === 0 ? <div className="crm-empty"><UserRound /><h3>No accounts available</h3></div> : <div className="crm-operations__list">{accounts.map((account) => <button type="button" key={account.id} onClick={() => void selectAccount(account.id, false)}><span><strong>{account.name}</strong><small>{account.type.replaceAll('_', ' ')}</small></span><span>{account._count.contacts} contacts</span></button>)}</div>}
          </div>
          <div className="crm-operations__panel">
            {selectedContact ? <>
              <header><div><p className="eyebrow">Contact detail</p><h2>{selectedContact.fullName}</h2></div></header>
              <p>{selectedContact.email || 'No email'} · {selectedContact.phone || 'No phone'}</p>
              <h3>Channel preferences</h3>
              {selectedContact.channelPreferences.length === 0 ? <p>No channel preferences recorded.</p> : selectedContact.channelPreferences.map((preference) => <p key={preference.id}>{preference.channel}: <strong>{preference.status}</strong></p>)}
              <h3>Duplicate safeguards</h3>
              {duplicates.length === 0 ? <p>No duplicate candidates detected.</p> : duplicates.map((candidate) => <article className="crm-duplicate-row" key={candidate.id}><div><strong>{candidate.fullName}</strong><small>{candidate.email || candidate.phone || 'No channel'} · {candidate.reasons.join(', ')}</small></div>{canManage ? <button type="button" onClick={(event) => void requestContactMerge(candidate, event.currentTarget)}>{language === 'ar' ? 'مراجعة الدمج' : 'Review merge'}</button> : null}</article>)}
            </> : selectedAccount ? <>
              <header><div><p className="eyebrow">Account contacts</p><h2>{selectedAccount.name}</h2></div></header>
              {canManage ? <button className="button-link button-link--ghost" type="button" onClick={() => setShowContactForm((value) => !value)}><Plus size={14} /> Add contact</button> : null}
              {showContactForm ? <form className="crm-inline-form" onSubmit={submitAccountContact}><input name="fullName" placeholder="Full name" required /><input name="email" type="email" placeholder="Email" /><input name="phone" placeholder="Phone" /><button type="submit">Save contact</button></form> : null}
              {selectedAccount.contacts.length === 0 ? <p>No contacts linked.</p> : selectedAccount.contacts.map((contact) => <button className="crm-contact-row" type="button" key={contact.id} onClick={() => void selectContact(contact.id)}><UserRound size={16} /><span><strong>{contact.fullName}</strong><small>{contact.email || contact.phone || 'No channel'}</small></span></button>)}
            </> : <div className="crm-empty"><UserRound /><h3>Select an account or open a contact URL</h3></div>}
          </div>
        </section> : null}

        {section === 'accounts' ? <section className="crm-operations__grid"><div className="crm-operations__panel"><header><div><p className="eyebrow"><Building2 size={15} /> External relationships</p><h2>Accounts</h2></div>{canManage ? <button className="button-link button-link--primary" type="button" onClick={() => setShowAccountForm(true)}><Plus size={15} /> Account</button> : null}</header>{accounts.length === 0 ? <div className="crm-empty"><Building2 /><h3>No accounts yet</h3></div> : <div className="crm-operations__list">{accounts.map((account) => <button type="button" key={account.id} onClick={() => void selectAccount(account.id)}><span><strong>{account.name}</strong><small>{account.type.replaceAll('_', ' ')}</small></span><span>{account._count.contacts} contacts · {account._count.deals} deals</span></button>)}</div>}</div><div className="crm-operations__panel">{selectedAccount ? <><header><div><p className="eyebrow">Account detail</p><h2>{selectedAccount.name}</h2></div></header><p>{selectedAccount.legalName || selectedAccount.registrationNumber || 'No registered business metadata.'}</p><h3>Contacts</h3>{canManage ? <button className="button-link button-link--ghost" type="button" onClick={() => setShowContactForm((value) => !value)}><Plus size={14} /> Add contact</button> : null}{showContactForm ? <form className="crm-inline-form" onSubmit={submitAccountContact}><input name="fullName" placeholder="Full name" required /><input name="email" type="email" placeholder="Email" /><input name="phone" placeholder="Phone" /><button type="submit">Save contact</button></form> : null}{selectedAccount.contacts.length === 0 ? <p>No contacts linked.</p> : selectedAccount.contacts.map((contact) => <button className="crm-contact-row" type="button" key={contact.id} onClick={() => void selectContact(contact.id)}><UserRound size={16} /><span><strong>{contact.fullName}</strong><small>{contact.email || contact.phone || 'No channel'}</small></span></button>)}<h3>Deals</h3>{selectedAccount.deals.map((deal) => <button className="crm-contact-row" type="button" key={deal.id} onClick={() => void selectDeal(deal.id)}><Columns3 size={16} /><span><strong>{deal.name}</strong><small>{deal.stage.name} · {money(deal.expectedValue, deal.currency)}</small></span></button>)}</> : <div className="crm-empty"><Building2 /><h3>Select an account</h3></div>}</div></section> : null}

        {tab === 'deals' ? <section className="crm-operations__panel"><header><div><p className="eyebrow"><Columns3 size={15} /> Opportunity pipeline</p><h2>Deals</h2></div>{canManage ? <button className="button-link button-link--primary" type="button" onClick={() => setShowDealForm(true)}><Plus size={15} /> Deal</button> : null}</header>{pipelines.map((pipeline) => <div key={pipeline.id} className="crm-deal-board"><h3>{pipeline.name}</h3><div>{pipeline.stages.map((stage) => <section key={stage.id} className="crm-deal-column"><header><strong>{stage.name}</strong><span>{deals.filter((deal) => deal.pipelineId === pipeline.id && deal.stageId === stage.id && !deal.archivedAt).length}</span></header>{deals.filter((deal) => deal.pipelineId === pipeline.id && deal.stageId === stage.id && !deal.archivedAt).map((deal) => <article key={deal.id}><button type="button" onClick={() => void selectDeal(deal.id)}><strong>{deal.name}</strong><small>{deal.account.name}</small><span>{money(deal.expectedValue, deal.currency)} · {deal.probability}%</span></button>{canManage && !deal.archivedAt ? <select aria-label={`Move ${deal.name}`} value={deal.stageId} onChange={(event) => requestDealTransition(deal, event.target.value, event.currentTarget)}>{pipeline.stages.map((target) => <option disabled={deal.outcome !== 'OPEN' && target.type !== 'OPEN' && target.id !== deal.stageId} key={target.id} value={target.id}>{target.name}</option>)}</select> : null}</article>)}</section>)}</div></div>)}{selectedDeal ? <aside className="crm-deal-detail"><header><h3>{selectedDeal.name}</h3><button type="button" onClick={() => setSelectedDeal(null)}>×</button></header><p>{selectedDeal.account.name} · {selectedDeal.pipeline.name} / {selectedDeal.stage.name}</p><strong>{money(selectedDeal.expectedValue, selectedDeal.currency)} · weighted {money(Number(selectedDeal.expectedValue ?? 0) * selectedDeal.probability / 100, selectedDeal.currency)}</strong><p>Outcome: {selectedDeal.outcome} · reopened {selectedDeal.reopenedCount}</p><h4>Immutable stage history</h4>{selectedDeal.stageHistory?.map((history) => <p key={history.id}><Clock3 size={14} /> {history.fromStage?.name || 'Created'} → {history.toStage.name} · {new Date(history.changedAt).toLocaleString()}</p>)}{canManage ? <button className="button-link button-link--ghost" type="button" onClick={() => void archiveCrmDeal(token!, selectedDeal.id, !selectedDeal.archivedAt).then(load)}>{selectedDeal.archivedAt ? 'Restore deal' : 'Archive deal'}</button> : null}</aside> : null}</section> : null}

        {tab === 'pipelines' ? <section><header className="crm-section-actions"><div><p className="eyebrow">Workspace configuration</p><h2>Configurable pipelines</h2></div>{canConfigure ? <button className="button-link button-link--primary" type="button" onClick={() => setShowPipelineForm(true)}><Plus size={15} /> Pipeline</button> : null}</header><div className="crm-operations__grid">{pipelines.map((pipeline) => <article className="crm-operations__panel" key={pipeline.id}><header><div><p className="eyebrow">{pipeline.isDefault ? 'Default pipeline' : 'Workspace pipeline'}</p><h2>{pipeline.name}</h2></div><span>{pipeline._count.deals} deals</span></header>{pipeline.stages.map((stage) => canConfigure ? <form className="crm-stage-editor" key={stage.id} onSubmit={(event) => void submitStage(event, stage)}><span>{stage.position}</span><input name="name" defaultValue={stage.name} aria-label={`${pipeline.name} ${stage.name} name`} /><select value={stage.type} disabled aria-label={`${stage.name} classification`}><option>{stage.type}</option></select><input name="defaultProbability" type="number" min="0" max="100" defaultValue={stage.defaultProbability} aria-label={`${stage.name} probability`} /><input name="slaHours" type="number" min="1" defaultValue={stage.slaHours ?? ''} placeholder="SLA hours" aria-label={`${stage.name} SLA`} /><button type="submit">Save</button></form> : <div className="crm-stage-row" key={stage.id}><span>{stage.position}</span><strong>{stage.name}</strong><small>{stage.type} · {stage.defaultProbability}% · SLA {stage.slaHours ?? '—'}h</small></div>)}</article>)}</div></section> : null}

        {tab === 'forecast' ? <section className="crm-operations__panel"><header><div><p className="eyebrow"><BarChart3 size={15} /> Complete-data analytics</p><h2>Conversion and forecast</h2></div></header>{forecast ? <><div className="crm-metrics"><article><UsersRound /><span>Leads</span><strong>{forecast.snapshot.leads.total}</strong></article><article><CheckCircle2 /><span>Converted</span><strong>{forecast.snapshot.leads.converted}</strong></article><article><TrendingUp /><span>Win rate</span><strong>{Math.round(forecast.snapshot.deals.winRate * 100)}%</strong></article><article><Clock3 /><span>Overdue</span><strong>{forecast.snapshot.overdueFollowUps}</strong></article></div><div className="crm-forecast-currencies">{forecast.snapshot.deals.forecast.length === 0 ? <p>No open forecast.</p> : forecast.snapshot.deals.forecast.map((row) => <article key={row.currency}><h3>{row.currency}</h3><p>Pipeline <strong>{money(row.pipelineValue, row.currency)}</strong></p><p>Weighted <strong>{money(row.weightedForecast, row.currency)}</strong></p></article>)}</div><div className="crm-analytics-dimensions"><article><h3>Stage drop-off</h3>{forecast.dimensions.stageDropOff.length ? forecast.dimensions.stageDropOff.map((row) => <p key={row.fromStageId ?? 'created'}>{forecast.dimensions.stages.find((stage) => stage.stageId === row.fromStageId)?.stage?.name ?? 'Created'}: {row.lostDeals}</p>) : <p>No lost transitions.</p>}</article><article><h3>Won reasons</h3>{forecast.dimensions.wonReasons.filter((row) => row.wonReason).map((row) => <p key={row.wonReason}>{row.wonReason}: {row._count._all}</p>)}</article><article><h3>Lost reasons</h3>{forecast.dimensions.lostReasons.filter((row) => row.lostReason).map((row) => <p key={row.lostReason}>{row.lostReason}: {row._count._all}</p>)}</article></div><p className="crm-governance-note">Currencies are intentionally separated. Historical won/lost outcomes remain counted after archival.</p></> : <div className="crm-empty"><BarChart3 /><h3>No analytics available</h3></div>}</section> : null}

        {tab === 'scoring' ? <section className="crm-operations__panel crm-scoring-foundation" aria-labelledby="crm-scoring-title">
          <header><div><p className="eyebrow"><TrendingUp size={15} /> Durable scoring</p><h2 id="crm-scoring-title">Scoring governance</h2></div></header>
          <p>Lead score snapshots and reasons are preserved by the backend. This route intentionally exposes the governed scoring foundation without inventing editable rules that the current API does not support.</p>
          <p>Open a lead to review its current score, reason breakdown, and next-best-action evidence.</p>
          <Link className="button-link button-link--secondary" to="/crm/leads">Review lead scoring</Link>
        </section> : null}

        {tab === 'governance' ? <section className="crm-operations__grid"><div className="crm-operations__panel"><header><div><p className="eyebrow"><MailCheck size={15} /> Consent and suppression</p><h2>Contact governance</h2></div></header><p>Select a contact from an account to review normalized identities, duplicate warnings, and lawful-contact state.</p>{selectedContact ? <><h3>{selectedContact.fullName}</h3><p>{selectedContact.email || 'No email'} · {selectedContact.phone || 'No phone'}</p>{selectedContact.channelPreferences.map((preference) => <p key={preference.id}>{preference.channel}: <strong>{preference.status}</strong>{preference.lawfulBasis ? ` · ${preference.lawfulBasis}` : ''}</p>)}{selectedContact.suppressions?.map((suppression) => <p key={suppression.id}>Suppressed {suppression.channel}: <strong>{suppression.reason}</strong></p>)}{canManage ? <div className="crm-governance-actions"><button type="button" onClick={() => void setEmailConsent('CONSENTED')}>Consent</button><button type="button" onClick={() => void setEmailConsent('LEGITIMATE_INTEREST')}>Legitimate interest</button><button type="button" onClick={() => void setEmailConsent('OPTED_OUT')}>Opt out</button></div> : null}</> : null}</div><div className="crm-operations__panel"><header><div><p className="eyebrow"><GitMerge size={15} /> Controlled merge</p><h2>Duplicate warnings</h2></div></header>{!selectedContact ? <p>Select a contact first.</p> : duplicates.length === 0 ? <p>No duplicate candidates detected.</p> : duplicates.map((candidate) => <article className="crm-duplicate-row" key={candidate.id}><div><strong>{candidate.fullName}</strong><small>{candidate.email || candidate.phone || 'No channel'} · {candidate.reasons.join(', ')}</small></div>{canManage ? <button type="button" onClick={(event) => void requestContactMerge(candidate, event.currentTarget)}>{language === 'ar' ? 'مراجعة الدمج' : 'Review merge'}</button> : null}</article>)}</div>{canConfigure && communicationPolicy ? <div className="crm-operations__panel"><header><div><p className="eyebrow"><Clock3 size={15} /> Workspace policy</p><h2>Quiet hours and retention</h2></div></header><form className="crm-form-grid" onSubmit={submitCommunicationPolicy}><label><span>Timezone</span><input name="timezone" defaultValue={communicationPolicy.timezone} required /></label><label><span>Quiet start (minute)</span><input name="quietHoursStart" type="number" min="0" max="1439" defaultValue={communicationPolicy.quietHoursStart} /></label><label><span>Quiet end (minute)</span><input name="quietHoursEnd" type="number" min="0" max="1439" defaultValue={communicationPolicy.quietHoursEnd} /></label><label><span>Hourly limit</span><input name="hourlyRateLimit" type="number" min="1" max="1000" defaultValue={communicationPolicy.hourlyRateLimit} /></label><label><span>Retention days</span><input name="retentionDays" type="number" min="30" max="3650" defaultValue={communicationPolicy.retentionDays} /></label><button className="button-link button-link--primary" type="submit">Save policy</button></form></div> : null}</section> : null}
      </main>

      {showAccountForm ? <div className="crm-modal-backdrop"><form className="crm-modal" onSubmit={submitAccount}><header><h2>Create account</h2><button type="button" onClick={() => setShowAccountForm(false)}>×</button></header><div className="crm-form-grid"><label><span>Type</span><select name="type" defaultValue="COMPANY"><option value="INDIVIDUAL">Individual</option><option value="COMPANY">Company</option><option value="DEVELOPER">Developer</option><option value="TRAVEL_AGENCY">Travel agency</option><option value="ACTIVITY_PROVIDER">Activity provider</option><option value="PROPERTY_OWNER">Property owner</option><option value="INVESTOR">Investor</option><option value="VENDOR">Vendor</option></select></label><label><span>Name</span><input name="name" required /></label><label><span>Legal name</span><input name="legalName" /></label><label><span>Registration number</span><input name="registrationNumber" /></label></div><button className="button-link button-link--primary" type="submit">Create account</button></form></div> : null}

      {showPipelineForm ? <div className="crm-modal-backdrop"><form className="crm-modal" onSubmit={submitPipeline}><header><h2>Create configurable pipeline</h2><button type="button" onClick={() => setShowPipelineForm(false)}>×</button></header><div className="crm-form-grid"><label><span>Name</span><input name="name" required /></label><label><span>Description</span><input name="description" /></label><label><span><input name="isDefault" type="checkbox" /> Make default</span></label></div><p>The pipeline starts with configurable Discovery, Qualified, Proposal, Won, and Lost stages.</p><button className="button-link button-link--primary" type="submit">Create pipeline</button></form></div> : null}

      {showDealForm ? <div className="crm-modal-backdrop"><form className="crm-modal" onSubmit={submitDeal}><header><h2>Create deal</h2><button type="button" onClick={() => setShowDealForm(false)}>×</button></header><div className="crm-form-grid"><label><span>Name</span><input name="name" required /></label><label><span>Account</span><select name="accountId" required>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><span>Pipeline</span><select name="pipelineId" defaultValue={defaultPipeline?.id}>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></label><label><span>Stage</span><select name="stageId" defaultValue={defaultPipeline?.stages[0]?.id}>{defaultPipeline?.stages.filter((stage) => stage.type === 'OPEN').map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label><label><span>Expected value</span><input name="expectedValue" type="number" min="0" step="0.001" /></label><label><span>Currency</span><input name="currency" defaultValue="OMR" pattern="[A-Za-z]{3}" /></label></div><button className="button-link button-link--primary" type="submit">Create deal</button></form></div> : null}

      <CrmContactMergeDialog
        busy={contactMergeBusy}
        candidate={pendingContactMerge}
        error={contactMergeError}
        language={language}
        onClose={() => {
          if (contactMergeBusy) return;
          if (contactMergeResult && contactMergePreview) {
            setSuccess(language === 'ar'
              ? `تم دمج ${contactMergePreview.duplicate.fullName} في ${contactMergePreview.primary.fullName}.`
              : `${contactMergePreview.duplicate.fullName} was merged into ${contactMergePreview.primary.fullName}.`);
          }
          setPendingContactMerge(null);
          setContactMergePreview(null);
          setContactMergeResult(null);
          setContactMergeError('');
        }}
        onConfirm={confirmContactMerge}
        open={Boolean(pendingContactMerge)}
        preview={contactMergePreview}
        result={contactMergeResult}
        returnFocusRef={contactMergeTriggerRef}
      />

      <CrmDealStageTransitionDialog
        busy={transitionBusy}
        deal={pendingDealTransition?.deal ?? null}
        error={transitionError}
        language={language}
        onClose={() => {
          if (transitionBusy) return;
          setPendingDealTransition(null);
          setTransitionError('');
        }}
        onConfirm={confirmDealTransition}
        open={Boolean(pendingDealTransition)}
        returnFocusRef={dealTransitionTriggerRef}
        targetStage={pendingDealTransition?.targetStage ?? null}
      />
    </section>
  );
}
