import {
  AlertTriangle,
  Building2,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Users
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useLanguage } from '../i18n/LanguageContext';
import { cn } from '../utils/format';

const adminWorkspaceLinks = [
  {
    to: '/admin',
    key: 'overview',
    icon: LayoutDashboard
  },
  {
    to: '/admin/users',
    key: 'users',
    icon: Users
  },
  {
    to: '/admin/email-deliveries',
    key: 'emailDeliveries',
    icon: Mail
  },
  {
    to: '/admin/pms',
    key: 'pms',
    icon: Building2
  },
  {
    to: '/admin/reports',
    key: 'reports',
    icon: AlertTriangle
  }
] as const;

export default function AdminWorkspaceNav() {
  const { language } = useLanguage();

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'مساحة الإدارة',
          title: 'عمليات lux.om',
          text: 'تنقل سريع بين النشر، المستخدمين، البريد، والثقة والسلامة.',
          overview: 'لوحة الإدارة',
          users: 'المستخدمون',
          emailDeliveries: 'سجل البريد',
          reports: 'البلاغات',
          pms: 'صلاحيات PMS',
          aria: 'تنقل مساحة الإدارة'
        }
      : {
          eyebrow: 'Admin workspace',
          title: 'lux.om operations',
          text: 'Fast access to publishing, users, email delivery, and trust workflows.',
          overview: 'Admin overview',
          users: 'Users',
          emailDeliveries: 'Email deliveries',
          reports: 'Reports',
          pms: 'PMS access',
          aria: 'Admin workspace navigation'
        };

  return (
    <section className="admin-workspace-nav" aria-label={copy.aria}>
      <div className="container admin-workspace-nav__inner">
        <div className="admin-workspace-nav__intro">
          <span>
            <ShieldCheck size={16} aria-hidden="true" />
            {copy.eyebrow}
          </span>
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.text}</p>
          </div>
        </div>

        <nav className="admin-workspace-nav__links" aria-label={copy.aria}>
          {adminWorkspaceLinks.map((link) => {
            const Icon = link.icon;

            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/admin'}
                className={({ isActive }) =>
                  cn('admin-workspace-nav__link', isActive && 'admin-workspace-nav__link--active')
                }
              >
                <Icon size={17} aria-hidden="true" />
                {copy[link.key]}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
