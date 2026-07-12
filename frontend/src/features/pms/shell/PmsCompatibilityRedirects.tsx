import { Navigate, useLocation, useParams } from 'react-router-dom';

function destination(pathname: string, search: string) {
  return `${pathname}${search || ''}`;
}

export function PmsIndexRedirect() {
  const location = useLocation();
  return <Navigate replace to={destination('/pms/overview', location.search)} />;
}

export function PmsLegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate replace to={destination(to, location.search)} />;
}

export function PmsLegacyPropertyRedirect() {
  const location = useLocation();
  const { propertyId } = useParams<{ propertyId: string }>();
  return (
    <Navigate
      replace
      to={destination(`/pms/portfolio/properties/${propertyId ?? ''}`, location.search)}
    />
  );
}

export function PmsLegacyLeaseRedirect() {
  const location = useLocation();
  const { leaseId } = useParams<{ leaseId: string }>();
  return (
    <Navigate
      replace
      to={destination(`/pms/leasing/leases/${leaseId ?? ''}`, location.search)}
    />
  );
}
