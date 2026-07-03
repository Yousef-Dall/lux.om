type DashboardSectionHeadingProps = {
  id: string;
  eyebrow: string;
  title?: string;
  description: string;
};

export default function DashboardSectionHeading({
  id,
  eyebrow,
  title = eyebrow,
  description
}: DashboardSectionHeadingProps) {
  return (
    <div className="dashboard-section-heading" id={id} tabIndex={-1}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
