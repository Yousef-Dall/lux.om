import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import {
  createTrustReport,
  type ReportReason,
  type ReportTargetType
} from '../api/reports';
import { useLanguage } from '../i18n/LanguageContext';

type ReportModalProps = {
  targetType: ReportTargetType;
  targetId: string;
  targetTitle?: string;
  token?: string | null;
  triggerLabel?: string;
};

const reportReasons: Array<{
  value: ReportReason;
  labelEn: string;
  labelAr: string;
}> = [
  {
    value: 'MISLEADING_INFO',
    labelEn: 'Misleading or inaccurate information',
    labelAr: 'معلومات مضللة أو غير دقيقة'
  },
  {
    value: 'SUSPECTED_FRAUD',
    labelEn: 'Suspected fraud or unsafe request',
    labelAr: 'اشتباه احتيال أو طلب غير آمن'
  },
  {
    value: 'DUPLICATE',
    labelEn: 'Duplicate listing or activity',
    labelAr: 'إعلان أو نشاط مكرر'
  },
  {
    value: 'INAPPROPRIATE_CONTENT',
    labelEn: 'Inappropriate content',
    labelAr: 'محتوى غير مناسب'
  },
  {
    value: 'WRONG_PRICE',
    labelEn: 'Wrong or unclear price',
    labelAr: 'سعر غير صحيح أو غير واضح'
  },
  {
    value: 'UNAVAILABLE',
    labelEn: 'No longer available',
    labelAr: 'لم يعد متاحاً'
  },
  {
    value: 'SAFETY_CONCERN',
    labelEn: 'Safety or trust concern',
    labelAr: 'مشكلة تتعلق بالسلامة أو الثقة'
  },
  {
    value: 'OTHER',
    labelEn: 'Other',
    labelAr: 'سبب آخر'
  }
];

export default function ReportModal({
  targetType,
  targetId,
  targetTitle,
  token,
  triggerLabel
}: ReportModalProps) {
  const { language } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('MISLEADING_INFO');
  const [message, setMessage] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const copy = useMemo(
    () =>
      language === 'ar'
        ? {
            trigger: triggerLabel || 'الإبلاغ',
            title: 'الإبلاغ للمراجعة',
            intro:
              'سيراجع فريق lux.om البلاغ يدوياً. لا تشارك بيانات حساسة مثل أرقام البطاقات أو الوثائق الرسمية داخل الرسالة.',
            target: 'العنصر',
            reason: 'سبب البلاغ',
            message: 'تفاصيل إضافية',
            messagePlaceholder:
              'اكتب ما الذي يحتاج إلى مراجعة. مثال: السعر غير واضح أو المعلومات تبدو غير دقيقة.',
            name: 'الاسم اختياري',
            email: 'البريد الإلكتروني اختياري',
            phone: 'رقم الهاتف اختياري',
            cancel: 'إلغاء',
            submit: 'إرسال البلاغ',
            submitting: 'جاري الإرسال...',
            success:
              'تم إرسال البلاغ. سيقوم فريق lux.om بمراجعته ضمن إجراءات الثقة والسلامة.',
            error: 'تعذر إرسال البلاغ حالياً. حاول مرة أخرى.'
          }
        : {
            trigger: triggerLabel || 'Report',
            title: 'Report for review',
            intro:
              'lux.om will review this report manually. Do not include sensitive information such as card numbers or official document numbers in the message.',
            target: 'Target',
            reason: 'Report reason',
            message: 'Additional details',
            messagePlaceholder:
              'Tell us what needs review. For example: the price is unclear or the information looks inaccurate.',
            name: 'Name optional',
            email: 'Email optional',
            phone: 'Phone optional',
            cancel: 'Cancel',
            submit: 'Submit report',
            submitting: 'Submitting...',
            success:
              'Report submitted. The lux.om team will review it through the trust and safety process.',
            error: 'Could not submit this report right now. Please try again.'
          },
    [language, triggerLabel]
  );

  function closeModal() {
    if (submitting) return;

    setIsOpen(false);
    setSubmitError('');
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        setIsOpen(false);
        setSubmitError('');
        window.setTimeout(() => triggerRef.current?.focus(), 0);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, submitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!targetId || submitting) return;

    try {
      setSubmitting(true);
      setSubmitError('');

      await createTrustReport(
        {
          targetType,
          targetId,
          reason,
          message: message.trim() || undefined,
          reporterName: reporterName.trim() || undefined,
          reporterEmail: reporterEmail.trim() || undefined,
          reporterPhone: reporterPhone.trim() || undefined
        },
        token
      );

      setSubmitted(true);
      setMessage('');
      setReporterName('');
      setReporterEmail('');
      setReporterPhone('');
    } catch (error) {
      console.error(error);
      setSubmitError(copy.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="button-link button-link--secondary"
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen(true);
          setSubmitted(false);
          setSubmitError('');
        }}
      >
        {copy.trigger}
      </button>

      {isOpen ? (
        <div
          className="report-modal__backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
          role="presentation"
        >
          <div
            aria-labelledby="report-modal-title"
            aria-modal="true"
            className="report-modal"
            role="dialog"
          >
            <div className="report-modal__header">
              <div>
                <p className="eyebrow">lux.om trust & safety</p>
                <h2 id="report-modal-title">{copy.title}</h2>
              </div>

              <button
                aria-label={copy.cancel}
                className="report-modal__close"
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <p className="trust-note">{copy.intro}</p>

            {targetTitle ? (
              <p className="report-modal__target">
                <strong>{copy.target}:</strong> {targetTitle}
              </p>
            ) : null}

            {submitted ? (
              <div className="form-success" role="status">
                {copy.success}
              </div>
            ) : (
              <form className="report-modal__form" onSubmit={handleSubmit}>
                <label>
                  <span>{copy.reason}</span>
                  <select
                    value={reason}
                    onChange={(event) =>
                      setReason(event.target.value as ReportReason)
                    }
                  >
                    {reportReasons.map((item) => (
                      <option key={item.value} value={item.value}>
                        {language === 'ar' ? item.labelAr : item.labelEn}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>{copy.message}</span>
                  <textarea
                    maxLength={3000}
                    placeholder={copy.messagePlaceholder}
                    rows={4}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </label>

                <div className="report-modal__contact-grid">
                  <label>
                    <span>{copy.name}</span>
                    <input
                      maxLength={120}
                      value={reporterName}
                      onChange={(event) => setReporterName(event.target.value)}
                    />
                  </label>

                  <label>
                    <span>{copy.email}</span>
                    <input
                      type="email"
                      value={reporterEmail}
                      onChange={(event) => setReporterEmail(event.target.value)}
                    />
                  </label>

                  <label>
                    <span>{copy.phone}</span>
                    <input
                      maxLength={40}
                      value={reporterPhone}
                      onChange={(event) => setReporterPhone(event.target.value)}
                    />
                  </label>
                </div>

                {submitError ? (
                  <div className="form-error" role="alert">
                    {submitError}
                  </div>
                ) : null}

                <div className="report-modal__actions">
                  <button
                    className="button-link button-link--secondary"
                    type="button"
                    onClick={closeModal}
                  >
                    {copy.cancel}
                  </button>

                  <button
                    className="button-link button-link--primary"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? copy.submitting : copy.submit}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
