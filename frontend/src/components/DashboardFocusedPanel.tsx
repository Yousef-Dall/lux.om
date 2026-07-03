import type { LucideIcon } from 'lucide-react';

export type DashboardFocusedPanelMetric = {
  label: string;
  value: string | number;
  helper?: string;
  icon?: LucideIcon;
};

export type DashboardFocusedPanelConfig = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  sectionId: string;
  actionLabel: string;
  metrics: DashboardFocusedPanelMetric[];
};

type DashboardFocusedPanelProps = {
  panel: DashboardFocusedPanelConfig;
  onAction: () => void;
};

export default function DashboardFocusedPanel({ panel, onAction }: DashboardFocusedPanelProps) {
  return (
    <section className="dashboard-focused-panel" aria-labelledby={`dashboard-focused-${panel.id}`}>
      <div className="dashboard-focused-panel__content">
        <p className="eyebrow">{panel.eyebrow}</p>
        <h2 id={`dashboard-focused-${panel.id}`}>{panel.title}</h2>
        <p>{panel.description}</p>
      </div>

      <div className="dashboard-focused-panel__metrics" aria-label={panel.title}>
        {panel.metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <article className="dashboard-focused-panel__metric" key={metric.label}>
              <span>
                {Icon ? <Icon size={15} aria-hidden="true" /> : null}
                {metric.label}
              </span>
              <strong>{metric.value}</strong>
              {metric.helper ? <small>{metric.helper}</small> : null}
            </article>
          );
        })}
      </div>

      <button className="button-link button-link--primary" type="button" onClick={onAction}>
        {panel.actionLabel}
      </button>
    </section>
  );
}
