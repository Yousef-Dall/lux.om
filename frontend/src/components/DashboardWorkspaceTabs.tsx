import type { LucideIcon } from 'lucide-react';

export type DashboardWorkspaceTabItem = {
  id: string;
  label: string;
  sectionId: string;
  icon: LucideIcon;
};

type DashboardWorkspaceTabsProps = {
  ariaLabel: string;
  introLabel: string;
  sectionCountLabel: string;
  activeTabId: string;
  tabs: DashboardWorkspaceTabItem[];
  onSelect: (tab: DashboardWorkspaceTabItem) => void;
};

export default function DashboardWorkspaceTabs({
  ariaLabel,
  introLabel,
  sectionCountLabel,
  activeTabId,
  tabs,
  onSelect
}: DashboardWorkspaceTabsProps) {
  return (
    <nav className="dashboard-tab-nav" aria-label={ariaLabel}>
      <div className="dashboard-tab-nav__intro">
        <span>{introLabel}</span>
        <small>{sectionCountLabel}</small>
      </div>

      <div className="dashboard-tab-nav__track" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTabId === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`dashboard-tab-nav__button${
                active ? ' dashboard-tab-nav__button--active' : ''
              }`}
              onClick={() => onSelect(tab)}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
