type TrustBadgesProps = {
  verificationStatus?: string | null;
  mediaQualityStatus?: string | null;
  buyerEligibility?: string[];
};

function label(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function TrustBadges({ verificationStatus, mediaQualityStatus, buyerEligibility = [] }: TrustBadgesProps) {
  const badges = [
    verificationStatus && verificationStatus !== 'UNVERIFIED' ? label(verificationStatus) : null,
    mediaQualityStatus && mediaQualityStatus !== 'NOT_CHECKED' ? label(mediaQualityStatus) : null,
    ...buyerEligibility.slice(0, 3).map(label)
  ].filter(Boolean);

  if (!badges.length) return null;

  return (
    <div className="trust-badges" aria-label="Trust and eligibility badges">
      {badges.map((badge) => (
        <span className="trust-badge" key={badge}>{badge}</span>
      ))}
    </div>
  );
}
