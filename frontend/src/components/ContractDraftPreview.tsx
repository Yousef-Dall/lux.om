type ContractDraftPreviewProps = {
  contract: Record<string, unknown>;
};

function text(value: unknown, fallback = '-') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export default function ContractDraftPreview({ contract }: ContractDraftPreviewProps) {
  return (
    <article className="contract-preview">
      <p className="eyebrow">Rental contract draft</p>
      <h3>{text(contract.title, 'Contract draft')}</h3>
      <p>This is a draft for review. It is not automatically registered as an official rental contract.</p>
      <dl>
        <div><dt>Landlord</dt><dd>{text(contract.landlordName)}</dd></div>
        <div><dt>Tenant</dt><dd>{text(contract.tenantName)}</dd></div>
        <div><dt>Property</dt><dd>{text(contract.propertyTitle)}</dd></div>
        <div><dt>Rent</dt><dd>{String(contract.rentAmount ?? '-')} {text(contract.currency, 'OMR')}</dd></div>
        <div><dt>Registration</dt><dd>{text(contract.registrationStatus, 'Not started')}</dd></div>
      </dl>
    </article>
  );
}
