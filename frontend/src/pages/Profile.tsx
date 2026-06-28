import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Mail, Phone, ShieldCheck, User, XCircle } from 'lucide-react';

import { ApiError } from '../api/client';
import { resendEmailVerification } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function Profile() {
  const { language } = useLanguage();
  const { token, user, updateProfile, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();

  useDocumentTitle('Profile');

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devVerificationUrl, setDevVerificationUrl] = useState('');

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setCompanyName(user?.companyName ?? '');
  }, [user]);

  const registered = searchParams.get('registered') === '1';

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'الملف الشخصي',
          title: 'إعدادات الحساب',
          description: 'حدّث بياناتك الشخصية وتابع حالة التحقق من البريد الإلكتروني.',
          name: 'الاسم الكامل',
          phone: 'الهاتف',
          companyName: 'اسم الشركة / الوكالة',
          companyHelp: 'اختياري، ومفيد لحسابات الملاك والوسطاء والشركاء.',
          role: 'نوع الحساب',
          email: 'البريد الإلكتروني',
          verified: 'تم تأكيد البريد',
          unverified: 'البريد غير مؤكد',
          resend: 'إعادة إرسال رابط التحقق',
          sending: 'جاري الإرسال...',
          save: 'حفظ التغييرات',
          saving: 'جاري الحفظ...',
          saved: 'تم تحديث الملف الشخصي.',
          verificationSent:
            'تم تجهيز رابط التحقق. إذا كان مزود البريد غير مفعّل بعد، استخدم رابط التطوير أدناه.',
          registered:
            'تم إنشاء حسابك. يرجى تأكيد بريدك الإلكتروني قبل الاعتماد الكامل على الحساب.',
          error: 'تعذر تحديث الملف الشخصي.',
          verificationError: 'تعذر تجهيز رابط التحقق.',
          devLink: 'رابط تحقق التطوير',
          dashboard: 'العودة للوحة التحكم'
        }
      : {
          eyebrow: 'Profile',
          title: 'Account settings',
          description: 'Update your personal information and review email verification status.',
          name: 'Full name',
          phone: 'Phone',
          companyName: 'Company / agency name',
          companyHelp: 'Optional, useful for owner, agent, and partner accounts.',
          role: 'Account type',
          email: 'Email',
          verified: 'Email verified',
          unverified: 'Email not verified',
          resend: 'Resend verification link',
          sending: 'Sending...',
          save: 'Save changes',
          saving: 'Saving...',
          saved: 'Profile updated successfully.',
          verificationSent:
            'Verification link prepared. If an email provider is not configured yet, use the development link below.',
          registered:
            'Your account was created. Please verify your email before relying on full account trust.',
          error: 'Could not update your profile.',
          verificationError: 'Could not prepare a verification link.',
          devLink: 'Development verification link',
          dashboard: 'Back to dashboard'
        };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      setError('');

      await updateProfile({
        name,
        phone,
        companyName
      });

      setMessage(copy.saved);
    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError(copy.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResendVerification() {
    if (!token || sendingVerification) return;

    try {
      setSendingVerification(true);
      setMessage('');
      setError('');
      setDevVerificationUrl('');

      const response = await resendEmailVerification(token);
      await refreshUser();

      setDevVerificationUrl(response.verification.devVerificationUrl ?? '');
      setMessage(copy.verificationSent);
    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError(copy.verificationError);
      }
    } finally {
      setSendingVerification(false);
    }
  }

  if (!user) return null;

  return (
    <section className="page-section container profile-page">
      <div className="profile-page__header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <Link className="button-link button-link--secondary" to="/dashboard">
          {copy.dashboard}
        </Link>
      </div>

      {registered ? (
        <div className="form-success" role="status">
          {copy.registered}
        </div>
      ) : null}

      {message ? (
        <div className="form-success" role="status">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="profile-page__grid">
        <form className="profile-card form-card" onSubmit={handleSubmit}>
          <label>
            {copy.name}
            <span className="input-with-icon">
              <User size={17} aria-hidden="true" />
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
            </span>
          </label>

          <label>
            {copy.phone}
            <span className="input-with-icon">
              <Phone size={17} aria-hidden="true" />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </span>
          </label>

          <label>
            {copy.companyName}
            <span className="input-with-icon">
              <Building2 size={17} aria-hidden="true" />
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                autoComplete="organization"
              />
            </span>
            <small>{copy.companyHelp}</small>
          </label>

          <button className="button-link button-link--primary" type="submit" disabled={saving}>
            {saving ? copy.saving : copy.save}
          </button>
        </form>

        <aside className="profile-card profile-card--status">
          <div className="profile-status-row">
            <span>
              <Mail size={18} aria-hidden="true" />
              {copy.email}
            </span>
            <strong>{user.email}</strong>
          </div>

          <div className="profile-status-row">
            <span>
              <ShieldCheck size={18} aria-hidden="true" />
              {copy.role}
            </span>
            <strong>{user.role.replace(/_/g, ' ').toLowerCase()}</strong>
          </div>

          <div
            className={`profile-verification-status ${
              user.emailVerified ? 'profile-verification-status--verified' : ''
            }`}
          >
            {user.emailVerified ? (
              <CheckCircle2 size={20} aria-hidden="true" />
            ) : (
              <XCircle size={20} aria-hidden="true" />
            )}

            <div>
              <strong>{user.emailVerified ? copy.verified : copy.unverified}</strong>
              {user.emailVerifiedAt ? <span>{user.emailVerifiedAt}</span> : null}
            </div>
          </div>

          {!user.emailVerified ? (
            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={sendingVerification}
              onClick={() => void handleResendVerification()}
            >
              {sendingVerification ? copy.sending : copy.resend}
            </button>
          ) : null}

          {devVerificationUrl ? (
            <p className="trust-note">
              {copy.devLink}:{' '}
              <a href={devVerificationUrl} rel="noreferrer" target="_blank">
                {devVerificationUrl}
              </a>
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
