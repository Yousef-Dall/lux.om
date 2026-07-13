import { AlertTriangle, ArrowRight, CheckCircle2, GitMerge, Link2, ShieldAlert } from 'lucide-react';
import { type FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CrmContactMergeField,
  CrmContactMergePreview,
  CrmContactMergeResolution,
  CrmContactMergeResult,
  CrmDuplicateCandidate
} from '../../../api/crmAdvanced';
import AccessibleDialog from '../../../components/AccessibleDialog';

const resolvableFields = new Set<CrmContactMergeField>(['fullName', 'email', 'phone', 'notes', 'accountId']);

type Props = {
  busy: boolean;
  candidate: CrmDuplicateCandidate | null;
  error: string;
  language: 'en' | 'ar';
  onClose: () => void;
  onConfirm: (resolutions: CrmContactMergeResolution) => Promise<void> | void;
  open: boolean;
  preview: CrmContactMergePreview | null;
  result: CrmContactMergeResult | null;
  returnFocusRef: RefObject<HTMLElement | null>;
};

type MergeStep = 'review' | 'confirm';

type ResolutionChoice = Record<string, 'primary' | 'duplicate'>;

const fieldLabels: Record<CrmContactMergeField, { en: string; ar: string }> = {
  fullName: { en: 'Full name', ar: 'الاسم الكامل' },
  email: { en: 'Email', ar: 'البريد الإلكتروني' },
  phone: { en: 'Phone', ar: 'الهاتف' },
  notes: { en: 'Notes', ar: 'الملاحظات' },
  accountId: { en: 'Account', ar: 'الحساب' },
  userId: { en: 'Registered user', ar: 'المستخدم المسجل' },
  pmsTenantId: { en: 'PMS tenant', ar: 'مستأجر نظام إدارة العقارات' }
};

function displayValue(value: unknown, empty: string) {
  if (value === null || value === undefined || value === '') return empty;
  return String(value);
}

export default function CrmContactMergeDialog({
  busy,
  candidate,
  error,
  language,
  onClose,
  onConfirm,
  open,
  preview,
  result,
  returnFocusRef
}: Props) {
  const copy = language === 'ar'
    ? {
        title: 'مراجعة دمج جهة الاتصال',
        description: 'راجع الهويات والتعارضات والسجلات المرتبطة قبل تنفيذ هذا الإجراء غير القابل للتراجع.',
        close: 'إغلاق مراجعة الدمج',
        loading: 'جارٍ تحميل معاينة الدمج الآمنة…',
        primary: 'جهة الاتصال الأساسية',
        duplicate: 'جهة الاتصال المكررة',
        identities: 'الهويات',
        noIdentities: 'لا توجد هويات نشطة.',
        conflicts: 'الحقول المتعارضة',
        noConflicts: 'لا توجد تعارضات في الحقول المدعومة.',
        choose: 'اختر القيمة التي ستبقى',
        keepPrimary: 'الاحتفاظ بقيمة الأساسية',
        keepDuplicate: 'استخدام قيمة المكررة',
        linked: 'السجلات التي ستُنقل إلى جهة الاتصال الأساسية',
        leads: 'العملاء المحتملون',
        deals: 'الصفقات',
        activities: 'الأنشطة والمهام',
        sources: 'سجلات المصدر',
        deliveries: 'محاولات التسليم',
        linkedReferences: 'مراجع مرتبطة',
        account: 'الحساب',
        user: 'المستخدم',
        tenant: 'مستأجر PMS',
        none: 'لا يوجد',
        blockedTitle: 'تعارضات تتطلب معالجة خلفية',
        blockedBody: 'لا يمكن للواجهة الحالية حل هذه الحقول بأمان. لن يتم السماح بالدمج حتى تتم معالجة التعارضات.',
        irreversible: 'سيتم أرشفة جهة الاتصال المكررة وإعادة ربط سجلاتها. لا يمكن التراجع عن هذا الإجراء من الواجهة.',
        continue: 'المتابعة إلى التأكيد',
        back: 'العودة للمراجعة',
        confirmTitle: 'تأكيد الدمج غير القابل للتراجع',
        confirmBody: 'تحقق مرة أخيرة من جهة الاتصال الأساسية والمكررة قبل التنفيذ.',
        acknowledgement: 'أفهم أن هذا الدمج غير قابل للتراجع وأن السجلات المرتبطة ستُنقل إلى جهة الاتصال الأساسية.',
        confirm: 'تنفيذ الدمج',
        merging: 'جارٍ الدمج…',
        completed: 'اكتمل دمج جهة الاتصال',
        completedBody: 'تم حفظ سجل تدقيق للدمج وإعادة ربط السجلات المدعومة.',
        audit: 'مرجع تدقيق الدمج',
        mergedAt: 'وقت الدمج',
        done: 'تم',
        empty: 'غير محدد'
      }
    : {
        title: 'Review contact merge',
        description: 'Review identities, conflicts, and linked records before committing this irreversible action.',
        close: 'Close merge review',
        loading: 'Loading the governed merge preview…',
        primary: 'Primary contact',
        duplicate: 'Duplicate contact',
        identities: 'Identities',
        noIdentities: 'No active identities.',
        conflicts: 'Conflicting fields',
        noConflicts: 'No supported field conflicts were detected.',
        choose: 'Choose the value that will remain',
        keepPrimary: 'Keep primary value',
        keepDuplicate: 'Use duplicate value',
        linked: 'Records that will be relinked to the primary contact',
        leads: 'Leads',
        deals: 'Deals',
        activities: 'Activities and tasks',
        sources: 'Source records',
        deliveries: 'Delivery attempts',
        linkedReferences: 'Linked references',
        account: 'Account',
        user: 'Registered user',
        tenant: 'PMS tenant',
        none: 'None',
        blockedTitle: 'Conflicts requiring backend resolution',
        blockedBody: 'The current API cannot safely resolve these fields. Commit remains blocked until the conflicts are handled.',
        irreversible: 'The duplicate contact will be archived and its supported records relinked. This cannot be undone from the UI.',
        continue: 'Continue to confirmation',
        back: 'Back to review',
        confirmTitle: 'Confirm irreversible merge',
        confirmBody: 'Check the primary and duplicate contacts one final time before committing.',
        acknowledgement: 'I understand this merge is irreversible and linked records will move to the primary contact.',
        confirm: 'Commit contact merge',
        merging: 'Merging…',
        completed: 'Contact merge completed',
        completedBody: 'The supported records were relinked and a merge audit record was saved.',
        audit: 'Merge audit reference',
        mergedAt: 'Merged at',
        done: 'Done',
        empty: 'Not set'
      };

  const [step, setStep] = useState<MergeStep>('review');
  const [choices, setChoices] = useState<ResolutionChoice>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep('review');
    setAcknowledged(false);
    setChoices({});
  }, [candidate?.id, open]);

  useEffect(() => {
    if (!open) return;
    const target = result ? doneRef.current : step === 'confirm' ? confirmRef.current : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => target.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, result, step]);

  const unsupportedConflicts = useMemo(
    () => preview?.conflicts.filter((conflict) => !resolvableFields.has(conflict.field)) ?? [],
    [preview]
  );

  const resolutions = useMemo<CrmContactMergeResolution>(() => {
    if (!preview) return {};
    const resolved: CrmContactMergeResolution = {};
    for (const conflict of preview.conflicts) {
      if (!resolvableFields.has(conflict.field)) continue;
      const selected = choices[conflict.field] ?? 'primary';
      const value = selected === 'primary' ? conflict.primary : conflict.duplicate;
      if (conflict.field === 'fullName') resolved.fullName = value;
      if (conflict.field === 'email') resolved.email = value || null;
      if (conflict.field === 'phone') resolved.phone = value || null;
      if (conflict.field === 'notes') resolved.notes = value || null;
      if (conflict.field === 'accountId') resolved.accountId = value || null;
    }
    return resolved;
  }, [choices, preview]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged || busy || unsupportedConflicts.length > 0) return;
    void onConfirm(resolutions);
  }

  const title = result ? copy.completed : copy.title;
  const description = result ? copy.completedBody : copy.description;

  return (
    <AccessibleDialog
      closeLabel={copy.close}
      description={description}
      initialFocusRef={continueRef}
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      size="large"
      title={title}
    >
      {result ? (
        <section className="crm-contact-merge__complete" aria-live="polite">
          <CheckCircle2 aria-hidden="true" size={40} />
          <div>
            <h3>{copy.completed}</h3>
            <p>{copy.completedBody}</p>
          </div>
          <dl>
            <div><dt>{copy.audit}</dt><dd><code>{result.merge.id}</code></dd></div>
            <div><dt>{copy.mergedAt}</dt><dd>{result.merge.mergedAt ? new Date(result.merge.mergedAt).toLocaleString(language === 'ar' ? 'ar-OM' : 'en-OM') : copy.empty}</dd></div>
          </dl>
          <button className="button-link button-link--primary" onClick={onClose} ref={doneRef} type="button">{copy.done}</button>
        </section>
      ) : !preview ? (
        <div className="crm-contact-merge__loading" role="status">
          <GitMerge className={error ? undefined : 'spin'} aria-hidden="true" />
          <p>{error || copy.loading}</p>
          {error ? <button className="button-link button-link--ghost" onClick={onClose} type="button">{copy.close}</button> : null}
        </div>
      ) : step === 'review' ? (
        <div className="crm-contact-merge">
          <div className="crm-contact-merge__parties" aria-label={copy.identities}>
            {[{ label: copy.primary, party: preview.primary }, { label: copy.duplicate, party: preview.duplicate }].map(({ label, party }) => (
              <article key={party.id}>
                <span>{label}</span>
                <h3>{party.fullName}</h3>
                <p>{party.email || copy.empty}</p>
                <p>{party.phone || copy.empty}</p>
                <h4>{copy.identities}</h4>
                {party.identities.length === 0 ? <small>{copy.noIdentities}</small> : party.identities.map((identity) => (
                  <small key={identity.id}>{identity.type}: <code>{identity.normalizedValue}</code></small>
                ))}
              </article>
            ))}
          </div>

          <section className="crm-contact-merge__section" aria-labelledby="crm-merge-conflicts">
            <header><div><AlertTriangle aria-hidden="true" /><h3 id="crm-merge-conflicts">{copy.conflicts}</h3></div><span>{preview.conflicts.length}</span></header>
            {preview.conflicts.length === 0 ? <p>{copy.noConflicts}</p> : preview.conflicts.map((conflict) => {
              const supported = resolvableFields.has(conflict.field);
              const selected = choices[conflict.field] ?? 'primary';
              return (
                <fieldset className="crm-contact-merge__conflict" disabled={!supported} key={conflict.field}>
                  <legend>{fieldLabels[conflict.field][language]}</legend>
                  <p>{supported ? copy.choose : copy.blockedBody}</p>
                  <label className={selected === 'primary' ? 'is-selected' : ''}>
                    <input
                      checked={selected === 'primary'}
                      name={`merge-${conflict.field}`}
                      onChange={() => setChoices((current) => ({ ...current, [conflict.field]: 'primary' }))}
                      type="radio"
                      value="primary"
                    />
                    <span><strong>{copy.keepPrimary}</strong><small>{displayValue(conflict.primary, copy.empty)}</small></span>
                  </label>
                  <label className={selected === 'duplicate' ? 'is-selected' : ''}>
                    <input
                      checked={selected === 'duplicate'}
                      name={`merge-${conflict.field}`}
                      onChange={() => setChoices((current) => ({ ...current, [conflict.field]: 'duplicate' }))}
                      type="radio"
                      value="duplicate"
                    />
                    <span><strong>{copy.keepDuplicate}</strong><small>{displayValue(conflict.duplicate, copy.empty)}</small></span>
                  </label>
                </fieldset>
              );
            })}
          </section>

          <section className="crm-contact-merge__section" aria-labelledby="crm-merge-links">
            <header><div><Link2 aria-hidden="true" /><h3 id="crm-merge-links">{copy.linked}</h3></div></header>
            <dl className="crm-contact-merge__counts">
              <div><dt>{copy.leads}</dt><dd>{preview.movedLinks.leads}</dd></div>
              <div><dt>{copy.deals}</dt><dd>{preview.movedLinks.primaryDeals}</dd></div>
              <div><dt>{copy.activities}</dt><dd>{preview.movedLinks.activities}</dd></div>
              <div><dt>{copy.sources}</dt><dd>{preview.movedLinks.sourceEvents}</dd></div>
              <div><dt>{copy.deliveries}</dt><dd>{preview.movedLinks.deliveryAttempts}</dd></div>
            </dl>
            <h4>{copy.linkedReferences}</h4>
            <dl className="crm-contact-merge__references">
              <div><dt>{copy.account}</dt><dd>{preview.duplicate.accountId || copy.none}</dd></div>
              <div><dt>{copy.user}</dt><dd>{preview.duplicate.userId || copy.none}</dd></div>
              <div><dt>{copy.tenant}</dt><dd>{preview.duplicate.pmsTenantId || copy.none}</dd></div>
            </dl>
          </section>

          {unsupportedConflicts.length > 0 ? (
            <div className="crm-contact-merge__blocked" role="alert">
              <ShieldAlert aria-hidden="true" />
              <div><strong>{copy.blockedTitle}</strong><p>{copy.blockedBody}</p><small>{unsupportedConflicts.map((conflict) => fieldLabels[conflict.field][language]).join(', ')}</small></div>
            </div>
          ) : null}

          <div className="crm-contact-merge__warning"><AlertTriangle aria-hidden="true" /><p>{copy.irreversible}</p></div>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="crm-contact-merge__actions">
            <button className="button-link button-link--ghost" onClick={onClose} type="button">{copy.close}</button>
            <button
              className="button-link button-link--primary"
              disabled={unsupportedConflicts.length > 0}
              onClick={() => setStep('confirm')}
              ref={continueRef}
              type="button"
            >
              {copy.continue}<ArrowRight aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
      ) : (
        <form className="crm-contact-merge crm-contact-merge--confirm" onSubmit={submit}>
          <div className="crm-contact-merge__warning crm-contact-merge__warning--strong"><ShieldAlert aria-hidden="true" /><div><h3>{copy.confirmTitle}</h3><p>{copy.confirmBody}</p></div></div>
          <dl className="crm-contact-merge__confirm-summary">
            <div><dt>{copy.primary}</dt><dd>{preview.primary.fullName}</dd></div>
            <div><dt>{copy.duplicate}</dt><dd>{preview.duplicate.fullName}</dd></div>
            <div><dt>{copy.linked}</dt><dd>{Object.values(preview.movedLinks).reduce((total, count) => total + count, 0)}</dd></div>
          </dl>
          <label className="crm-contact-merge__acknowledgement">
            <input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
            <span>{copy.acknowledgement}</span>
          </label>
          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="crm-contact-merge__actions">
            <button className="button-link button-link--ghost" disabled={busy} onClick={() => setStep('review')} type="button">{copy.back}</button>
            <button className="button-link button-link--primary" disabled={!acknowledged || busy} ref={confirmRef} type="submit">{busy ? copy.merging : copy.confirm}</button>
          </div>
        </form>
      )}
    </AccessibleDialog>
  );
}
