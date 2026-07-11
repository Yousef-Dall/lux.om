import { Link, useLocation } from 'react-router-dom';

import { useAuthenticatedProductNavigation } from '../features/workspace/productNavigation';
import { useLanguage } from '../i18n/LanguageContext';
import { cn } from '../utils/format';

function isActiveItem(item: { key: string; to: string }, pathname: string, search: string) {
  const target = new URL(item.to, 'https://lux.om');

  if (item.key === 'dashboard') {
    return pathname === '/dashboard' && !new URLSearchParams(search).has('workspace');
  }
  if (item.key === 'marketplace' && target.pathname === '/dashboard') {
    const workspaceMatches =
      pathname === '/dashboard' &&
      new URLSearchParams(search).get('workspace') === target.searchParams.get('workspace');
    const creationRoute = ['/add-listing', '/add-project', '/add-activity'].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    return workspaceMatches || creationRoute;
  }
  if (item.key === 'pms') {
    return pathname === '/pms' || pathname.startsWith('/pms/');
  }

  return pathname === target.pathname || pathname.startsWith(`${target.pathname}/`);
}

export default function AuthenticatedProductNav() {
  const { pathname, search } = useLocation();
  const { language } = useLanguage();
  const items = useAuthenticatedProductNavigation();

  if (items.length === 0) return null;

  const label = language === 'ar' ? 'مساحات العمل والمنتجات' : 'Products and workspaces';

  return (
    <nav className="product-nav" aria-label={label}>
      <div className="container product-nav__inner">
        <span className="product-nav__label">{label}</span>
        <div className="product-nav__track">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActiveItem(item, pathname, search);

            return (
              <Link
                key={item.key}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn('product-nav__link', active && 'product-nav__link--active')}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
