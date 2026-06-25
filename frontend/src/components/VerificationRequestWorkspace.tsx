import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import { submitVerification } from '../api/verification';
import type { Activity, Listing } from '../types';

type VerificationRequestWorkspaceProps = {
  token: string | null;
  listings: Listing[];
  activities: Activity[];
  language: 'en' | 'ar';
};

const emptyChecklist = {
  ownerIdentityDocument: false,
  ownershipOrAuthorizationDocument: false,
  propertyOrProviderDocuments: false,
  contactDetailsConfirmed: false
};

const initialForm = {
  targetType: 'LISTING',
  targetId: '',
  submittedDocumentUrls: '',
  notes: ''
};

function getItemTitle(item: Listing | Activity) {
  return item.title || 'Marketplace item';
}

export default function VerificationRequestWorkspace({
  token,
  listings,
  activities,
  language
}: VerificationRequestWorkspaceProps) {
  const [form, setForm] = useState(initialForm);
  const [checklist, setChecklist] = useState(emptyChecklist);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const targetOptions = useMemo(() => {
    const source = form.targetType === 'LISTING' ? listings : activities;

    return source.map((item) => ({
      id: item.id,
      label: getItemTitle(item)
    }));
  }, [activities, form.targetType, listings]);

  function handleField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'targetType' ? { targetId: '' } : {})
    }));
  }

  function handleChecklist(key: keyof typeof emptyChecklist) {
    setChecklist((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || saving) return;

    try {
      setSaving(true);
      setMessage('');
      setError('');

      const submittedDocumentUrls = form.submittedDocumentUrls
        .split(/\n|,/)
        .map((value) => value.trim())
        .filter(Boolean);

      await submitVerification(
        {
          targetType: form.targetType,
          targetId: form.targetId,
          source: 'OWNER_DOCUMENT_SUBMISSION',
          submittedDocumentUrls,
          notes: form.notes.trim() || undefined,
          documentChecklist: checklist
        },
        token
      );

      setForm(initialForm);
      setChecklist(emptyChecklist);
      setMessage(
        language === 'ar'
          ? 'تم إرسال طلب التحقق للمراجعة الإدارية.'
          : 'Verification request submitted for admin review.'
      );
    } catch (caughtError) {
      console.error(caughtError);
      setError(
        language === 'ar'
          ? 'تعذر إرسال طلب التحقق. تأكد من اختيار عنصر وروابط مستندات صحيحة.'
          : 'Could not submit verification. Select an item and use valid document URLs.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!token) return null;

  return (
    <section className="stage8-dashboard-section verification-request-workspace">
      <div className="details-section-heading">
        <p className="eyebrow">8.12 Verification</p>
        <h3>{language === 'ar' ? 'طلب تحقق للمراجعة' : 'Submit verification for review'}</h3>
        <p>
          {language === 'ar'
            ? 'أرسل مستندات داعمة للمراجعة الداخلية. هذا لا يعني تحققاً حكومياً أو بلدياً تلقائياً.'
            : 'Submit supporting documents for internal review. This does not claim government or municipality verification.'}
        </p>
      </div>

      {message ? <div className="form-success">{message}</div> : null}
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <form className="stage8-tool-card contract-rent-form" onSubmit={handleSubmit}>
        <div className="form-grid two">
          <label>
            {language === 'ar' ? 'نوع العنصر' : 'Target type'}
            <select name="targetType" value={form.targetType} onChange={handleField}>
              <option value="LISTING">{language === 'ar' ? 'عقار' : 'Listing'}</option>
              <option value="ACTIVITY">{language === 'ar' ? 'نشاط' : 'Activity'}</option>
            </select>
          </label>

          <label>
            {language === 'ar' ? 'العنصر' : 'Item'}
            <select name="targetId" value={form.targetId} onChange={handleField} required>
              <option value="">
                {language === 'ar' ? 'اختر عنصراً' : 'Select an item'}
              </option>
              {targetOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="registration-checklist">
          {Object.entries({
            ownerIdentityDocument:
              language === 'ar' ? 'إثبات هوية المالك / المزود' : 'Owner/provider identity document',
            ownershipOrAuthorizationDocument:
              language === 'ar' ? 'إثبات ملكية أو تفويض' : 'Ownership or authorization document',
            propertyOrProviderDocuments:
              language === 'ar' ? 'مستندات العقار أو المزود' : 'Property or provider documents',
            contactDetailsConfirmed:
              language === 'ar' ? 'تأكيد بيانات التواصل' : 'Contact details confirmed'
          }).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={checklist[key as keyof typeof emptyChecklist]}
                onChange={() => handleChecklist(key as keyof typeof emptyChecklist)}
              />
              {label}
            </label>
          ))}
        </div>

        <label>
          {language === 'ar' ? 'روابط المستندات' : 'Document URLs'}
          <textarea
            name="submittedDocumentUrls"
            value={form.submittedDocumentUrls}
            onChange={handleField}
            placeholder="https://..."
          />
        </label>

        <label>
          {language === 'ar' ? 'ملاحظات' : 'Notes'}
          <textarea name="notes" value={form.notes} onChange={handleField} />
        </label>

        <button className="button-link button-link--primary" type="submit" disabled={saving}>
          {saving
            ? language === 'ar'
              ? 'جاري الإرسال…'
              : 'Submitting…'
            : language === 'ar'
              ? 'إرسال للمراجعة'
              : 'Submit for review'}
        </button>
      </form>
    </section>
  );
}
