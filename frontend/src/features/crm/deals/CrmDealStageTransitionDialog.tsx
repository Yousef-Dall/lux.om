import { AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { type FormEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';

import AccessibleDialog from '../../../components/AccessibleDialog';
import type { CrmDeal, CrmPipelineStage } from '../../../api/crmAdvanced';

export type CrmDealTransitionValues = {
  reason?: string;
  lostReason?: string;
  wonReason?: string;
};

type CrmDealStageTransitionDialogProps = {
  busy: boolean;
  deal: CrmDeal | null;
  error?: string;
  language: 'en' | 'ar';
  onClose: () => void;
  onConfirm: (values: CrmDealTransitionValues) => Promise<void>;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  targetStage: CrmPipelineStage | null;
};

const copy = {
  en: {
    close: 'Close stage transition dialog',
    title: (deal: string, stage: string) => `Move ${deal} to ${stage}`,
    description: 'Review the commercial outcome and record the reason before the stage history is changed.',
    currentStage: 'Current stage',
    targetStage: 'Target stage',
    outcome: 'Outcome',
    transitionNote: 'Transition note',
    transitionNoteHelp: 'Recorded in the immutable stage history. Required when reopening a closed deal.',
    transitionNotePlaceholder: 'Why is this deal moving to the selected stage?',
    lostReason: 'Lost reason',
    lostReasonHelp: 'Required before a deal can be marked lost.',
    wonReason: 'Won reason or commercial outcome',
    wonReasonHelp: 'Optional, but useful for forecast and outcome analysis.',
    reopenTitle: 'This transition reopens the deal',
    reopenBody: 'The closed outcome remains in history, while the active deal returns to an open pipeline stage.',
    invalidTitle: 'Reopen before changing the commercial outcome',
    invalidBody: 'A won deal cannot move directly to lost, and a lost deal cannot move directly to won.',
    lostRequired: 'Enter a lost reason before confirming this transition.',
    reopenReasonRequired: 'Enter a transition note explaining why this deal is being reopened.',
    confirm: 'Confirm stage transition',
    confirming: 'Saving transition…',
    cancel: 'Cancel'
  },
  ar: {
    close: 'إغلاق نافذة تغيير مرحلة الصفقة',
    title: (deal: string, stage: string) => `نقل ${deal} إلى ${stage}`,
    description: 'راجع النتيجة التجارية وسجّل السبب قبل تعديل السجل الدائم لمراحل الصفقة.',
    currentStage: 'المرحلة الحالية',
    targetStage: 'المرحلة الجديدة',
    outcome: 'النتيجة',
    transitionNote: 'ملاحظة الانتقال',
    transitionNoteHelp: 'تُحفظ في سجل المراحل الدائم، وتكون مطلوبة عند إعادة فتح صفقة مغلقة.',
    transitionNotePlaceholder: 'لماذا يتم نقل الصفقة إلى هذه المرحلة؟',
    lostReason: 'سبب الخسارة',
    lostReasonHelp: 'مطلوب قبل اعتبار الصفقة خاسرة.',
    wonReason: 'سبب الفوز أو النتيجة التجارية',
    wonReasonHelp: 'اختياري، لكنه مفيد لتحليل التوقعات والنتائج.',
    reopenTitle: 'هذا الانتقال سيعيد فتح الصفقة',
    reopenBody: 'تبقى النتيجة السابقة محفوظة في السجل، بينما تعود الصفقة النشطة إلى مرحلة مفتوحة.',
    invalidTitle: 'أعد فتح الصفقة قبل تغيير النتيجة التجارية',
    invalidBody: 'لا يمكن نقل صفقة رابحة مباشرة إلى خاسرة، ولا صفقة خاسرة مباشرة إلى رابحة.',
    lostRequired: 'أدخل سبب الخسارة قبل تأكيد الانتقال.',
    reopenReasonRequired: 'أدخل ملاحظة توضّح سبب إعادة فتح الصفقة.',
    confirm: 'تأكيد تغيير المرحلة',
    confirming: 'جارٍ حفظ الانتقال…',
    cancel: 'إلغاء'
  }
} as const;

function stageOutcome(stage: CrmPipelineStage) {
  return stage.type === 'OPEN' ? 'OPEN' : stage.type;
}

export default function CrmDealStageTransitionDialog({
  busy,
  deal,
  error,
  language,
  onClose,
  onConfirm,
  open,
  returnFocusRef,
  targetStage
}: CrmDealStageTransitionDialogProps) {
  const text = copy[language];
  const [reason, setReason] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [wonReason, setWonReason] = useState('');
  const [validationError, setValidationError] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const lostReasonRef = useRef<HTMLTextAreaElement>(null);
  const wonReasonRef = useRef<HTMLTextAreaElement>(null);

  const isReopening = Boolean(deal && targetStage && deal.outcome !== 'OPEN' && targetStage.type === 'OPEN');
  const isInvalidClosedOutcomeChange = Boolean(
    deal
      && targetStage
      && deal.outcome !== 'OPEN'
      && targetStage.type !== 'OPEN'
      && targetStage.type !== deal.outcome
  );

  const initialFocusRef = useMemo(() => {
    if (targetStage?.type === 'LOST') return lostReasonRef;
    if (targetStage?.type === 'WON') return wonReasonRef;
    return reasonRef;
  }, [targetStage?.type]);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setLostReason('');
    setWonReason('');
    setValidationError('');
  }, [deal?.id, open, targetStage?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deal || !targetStage || busy || isInvalidClosedOutcomeChange) return;

    const normalizedReason = reason.trim();
    const normalizedLostReason = lostReason.trim();
    const normalizedWonReason = wonReason.trim();

    if (targetStage.type === 'LOST' && !normalizedLostReason) {
      setValidationError(text.lostRequired);
      lostReasonRef.current?.focus();
      return;
    }

    if (isReopening && !normalizedReason) {
      setValidationError(text.reopenReasonRequired);
      reasonRef.current?.focus();
      return;
    }

    setValidationError('');
    await onConfirm({
      reason: normalizedReason || undefined,
      lostReason: normalizedLostReason || undefined,
      wonReason: normalizedWonReason || undefined
    });
  }

  return (
    <AccessibleDialog
      closeLabel={text.close}
      description={text.description}
      initialFocusRef={initialFocusRef}
      onClose={busy ? () => undefined : onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      title={deal && targetStage ? text.title(deal.name, targetStage.name) : text.currentStage}
    >
      {deal && targetStage ? (
        <form aria-busy={busy} className="crm-deal-transition" onSubmit={submit}>
          {(validationError || error) ? <div className="form-error" role="alert">{validationError || error}</div> : null}

          <div className="crm-deal-transition__summary" aria-label={`${text.currentStage}: ${deal.stage.name}; ${text.targetStage}: ${targetStage.name}`}>
            <article>
              <span>{text.currentStage}</span>
              <strong>{deal.stage.name}</strong>
              <small>{text.outcome}: {deal.outcome}</small>
            </article>
            <ArrowRight aria-hidden="true" size={22} />
            <article>
              <span>{text.targetStage}</span>
              <strong>{targetStage.name}</strong>
              <small>{text.outcome}: {stageOutcome(targetStage)}</small>
            </article>
          </div>

          {isReopening ? (
            <div className="crm-deal-transition__notice" role="note">
              <RotateCcw aria-hidden="true" size={20} />
              <div><strong>{text.reopenTitle}</strong><p>{text.reopenBody}</p></div>
            </div>
          ) : null}

          {isInvalidClosedOutcomeChange ? (
            <div className="crm-deal-transition__notice crm-deal-transition__notice--danger" role="alert">
              <AlertTriangle aria-hidden="true" size={20} />
              <div><strong>{text.invalidTitle}</strong><p>{text.invalidBody}</p></div>
            </div>
          ) : null}

          <label>
            <span>{text.transitionNote}{isReopening ? ' *' : ''}</span>
            <textarea
              aria-describedby="crm-transition-note-help"
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
              placeholder={text.transitionNotePlaceholder}
              ref={reasonRef}
              required={isReopening}
              rows={4}
              value={reason}
            />
            <small id="crm-transition-note-help">{text.transitionNoteHelp}</small>
          </label>

          {targetStage.type === 'LOST' ? (
            <label>
              <span>{text.lostReason} *</span>
              <textarea
                aria-describedby="crm-lost-reason-help"
                maxLength={2000}
                onChange={(event) => setLostReason(event.target.value)}
                ref={lostReasonRef}
                required
                rows={4}
                value={lostReason}
              />
              <small id="crm-lost-reason-help">{text.lostReasonHelp}</small>
            </label>
          ) : null}

          {targetStage.type === 'WON' ? (
            <label>
              <span>{text.wonReason}</span>
              <textarea
                aria-describedby="crm-won-reason-help"
                maxLength={2000}
                onChange={(event) => setWonReason(event.target.value)}
                ref={wonReasonRef}
                rows={4}
                value={wonReason}
              />
              <small id="crm-won-reason-help">{text.wonReasonHelp}</small>
            </label>
          ) : null}

          <div className="crm-deal-transition__actions">
            <button
              className="button-link button-link--primary"
              disabled={busy || isInvalidClosedOutcomeChange}
              type="submit"
            >
              {busy ? text.confirming : text.confirm}
            </button>
            <button disabled={busy} onClick={onClose} type="button">{text.cancel}</button>
          </div>
        </form>
      ) : null}
    </AccessibleDialog>
  );
}
