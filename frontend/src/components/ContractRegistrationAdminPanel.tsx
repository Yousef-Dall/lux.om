import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  getAdminContractDrafts,
  updateAdminContractRegistration,
  type JsonRecord
} from '../api/contracts';

const registrationStatuses = [
  'NOT_STARTED',
  'PREPARED_FOR_REGISTRATION',
  'DRAFT_READY_FOR_SUBMISSION',
  'SUBMITTED_EXTERNALLY',
  'REGISTERED_EXTERNALLY',
  'REJECTED',
  'NEEDS_CHANGES'
];

const checklistLabels = {
  partiesConfirmed: 'Landlord and tenant details confirmed',
  propertyDetailsConfirmed: 'Property details confirmed',
  rentTermsConfirmed: 'Rent and deposit terms confirmed',
  documentsAttached: 'Required documents attached/referenced',
  draftReviewed: 'Draft reviewed before submission'
};

type ChecklistKey = keyof typeof checklistLabels;

const emptyChecklist = {
  partiesConfirmed: false,
  propertyDetailsConfirmed: false,
  rentTermsConfirmed: false,
  documentsAttached: false,
  draftReviewed: false
};

const initialForm = {
  registrationStatus: 'NOT_STARTED',
  registrationReference: '',
  registrationDocumentUrl: '',
  registrationNotes: '',
  adminRegistrationNotes: ''
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getText(record: JsonRecord | null | undefined, key: string, fallback = '—') {
  const value = record?.[key];

  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return fallback;
}

function getChecklist(value: unknown) {
  if (!isRecord(value)) return emptyChecklist;

  return {
    partiesConfirmed: value.partiesConfirmed === true,
    propertyDetailsConfirmed: value.propertyDetailsConfirmed === true,
    rentTermsConfirmed: value.rentTermsConfirmed === true,
    documentsAttached: value.documentsAttached === true,
    draftReviewed: value.draftReviewed === true
  };
}

function cleanPayload(values: Record<string, string>, checklist: typeof emptyChecklist) {
  return {
    registrationStatus: values.registrationStatus,
    registrationReference: values.registrationReference.trim() || null,
    registrationDocumentUrl: values.registrationDocumentUrl.trim() || null,
    registrationNotes: values.registrationNotes.trim() || null,
    adminRegistrationNotes: values.adminRegistrationNotes.trim() || null,
    registrationChecklist: checklist
  };
}

export default function ContractRegistrationAdminPanel({ token }: { token: string | null }) {
  const [contracts, setContracts] = useState<JsonRecord[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(initialForm);
  const [checklist, setChecklist] = useState(emptyChecklist);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;

    let active = true;

    async function loadContracts() {
      try {
        setError('');
        const response = await getAdminContractDrafts(token!);

        if (!active) return;

        setContracts(response.contracts ?? []);
      } catch (caughtError) {
        console.error(caughtError);

        if (active) setError('Could not load contract registration queue.');
      } finally {
        if (active) setLoaded(true);
      }
    }

    void loadContracts();

    return () => {
      active = false;
    };
  }, [token]);

  const selectedContract = useMemo(
    () => contracts.find((contract) => getText(contract, 'id', '') === selectedId) ?? null,
    [contracts, selectedId]
  );

  useEffect(() => {
    if (!selectedContract) return;

    setForm({
      registrationStatus: getText(selectedContract, 'registrationStatus', 'NOT_STARTED'),
      registrationReference: getText(selectedContract, 'registrationReference', ''),
      registrationDocumentUrl: getText(selectedContract, 'registrationDocumentUrl', ''),
      registrationNotes: getText(selectedContract, 'registrationNotes', ''),
      adminRegistrationNotes: getText(selectedContract, 'adminRegistrationNotes', '')
    });
    setChecklist(getChecklist(selectedContract.registrationChecklist));
  }, [selectedContract]);

  function handleFormField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleChecklistField(key: ChecklistKey) {
    setChecklist((current) => ({
      ...current,
      [key]: !current[key]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedId || saving) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const response = await updateAdminContractRegistration(
        selectedId,
        cleanPayload(form, checklist),
        token
      );

      setContracts((current) =>
        current.map((contract) =>
          getText(contract, 'id', '') === selectedId
            ? {
                ...contract,
                ...response.contract,
                registrationReference: form.registrationReference,
                registrationDocumentUrl: form.registrationDocumentUrl,
                registrationNotes: form.registrationNotes,
                adminRegistrationNotes: form.adminRegistrationNotes,
                registrationChecklist: checklist
              }
            : contract
        )
      );
      setMessage('Contract registration status updated and linked users were notified.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not update this contract registration status.');
    } finally {
      setSaving(false);
    }
  }

  if (!token || !loaded) return null;

  return (
    <div className="stage8-operations-queue contract-registration-admin">
      <div className="details-section-heading">
        <p className="eyebrow">8.7 Registration-ready layer</p>
        <h3>Contract registration monitor</h3>
        <p>
          Track drafts prepared for official registration. This does not submit
          contracts to any government system automatically.
        </p>
      </div>

      {message ? <div className="form-success">{message}</div> : null}
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      {contracts.length ? (
        <div className="contract-registration-grid">
          <div className="stage8-operations-list">
            {contracts.slice(0, 8).map((contract) => {
              const contractId = getText(contract, 'id', '');
              const status = getText(contract, 'registrationStatus', 'NOT_STARTED');

              return (
                <button
                  key={contractId}
                  type="button"
                  className={`contract-registration-row ${selectedId === contractId ? 'active' : ''}`}
                  onClick={() => setSelectedId(contractId)}
                >
                  <strong>{getText(contract, 'title', getText(contract, 'propertyTitle', 'Contract draft'))}</strong>
                  <span>{status}</span>
                  <small>{getText(contract, 'propertyAddress', 'No address')}</small>
                </button>
              );
            })}
          </div>

          {selectedContract ? (
            <form className="stage8-tool-card contract-rent-form" onSubmit={handleSubmit}>
              <h4>{getText(selectedContract, 'title', 'Contract registration')}</h4>

              <label>
                Registration status
                <select name="registrationStatus" value={form.registrationStatus} onChange={handleFormField}>
                  {registrationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, ' ').toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Registration reference
                <input name="registrationReference" value={form.registrationReference} onChange={handleFormField} />
              </label>

              <label>
                Registration document URL
                <input name="registrationDocumentUrl" value={form.registrationDocumentUrl} onChange={handleFormField} />
              </label>

              <div className="registration-checklist">
                {Object.entries(checklistLabels).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={checklist[key as ChecklistKey]}
                      onChange={() => handleChecklistField(key as ChecklistKey)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <label>
                Registration notes
                <textarea name="registrationNotes" value={form.registrationNotes} onChange={handleFormField} />
              </label>

              <label>
                Admin notes
                <textarea name="adminRegistrationNotes" value={form.adminRegistrationNotes} onChange={handleFormField} />
              </label>

              <button className="button-link button-link--primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Update registration status'}
              </button>
            </form>
          ) : (
            <p className="trust-note">Select a contract draft to review registration readiness.</p>
          )}
        </div>
      ) : (
        <p className="trust-note">No contract drafts are available for registration monitoring.</p>
      )}
    </div>
  );
}
