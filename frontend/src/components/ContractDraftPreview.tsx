type ContractDraftPreviewProps = {
  contract: Record<string, unknown>;
};

function text(value: unknown, fallback = '-') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function money(amount: unknown, currency: unknown = 'OMR') {
  const parsed = Number(String(amount ?? ''));

  if (!Number.isFinite(parsed)) return '-';

  return `${text(currency, 'OMR')} ${parsed.toLocaleString(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  })}`;
}

function dateText(value: unknown) {
  if (typeof value !== 'string' || !value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
  }).format(date);
}

function Checklist({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const entries = Object.entries(value as Record<string, unknown>);

  if (!entries.length) return null;

  return (
    <section>
      <h4>Registration checklist</h4>
      <ul className="contract-preview-checklist">
        {entries.map(([key, checked]) => (
          <li key={key}>
            <span>{checked ? '✓' : '○'}</span>
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ContractDraftPreview({ contract }: ContractDraftPreviewProps) {
  return (
    <article className="contract-preview">
      <p className="eyebrow">Rental contract draft</p>
      <h3>{text(contract.title, 'Contract draft')}</h3>
      <p className="trust-note">
        This is a rental contract draft prepared for review. It is not an
        official registered Muscat Municipality contract and may require legal
        and official review before use.
      </p>

      <div className="contract-preview-grid">
        <section>
          <h4>Parties</h4>
          <dl>
            <div>
              <dt>Landlord</dt>
              <dd>{text(contract.landlordName)}</dd>
            </div>
            <div>
              <dt>Landlord contact</dt>
              <dd>
                {text(contract.landlordEmail)}
                {text(contract.landlordPhone, '') ? ` · ${text(contract.landlordPhone)}` : ''}
              </dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>{text(contract.tenantName)}</dd>
            </div>
            <div>
              <dt>Tenant contact</dt>
              <dd>
                {text(contract.tenantEmail)}
                {text(contract.tenantPhone, '') ? ` · ${text(contract.tenantPhone)}` : ''}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Property</h4>
          <dl>
            <div>
              <dt>Property</dt>
              <dd>{text(contract.propertyTitle)}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>{text(contract.propertyAddress)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{text(contract.propertyType)}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{text(contract.propertyNotes)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Financial terms</h4>
          <dl>
            <div>
              <dt>Rent amount</dt>
              <dd>{money(contract.rentAmount, contract.currency)}</dd>
            </div>
            <div>
              <dt>Security deposit</dt>
              <dd>{money(contract.securityDeposit, contract.currency)}</dd>
            </div>
            <div>
              <dt>Payment schedule</dt>
              <dd>{text(contract.paymentSchedule)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Contract period</h4>
          <dl>
            <div>
              <dt>Start date</dt>
              <dd>{dateText(contract.contractStartDate)}</dd>
            </div>
            <div>
              <dt>End date</dt>
              <dd>{dateText(contract.contractEndDate)}</dd>
            </div>
            <div>
              <dt>Notice period</dt>
              <dd>{text(contract.noticePeriod)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Responsibilities</h4>
          <dl>
            <div>
              <dt>Utilities</dt>
              <dd>{text(contract.utilitiesResponsibility)}</dd>
            </div>
            <div>
              <dt>Maintenance</dt>
              <dd>{text(contract.maintenanceTerms)}</dd>
            </div>
            <div>
              <dt>Additional clauses</dt>
              <dd>{text(contract.additionalClauses)}</dd>
            </div>
            <div>
              <dt>Attachment notes</dt>
              <dd>{text(contract.attachmentsNotes)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h4>Registration readiness</h4>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{text(contract.registrationStatus, 'NOT_STARTED')}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{text(contract.registrationReference)}</dd>
            </div>
            <div>
              <dt>Registration notes</dt>
              <dd>{text(contract.registrationNotes)}</dd>
            </div>
            <div>
              <dt>Admin notes</dt>
              <dd>{text(contract.adminRegistrationNotes)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <Checklist value={contract.registrationChecklist} />
    </article>
  );
}
