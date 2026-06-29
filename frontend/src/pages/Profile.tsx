import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Circle, KeyRound, LockKeyhole, Mail, Phone, ShieldCheck, User, XCircle } from 'lucide-react';

import { ApiError } from '../api/client';
import { changePassword, resendEmailVerification } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { getAccountRoleDescription, getAccountRoleLabel } from '../utils/accountRoles';
import { getPasswordPolicyStatus } from '../utils/passwordPolicy';

export default function Profile() {
  const { language } = useLanguage();
  const { token, user, updateProfile, refreshUser, replaceSession } = useAuth();
  const [searchParams] = useSearchParams();

  useDocumentTitle('Profile');

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devVerificationUrl, setDevVerificationUrl] = useState('');

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setCompanyName(user?.companyName ?? '');
  }, [user]);

  const registered = searchParams.get('registered') === '1';

  const securityPasswordPolicy = getPasswordPolicyStatus({
    password: newPassword,
    email: user?.email,
    name: user?.name
  });
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSetPasswordWithoutCurrent = Boolean(
    user?.googleConnected && !user?.passwordLoginEnabled
  );
  const canChangePassword =
    securityPasswordPolicy.isValid &&
    passwordsMatch &&
    (canSetPasswordWithoutCurrent || currentPassword.length > 0) &&
    !changingPassword;

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
          dashboard: 'العودة للوحة التحكم',
          securityTitle: 'أمان الحساب',
          securityDescription: 'غيّري كلمة المرور أو أضيفي كلمة مرور لحساب Google.',
          currentPassword: 'كلمة المرور الحالية',
          newPassword: 'كلمة المرور الجديدة',
          confirmPassword: 'تأكيد كلمة المرور',
          passwordHelp: 'يجب أن تحتوي كلمة المرور على:',
          passwordMismatch: 'كلمتا المرور غير متطابقتين.',
          passwordChanged: 'تم تحديث كلمة المرور بنجاح.',
          passwordChangeError: 'تعذر تحديث كلمة المرور.',
          setPasswordGoogle:
            'هذا الحساب متصل بـ Google. يمكنك إضافة كلمة مرور للدخول بالبريد وكلمة المرور أيضاً.',
          changePassword: 'تحديث كلمة المرور',
          changingPassword: 'جاري التحديث...',
          passwordRules: {
            length: 'من 10 إلى 100 حرف',
            lowercase: 'حرف صغير واحد على الأقل',
            uppercase: 'حرف كبير واحد على الأقل',
            number: 'رقم واحد على الأقل',
            symbol: 'رمز واحد على الأقل',
            trim: 'لا تبدأ أو تنتهي بمسافة',
            email: 'لا تحتوي على اسم البريد الإلكتروني',
            name: 'لا تحتوي على اسمك'
          }
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
          dashboard: 'Back to dashboard',
          securityTitle: 'Account security',
          securityDescription: 'Change your password or add a password to a Google account.',
          currentPassword: 'Current password',
          newPassword: 'New password',
          confirmPassword: 'Confirm password',
          passwordHelp: 'Password must include:',
          passwordMismatch: 'Passwords do not match.',
          passwordChanged: 'Password updated successfully.',
          passwordChangeError: 'Could not update password.',
          setPasswordGoogle:
            'This account is connected with Google. You can add a password to also sign in with email and password.',
          changePassword: 'Update password',
          changingPassword: 'Updating...',
          passwordRules: {
            length: '10 to 100 characters',
            lowercase: 'At least one lowercase letter',
            uppercase: 'At least one uppercase letter',
            number: 'At least one number',
            symbol: 'At least one symbol',
            trim: 'No spaces at the beginning or end',
            email: 'Does not contain the email username',
            name: 'Does not contain your name'
          }
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

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) return;

    if (!passwordsMatch) {
      setPasswordError(copy.passwordMismatch);
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordMessage('');
      setPasswordError('');

      const response = await changePassword(
        {
          ...(canSetPasswordWithoutCurrent ? {} : { currentPassword }),
          newPassword
        },
        token
      );

      replaceSession(response.token, response.user);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(copy.passwordChanged);    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setPasswordError(caughtError.message);
      } else {
        setPasswordError(copy.passwordChangeError);
      }
    } finally {
      setChangingPassword(false);
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

  const roleLabel = getAccountRoleLabel(user.role, language);
  const roleDescription = getAccountRoleDescription(user.role, language);

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
            <strong>{roleLabel}</strong>
            <small className="profile-role-description">{roleDescription}</small>
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

        <form className="profile-card form-card profile-card--security" onSubmit={handleChangePassword}>
          <div className="form-group-heading">
            <span className="form-section-icon">
              <KeyRound size={18} aria-hidden="true" />
            </span>

            <div>
              <h2>{copy.securityTitle}</h2>
              <p>{copy.securityDescription}</p>
            </div>
          </div>

          {canSetPasswordWithoutCurrent ? (
            <p className="trust-note">{copy.setPasswordGoogle}</p>
          ) : (
            <label>
              {copy.currentPassword}
              <span className="input-with-icon">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </span>
            </label>
          )}

          <label>
            {copy.newPassword}
            <span className="input-with-icon">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                minLength={10}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </span>
          </label>

          <div className="password-policy" aria-live="polite">
            <p>{copy.passwordHelp}</p>
            <ul>
              {securityPasswordPolicy.rules.map((rule) => (
                <li
                  key={rule.id}
                  className={rule.passed ? 'password-policy__item--passed' : ''}
                >
                  {rule.passed ? (
                    <CheckCircle2 size={15} aria-hidden="true" />
                  ) : (
                    <Circle size={15} aria-hidden="true" />
                  )}
                  <span>{copy.passwordRules[rule.id as keyof typeof copy.passwordRules]}</span>
                </li>
              ))}
            </ul>
          </div>

          <label>
            {copy.confirmPassword}
            <span className="input-with-icon">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                minLength={10}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </span>
          </label>

          {confirmPassword && !passwordsMatch ? (
            <p className="form-error" role="alert">
              {copy.passwordMismatch}
            </p>
          ) : null}

          {passwordMessage ? (
            <p className="form-success" role="status">
              {passwordMessage}
            </p>
          ) : null}

          {passwordError ? (
            <p className="form-error" role="alert">
              {passwordError}
            </p>
          ) : null}

          <button className="button-link button-link--primary" type="submit" disabled={!canChangePassword}>
            <KeyRound size={17} aria-hidden="true" />
            {changingPassword ? copy.changingPassword : copy.changePassword}
          </button>
        </form>

      </div>
    </section>
  );
}
