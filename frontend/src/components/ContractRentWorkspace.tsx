import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import {
  createContractDraft,
  type JsonRecord
} from '../api/contracts';
import {
  createRentDueItem,
  createRentSchedule,
  markRentDueItemPaid
} from '../api/rentPayments';
import ContractDraftPreview from './ContractDraftPreview';

type ContractRentWorkspaceProps = {
  token: string | null;
  contracts: JsonRecord[];
  rentSchedules: JsonRecord[];
};

const contractInitialState = {
  title: 'Rental contract draft',
  landlordName: '',
  landlordEmail: '',
  landlordPhone: '',
  tenantName: '',
  tenantEmail: '',
  tenantPhone: '',
  propertyTitle: '',
  propertyAddress: '',
  propertyType: '',
  propertyNotes: '',
  rentAmount: '',
  currency: 'OMR',
  securityDeposit: '',
  contractStartDate: '',
  contractEndDate: '',
  paymentSchedule: 'Monthly rent payment schedule',
  utilitiesResponsibility: '',
  maintenanceTerms: '',
  noticePeriod: '',
  additionalClauses: '',
  attachmentsNotes: ''
};

const scheduleInitialState = {
  title: 'Rent payment schedule',
  frequency: 'MONTHLY',
  amount: '',
  currency: 'OMR',
  startDate: '',
  endDate: '',
  dueDayOfMonth: '',
  contractDraftId: '',
  notes: ''
};

const dueItemInitialState = {
  dueDate: '',
  periodStart: '',
  periodEnd: '',
  amount: '',
  currency: 'OMR',
  notes: ''
};

const paidInitialState = {
  paidAt: '',
  paymentProvider: 'MANUAL',
  paymentReference: '',
  receiptNumber: '',
  notes: ''
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getValue(record: JsonRecord | null | undefined, key: string) {
  return record?.[key];
}

function getRecords(record: JsonRecord | null | undefined, key: string) {
  const value = getValue(record, key);

  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getText(record: JsonRecord | null | undefined, key: string, fallback = '—') {
  const value = getValue(record, key);

  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return fallback;
}

function getDate(record: JsonRecord | null | undefined, key: string) {
  const raw = getText(record, key, '');

  if (!raw) return '—';

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
  }).format(date);
}

function getMoney(record: JsonRecord | null | undefined, amountKey: string) {
  const amount = Number(getText(record, amountKey, ''));
  const currency = getText(record, 'currency', 'OMR');

  if (!Number.isFinite(amount)) return '—';

  return `${currency} ${amount.toLocaleString(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  })}`;
}

function statusClass(status: string) {
  if (status === 'PAID' || status.includes('REGISTERED') || status.includes('READY')) {
    return 'approved';
  }

  if (status === 'OVERDUE' || status === 'REJECTED' || status === 'NEEDS_CHANGES') {
    return 'rejected';
  }

  return 'pending';
}

function cleanPayload(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value !== '')
  ) as JsonRecord;
}

function getContractTitle(contract: JsonRecord) {
  return getText(contract, 'title', getText(contract, 'propertyTitle', 'Rental contract draft'));
}

function getScheduleTitle(schedule: JsonRecord) {
  return getText(schedule, 'title', 'Rent payment schedule');
}

export default function ContractRentWorkspace({
  token,
  contracts: initialContracts,
  rentSchedules: initialRentSchedules
}: ContractRentWorkspaceProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [rentSchedules, setRentSchedules] = useState(initialRentSchedules);
  const [contractForm, setContractForm] = useState(contractInitialState);
  const [scheduleForm, setScheduleForm] = useState(scheduleInitialState);
  const [dueForms, setDueForms] = useState<Record<string, typeof dueItemInitialState>>({});
  const [paidForms, setPaidForms] = useState<Record<string, typeof paidInitialState>>({});
  const [previewContract, setPreviewContract] = useState<JsonRecord | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState('');
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setContracts(initialContracts);
  }, [initialContracts]);

  useEffect(() => {
    setRentSchedules(initialRentSchedules);
  }, [initialRentSchedules]);

  useEffect(() => {
    if (!pendingPrint || !previewContract) return;

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        window.print();
        setPendingPrint(false);
      });

      return () => window.cancelAnimationFrame(secondFrame);
    });

    return () => window.cancelAnimationFrame(firstFrame);
  }, [pendingPrint, previewContract]);

  const contractOptions = useMemo(
    () =>
      contracts.map((contract) => ({
        id: getText(contract, 'id', ''),
        label: getContractTitle(contract)
      })),
    [contracts]
  );

  function handleContractField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setContractForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleScheduleField(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setScheduleForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleDueField(
    scheduleId: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setDueForms((current) => ({
      ...current,
      [scheduleId]: {
        ...(current[scheduleId] ?? dueItemInitialState),
        [name]: value
      }
    }));
  }

  function handlePaidField(
    dueItemId: string,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setPaidForms((current) => ({
      ...current,
      [dueItemId]: {
        ...(current[dueItemId] ?? paidInitialState),
        [name]: value
      }
    }));
  }

  async function handleCreateContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || saving) return;

    try {
      setSaving('contract');
      setError('');
      setMessage('');

      const response = await createContractDraft(cleanPayload(contractForm), token);

      setContracts((current) => [response.contract, ...current]);
      setPreviewContract(response.contract);
      setContractForm(contractInitialState);
      setMessage('Contract draft created. Review it below before official/legal submission.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not create this contract draft. Check the required fields.');
    } finally {
      setSaving('');
    }
  }

  async function handleCreateSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || saving) return;

    try {
      setSaving('schedule');
      setError('');
      setMessage('');

      const response = await createRentSchedule(cleanPayload(scheduleForm), token);

      setRentSchedules((current) => [response.schedule, ...current]);
      setScheduleForm(scheduleInitialState);
      setActiveScheduleId(getText(response.schedule, 'id', ''));
      setMessage('Rent schedule created. Add due items to track paid, unpaid, due-soon, and overdue payments.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not create this rent schedule. Check amount, dates, and linked contract access.');
    } finally {
      setSaving('');
    }
  }

  async function handleCreateDueItem(scheduleId: string) {
    if (!token || saving) return;

    try {
      setSaving(`due-${scheduleId}`);
      setError('');
      setMessage('');

      const form = dueForms[scheduleId] ?? dueItemInitialState;
      const response = await createRentDueItem(scheduleId, cleanPayload(form), token);

      setRentSchedules((current) =>
        current.map((schedule) => {
          if (getText(schedule, 'id', '') !== scheduleId) return schedule;

          return {
            ...schedule,
            dueItems: [...getRecords(schedule, 'dueItems'), response.dueItem]
          };
        })
      );

      setDueForms((current) => ({
        ...current,
        [scheduleId]: dueItemInitialState
      }));
      setMessage('Rent due item created and linked users were notified.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not add this due item. Check due date and amount.');
    } finally {
      setSaving('');
    }
  }

  async function handleMarkPaid(scheduleId: string, dueItemId: string) {
    if (!token || saving) return;

    try {
      setSaving(`paid-${dueItemId}`);
      setError('');
      setMessage('');

      const form = paidForms[dueItemId] ?? paidInitialState;
      const response = await markRentDueItemPaid(dueItemId, cleanPayload(form), token);

      setRentSchedules((current) =>
        current.map((schedule) => {
          if (getText(schedule, 'id', '') !== scheduleId) return schedule;

          return {
            ...schedule,
            dueItems: getRecords(schedule, 'dueItems').map((dueItem) =>
              getText(dueItem, 'id', '') === dueItemId ? response.dueItem : dueItem
            )
          };
        })
      );

      setPaidForms((current) => ({
        ...current,
        [dueItemId]: paidInitialState
      }));
      setMessage('Rent item marked paid and linked users were notified.');
    } catch (caughtError) {
      console.error(caughtError);
      setError('Could not mark this rent item paid.');
    } finally {
      setSaving('');
    }
  }

  if (!token) return null;

  return (
    <section className="stage8-dashboard-section contract-rent-workspace">
      <div className="details-section-heading">
        <p className="eyebrow">Contracts and rent</p>
        <h3>Drafts, registration readiness, and payment schedules</h3>
        <p>
          Prepare rental contract drafts, track registration readiness, and manage
          rent/deposit schedules. Official registration, legal review, and
          payment-provider activation remain separate approved workflows.
        </p>
      </div>

      {message ? <div className="form-success">{message}</div> : null}
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="contract-rent-grid">
        <form className="stage8-tool-card contract-rent-form" onSubmit={handleCreateContract}>
          <div>
            <p className="eyebrow">8.6 Contract draft</p>
            <h4>Create rental contract draft</h4>
            <p>
              Drafts are for review and print preparation only. They do not claim
              official registration.
            </p>
          </div>

          <label>
            Draft title
            <input name="title" value={contractForm.title} onChange={handleContractField} required />
          </label>

          <div className="form-grid two">
            <label>
              Landlord name
              <input name="landlordName" value={contractForm.landlordName} onChange={handleContractField} required />
            </label>
            <label>
              Tenant name
              <input name="tenantName" value={contractForm.tenantName} onChange={handleContractField} required />
            </label>
            <label>
              Landlord email
              <input name="landlordEmail" type="email" value={contractForm.landlordEmail} onChange={handleContractField} />
            </label>
            <label>
              Tenant email
              <input name="tenantEmail" type="email" value={contractForm.tenantEmail} onChange={handleContractField} />
            </label>
            <label>
              Landlord phone
              <input name="landlordPhone" value={contractForm.landlordPhone} onChange={handleContractField} />
            </label>
            <label>
              Tenant phone
              <input name="tenantPhone" value={contractForm.tenantPhone} onChange={handleContractField} />
            </label>
          </div>

          <label>
            Property title
            <input name="propertyTitle" value={contractForm.propertyTitle} onChange={handleContractField} required />
          </label>

          <label>
            Property address
            <textarea name="propertyAddress" value={contractForm.propertyAddress} onChange={handleContractField} required />
          </label>

          <div className="form-grid three">
            <label>
              Property type
              <input name="propertyType" value={contractForm.propertyType} onChange={handleContractField} />
            </label>
            <label>
              Rent amount
              <input name="rentAmount" type="number" min="0" step="0.001" value={contractForm.rentAmount} onChange={handleContractField} required />
            </label>
            <label>
              Currency
              <input name="currency" value={contractForm.currency} onChange={handleContractField} required />
            </label>
            <label>
              Security deposit
              <input name="securityDeposit" type="number" min="0" step="0.001" value={contractForm.securityDeposit} onChange={handleContractField} />
            </label>
            <label>
              Start date
              <input name="contractStartDate" type="date" value={contractForm.contractStartDate} onChange={handleContractField} />
            </label>
            <label>
              End date
              <input name="contractEndDate" type="date" value={contractForm.contractEndDate} onChange={handleContractField} />
            </label>
          </div>

          <label>
            Payment schedule
            <input name="paymentSchedule" value={contractForm.paymentSchedule} onChange={handleContractField} />
          </label>

          <label>
            Utilities responsibility
            <textarea name="utilitiesResponsibility" value={contractForm.utilitiesResponsibility} onChange={handleContractField} />
          </label>

          <label>
            Maintenance terms
            <textarea name="maintenanceTerms" value={contractForm.maintenanceTerms} onChange={handleContractField} />
          </label>

          <label>
            Notice period
            <input name="noticePeriod" value={contractForm.noticePeriod} onChange={handleContractField} />
          </label>

          <label>
            Additional clauses
            <textarea name="additionalClauses" value={contractForm.additionalClauses} onChange={handleContractField} />
          </label>

          <label>
            Attachment/document notes
            <textarea name="attachmentsNotes" value={contractForm.attachmentsNotes} onChange={handleContractField} />
          </label>

          <button className="button-link button-link--primary" type="submit" disabled={saving === 'contract'}>
            {saving === 'contract' ? 'Creating…' : 'Create contract draft'}
          </button>
        </form>

        <form className="stage8-tool-card contract-rent-form" onSubmit={handleCreateSchedule}>
          <div>
            <p className="eyebrow">8.8 Rent/deposit schedule</p>
            <h4>Create payment schedule</h4>
            <p>
              Track one-time, monthly, quarterly, and yearly rent/deposit
              payments. Hosted payment links remain provider-ready, not automatic.
            </p>
          </div>

          <label>
            Schedule title
            <input name="title" value={scheduleForm.title} onChange={handleScheduleField} required />
          </label>

          <div className="form-grid two">
            <label>
              Frequency
              <select name="frequency" value={scheduleForm.frequency} onChange={handleScheduleField}>
                <option value="ONE_TIME">One-time</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </label>
            <label>
              Amount
              <input name="amount" type="number" min="0" step="0.001" value={scheduleForm.amount} onChange={handleScheduleField} required />
            </label>
            <label>
              Currency
              <input name="currency" value={scheduleForm.currency} onChange={handleScheduleField} required />
            </label>
            <label>
              Start date
              <input name="startDate" type="date" value={scheduleForm.startDate} onChange={handleScheduleField} required />
            </label>
            <label>
              End date
              <input name="endDate" type="date" value={scheduleForm.endDate} onChange={handleScheduleField} />
            </label>
            <label>
              Due day of month
              <input name="dueDayOfMonth" type="number" min="1" max="31" value={scheduleForm.dueDayOfMonth} onChange={handleScheduleField} />
            </label>
          </div>

          <label>
            Linked contract draft
            <select name="contractDraftId" value={scheduleForm.contractDraftId} onChange={handleScheduleField}>
              <option value="">No linked contract</option>
              {contractOptions.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Notes
            <textarea name="notes" value={scheduleForm.notes} onChange={handleScheduleField} />
          </label>

          <button className="button-link button-link--primary" type="submit" disabled={saving === 'schedule'}>
            {saving === 'schedule' ? 'Creating…' : 'Create rent schedule'}
          </button>
        </form>
      </div>

      <div className="contract-rent-grid">
        <section className="stage8-tool-card">
          <div className="details-section-heading">
            <p className="eyebrow">Contract drafts</p>
            <h4>Preview and print</h4>
          </div>

          {contracts.length ? (
            <div className="stage8-dashboard-list compact">
              {contracts.slice(0, 6).map((contract) => {
                const status = getText(contract, 'registrationStatus', 'NOT_STARTED');

                return (
                  <article key={getText(contract, 'id')} className="stage8-dashboard-mini-card">
                    <span className={`status-pill ${statusClass(status)}`}>{status}</span>
                    <strong>{getContractTitle(contract)}</strong>
                    <p>
                      {getText(contract, 'propertyAddress', '—')} · {getMoney(contract, 'rentAmount')}
                    </p>
                    <div className="stage8-card-actions">
                      <button
                        className="button-link button-link--secondary"
                        type="button"
                        onClick={() => setPreviewContract(contract)}
                      >
                        Preview
                      </button>
                      <button
                        className="button-link button-link--ghost"
                        type="button"
                        onClick={() => {
                          setPreviewContract(contract);
                          setPendingPrint(true);
                        }}
                      >
                        Print
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="trust-note">No contract drafts yet.</p>
          )}
        </section>

        <section className="stage8-tool-card">
          <div className="details-section-heading">
            <p className="eyebrow">Rent schedules</p>
            <h4>Due items and paid status</h4>
          </div>

          {rentSchedules.length ? (
            <div className="stage8-dashboard-list compact">
              {rentSchedules.slice(0, 6).map((schedule) => {
                const scheduleId = getText(schedule, 'id', '');
                const dueItems = getRecords(schedule, 'dueItems');
                const dueForm = dueForms[scheduleId] ?? dueItemInitialState;
                const isActive = activeScheduleId === scheduleId;

                return (
                  <article key={scheduleId} className="rent-schedule-manager">
                    <button
                      className="rent-schedule-toggle"
                      type="button"
                      onClick={() => setActiveScheduleId(isActive ? '' : scheduleId)}
                    >
                      <span>
                        <strong>{getScheduleTitle(schedule)}</strong>
                        <small>
                          {getText(schedule, 'frequency', 'MONTHLY')} · {getMoney(schedule, 'amount')}
                        </small>
                      </span>
                      <span>{isActive ? 'Hide' : 'Manage'}</span>
                    </button>

                    {isActive ? (
                      <div className="rent-schedule-detail">
                        <div className="form-grid three">
                          <label>
                            Due date
                            <input name="dueDate" type="date" value={dueForm.dueDate} onChange={(event) => handleDueField(scheduleId, event)} />
                          </label>
                          <label>
                            Amount
                            <input name="amount" type="number" min="0" step="0.001" value={dueForm.amount} onChange={(event) => handleDueField(scheduleId, event)} />
                          </label>
                          <label>
                            Currency
                            <input name="currency" value={dueForm.currency} onChange={(event) => handleDueField(scheduleId, event)} />
                          </label>
                          <label>
                            Period start
                            <input name="periodStart" type="date" value={dueForm.periodStart} onChange={(event) => handleDueField(scheduleId, event)} />
                          </label>
                          <label>
                            Period end
                            <input name="periodEnd" type="date" value={dueForm.periodEnd} onChange={(event) => handleDueField(scheduleId, event)} />
                          </label>
                          <label>
                            Notes
                            <input name="notes" value={dueForm.notes} onChange={(event) => handleDueField(scheduleId, event)} />
                          </label>
                        </div>

                        <button
                          className="button-link button-link--secondary"
                          type="button"
                          disabled={saving === `due-${scheduleId}`}
                          onClick={() => void handleCreateDueItem(scheduleId)}
                        >
                          {saving === `due-${scheduleId}` ? 'Adding…' : 'Add due item'}
                        </button>

                        <div className="rent-due-list">
                          {dueItems.length ? (
                            dueItems.map((dueItem) => {
                              const dueItemId = getText(dueItem, 'id', '');
                              const paidForm = paidForms[dueItemId] ?? paidInitialState;
                              const status = getText(dueItem, 'status', 'PENDING');

                              return (
                                <article key={dueItemId} className="rent-due-row">
                                  <div>
                                    <span className={`status-pill ${statusClass(status)}`}>{status}</span>
                                    <strong>
                                      {getDate(dueItem, 'dueDate')} · {getMoney(dueItem, 'amount')}
                                    </strong>
                                    <p>{getText(dueItem, 'notes', 'No notes')}</p>
                                  </div>

                                  {status !== 'PAID' ? (
                                    <div className="rent-paid-form">
                                      <input
                                        name="receiptNumber"
                                        placeholder="Receipt number"
                                        value={paidForm.receiptNumber}
                                        onChange={(event) => handlePaidField(dueItemId, event)}
                                      />
                                      <input
                                        name="paymentReference"
                                        placeholder="Payment reference"
                                        value={paidForm.paymentReference}
                                        onChange={(event) => handlePaidField(dueItemId, event)}
                                      />
                                      <input
                                        name="paidAt"
                                        type="date"
                                        value={paidForm.paidAt}
                                        onChange={(event) => handlePaidField(dueItemId, event)}
                                      />
                                      <button
                                        className="button-link button-link--primary"
                                        type="button"
                                        disabled={saving === `paid-${dueItemId}`}
                                        onClick={() => void handleMarkPaid(scheduleId, dueItemId)}
                                      >
                                        {saving === `paid-${dueItemId}` ? 'Saving…' : 'Mark paid'}
                                      </button>
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })
                          ) : (
                            <p className="trust-note">No due items yet.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="trust-note">No rent schedules yet.</p>
          )}
        </section>
      </div>

      {previewContract ? (
        <section className="contract-print-area stage8-tool-card">
          <div className="stage8-card-actions no-print">
            <button className="button-link button-link--secondary" type="button" onClick={() => setPendingPrint(true)}>
              Print draft
            </button>
            <button className="button-link button-link--ghost" type="button" onClick={() => setPreviewContract(null)}>
              Close preview
            </button>
          </div>
          <ContractDraftPreview contract={previewContract} />
        </section>
      ) : null}
    </section>
  );
}
