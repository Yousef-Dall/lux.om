import {
  BarChart3,
  Building2,
  CheckSquare2,
  ContactRound,
  Gauge,
  MailCheck,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  UsersRound
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../../auth/AuthContext';
import { useLanguage } from '../../../i18n/LanguageContext';

type CrmNavigationItem = {
  key: string;
  to: string;
  icon: typeof Gauge;
  operationalWorkspace?: boolean;
};

const primaryItems: CrmNavigationItem[] = [
  { key: 'overview', to: '/crm/overview', icon: Gauge },
  { key: 'leads', to: '/crm/leads', icon: Target },
  { key: 'accounts', to: '/crm/accounts', icon: Building2, operationalWorkspace: true },
  { key: 'contacts', to: '/crm/contacts', icon: ContactRound, operationalWorkspace: true },
  { key: 'deals', to: '/crm/deals', icon: Sparkles, operationalWorkspace: true },
  { key: 'tasks', to: '/crm/tasks', icon: CheckSquare2, operationalWorkspace: true },
  { key: 'communications', to: '/crm/communications', icon: MailCheck, operationalWorkspace: true },
  { key: 'analytics', to: '/crm/analytics', icon: BarChart3, operationalWorkspace: true }
];

const settingsItems: CrmNavigationItem[] = [
  { key: 'pipelines', to: '/crm/settings/pipelines', icon: SlidersHorizontal, operationalWorkspace: true },
  { key: 'scoring', to: '/crm/settings/scoring', icon: Settings2, operationalWorkspace: true },
  { key: 'communicationSettings', to: '/crm/settings/communications', icon: MailCheck, operationalWorkspace: true }
];

function resolveWorkspaceSelection(search: string, access: ReturnType<typeof useAuth>['crmAccess']) {
  const params = new URLSearchParams(search);
  let workspaceKey = params.get('workspace');
  let workspaceId = params.get('workspaceId');

  if (!access) return { workspaceKey, workspaceId };

  if (!workspaceId && workspaceKey === 'personal') {
    workspaceId = access.personalWorkspace.workspaceId ?? null;
  }

  if (!workspaceId && workspaceKey?.startsWith('company:')) {
    const companyId = workspaceKey.slice('company:'.length);
    workspaceId = access.companyWorkspaces.find((item) => item.companyId === companyId)?.workspaceId ?? null;
  }

  if (!workspaceKey && workspaceId) {
    if (access.personalWorkspace.workspaceId === workspaceId) {
      workspaceKey = 'personal';
    } else {
      const company = access.companyWorkspaces.find((item) => item.workspaceId === workspaceId);
      if (company) workspaceKey = `company:${company.companyId}`;
    }
  }

  return { workspaceKey, workspaceId };
}

export default function CrmShell() {
  const { crmAccess } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const copy = language === 'ar'
    ? {
        eyebrow: 'مساحة عمل CRM',
        title: 'إدارة علاقات العملاء',
        description: 'العملاء المحتملون والحسابات والصفقات والتواصل والتحليلات في مساحة مستقلة عن PMS.',
        sections: 'أقسام CRM',
        settings: 'إعدادات CRM',
        overview: 'نظرة عامة',
        leads: 'العملاء المحتملون',
        accounts: 'الحسابات',
        contacts: 'جهات الاتصال',
        deals: 'الصفقات',
        tasks: 'المهام',
        communications: 'التواصل',
        analytics: 'التحليلات',
        pipelines: 'مسارات المبيعات',
        scoring: 'التقييم',
        communicationSettings: 'الحوكمة والتفضيلات'
      }
    : {
        eyebrow: 'CRM workspace',
        title: 'Customer relationship management',
        description: 'Leads, accounts, deals, communications, and analytics in a product workspace separate from PMS.',
        sections: 'CRM sections',
        settings: 'CRM settings',
        overview: 'Overview',
        leads: 'Leads',
        accounts: 'Accounts',
        contacts: 'Contacts',
        deals: 'Deals',
        tasks: 'Tasks',
        communications: 'Communications',
        analytics: 'Analytics',
        pipelines: 'Pipelines',
        scoring: 'Scoring',
        communicationSettings: 'Consent and communications'
      };

  const selection = resolveWorkspaceSelection(location.search, crmAccess);

  function routeTarget(item: CrmNavigationItem) {
    const params = new URLSearchParams();

    if (item.operationalWorkspace) {
      if (selection.workspaceId) params.set('workspaceId', selection.workspaceId);
    } else if (selection.workspaceKey) {
      params.set('workspace', selection.workspaceKey);
    }

    const query = params.toString();
    return query ? `${item.to}?${query}` : item.to;
  }

  function navigationGroup(items: CrmNavigationItem[], label: string) {
    return (
      <nav aria-label={label} className="crm-product-shell__nav">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) => `crm-product-shell__link${isActive ? ' is-active' : ''}`}
              end={item.to === '/crm/overview'}
              key={item.key}
              to={routeTarget(item)}
            >
              <Icon aria-hidden="true" size={17} />
              <span>{copy[item.key as keyof typeof copy]}</span>
            </NavLink>
          );
        })}
      </nav>
    );
  }

  return (
    <section className="crm-product-shell" aria-labelledby="crm-workspace-title">
      <header className="container crm-product-shell__header">
        <div>
          <p className="eyebrow"><UsersRound aria-hidden="true" size={17} /> {copy.eyebrow}</p>
          <h1 id="crm-workspace-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </header>

      <div className="container crm-product-shell__layout">
        <aside className="crm-product-shell__sidebar">
          <p className="crm-product-shell__group-label">{copy.sections}</p>
          {navigationGroup(primaryItems, copy.sections)}
          <p className="crm-product-shell__group-label">{copy.settings}</p>
          {navigationGroup(settingsItems, copy.settings)}
        </aside>
        <div className="crm-product-shell__content">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
