import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';

function destination(pathname: string, search: string) {
  return `${pathname}${search || ''}`;
}

export function CrmIndexRedirect() {
  const location = useLocation();
  return <Navigate replace to={destination('/crm/overview', location.search)} />;
}

export function CrmLegacyLeadRedirect() {
  const location = useLocation();
  const { leadId } = useParams<{ leadId: string }>();
  return <Navigate replace to={destination(`/crm/leads/${leadId ?? ''}`, location.search)} />;
}

export function CrmLegacyOperationsRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  const requestedTab = next.get('tab');
  next.delete('tab');

  const routeByTab: Record<string, string> = {
    accounts: '/crm/accounts',
    deals: '/crm/deals',
    pipelines: '/crm/settings/pipelines',
    forecast: '/crm/analytics',
    governance: '/crm/communications'
  };

  const pathname = next.has('convertLeadId')
    ? '/crm/deals'
    : routeByTab[requestedTab ?? ''] ?? '/crm/accounts';
  const query = next.toString();

  return <Navigate replace to={`${pathname}${query ? `?${query}` : ''}`} />;
}
