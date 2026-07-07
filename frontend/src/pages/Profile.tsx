import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bell, Building2, CheckCircle2, Circle, KeyRound, LockKeyhole, LogOut, Mail, Phone, ShieldCheck, Trash2, User, XCircle } from 'lucide-react';

import { ApiError } from '../api/client';
import { changePassword, deactivateCurrentAccount, logoutAllSessions, requestEmailChange, resendEmailVerification } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { getAccountRoleDescription, getAccountRoleLabel } from '../utils/accountRoles';
import { getPasswordPolicyStatus } from '../utils/passwordPolicy';

export default function Profile() {
  const { language } = useLanguage();
  const { token, user, updateProfile, refreshUser, replaceSession, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const preferenceCardRef = useRef<HTMLFormElement | null>(null);

  useDocumentTitle('Profile');

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [emailBookingUpdates, setEmailBookingUpdates] = useState(
    user?.emailBookingUpdates ?? true
  );
  const [emailSavedSearchUpdates, setEmailSavedSearchUpdates] = useState(
    user?.emailSavedSearchUpdates ?? true
  );
  const [emailMarketingUpdates, setEmailMarketingUpdates] = useState(
    user?.emailMarketingUpdates ?? false
  );
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loggingOutSessions, setLoggingOutSessions] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [requestedEmail, setRequestedEmail] = useState('');
  const [emailChangeCurrentPassword, setEmailChangeCurrentPassword] = useState('');
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [emailChangeMessage, setEmailChangeMessage] = useState('');
  const [emailChangeError, setEmailChangeError] = useState('');
  const [devEmailChangeUrl, setDevEmailChangeUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devVerificationUrl, setDevVerificationUrl] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteCurrentPassword, setDeleteCurrentPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(user?.phone ?? '');
    setCompanyName(user?.companyName ?? '');
    setEmailBookingUpdates(user?.emailBookingUpdates ?? true);
    setEmailSavedSearchUpdates(user?.emailSavedSearchUpdates ?? true);
    setEmailMarketingUpdates(user?.emailMarketingUpdates ?? false);
  }, [user]);

  const registered = searchParams.get('registered') === '1';
  const shouldHighlightEmailPreferences =
    searchParams.get('section') === 'email-preferences';

  useEffect(() => {
    if (!shouldHighlightEmailPreferences) return;

    const timer = window.setTimeout(() => {
      preferenceCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      preferenceCardRef.current?.focus({ preventScroll: true });
    }, 50);

    return () => window.clearTimeout(timer);
  }, [shouldHighlightEmailPreferences]);

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
  const normalizedRequestedEmail = requestedEmail.trim().toLowerCase();
  const canRequestEmailChange =
    normalizedRequestedEmail.length > 0 &&
    normalizedRequestedEmail !== user?.email &&
    Boolean(user?.passwordLoginEnabled) &&
    emailChangeCurrentPassword.length > 0 &&
    !requestingEmailChange;
  const canDeleteAccount =
    user?.role !== 'ADMIN' &&
    deleteConfirmation === 'DELETE' &&
    (!user?.passwordLoginEnabled || deleteCurrentPassword.length > 0) &&
    !deletingAccount;

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
          notificationPreferencesTitle: 'تفضيلات البريد والتنبيهات',
          notificationPreferencesDescription:
            'اختاري رسائل البريد الاختيارية التي تريدين استقبالها. رسائل الأمان والثقة والمدفوعات المهمة ستبقى مفعّلة دائماً.',
          bookingEmails: 'تحديثات الحجوزات الاختيارية',
          savedSearchEmails: 'نتائج البحث المحفوظة عبر البريد',
          marketingEmails: 'رسائل تسويقية وعروض مستقبلية',
          mandatoryEmails:
            'رسائل أمان الحساب، التحقق، الثقة والسلامة، المدفوعات والإلغاء لا يمكن إيقافها لأنها ضرورية لحماية الحساب والمعاملات.',
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
          sessionControlTitle: 'الجلسات النشطة',
          sessionControlDescription:
            'سجّلي الخروج من الجلسات القديمة على الأجهزة والمتصفحات الأخرى مع إبقاء هذه الجلسة فعّالة.',
          logoutOtherSessions: 'تسجيل الخروج من الجلسات الأخرى',
          loggingOutSessions: 'جاري تسجيل الخروج...',
          sessionsLoggedOut: 'تم تسجيل الخروج من الجلسات الأخرى بنجاح.',
          sessionLogoutError: 'تعذر تسجيل الخروج من الجلسات الأخرى.',
          emailChangeTitle: 'تغيير البريد الإلكتروني',
          emailChangeDescription:
            'أدخلي البريد الجديد وكلمة المرور الحالية. سيتم إرسال رابط تأكيد إلى البريد الجديد.',
          newEmail: 'البريد الإلكتروني الجديد',
          emailChangePassword: 'كلمة المرور الحالية',
          requestEmailChange: 'إرسال رابط تأكيد البريد الجديد',
          requestingEmailChange: 'جاري الإرسال...',
          emailChangeSent:
            'تم تجهيز رابط تأكيد البريد الجديد. افتحي الرابط من البريد الجديد لإكمال التغيير.',
          emailChangeError: 'تعذر تجهيز رابط تغيير البريد.',
          emailChangeDevLink: 'رابط تغيير البريد للتطوير',
          emailChangeNeedsPassword:
            'يجب إضافة كلمة مرور للحساب قبل تغيير البريد الإلكتروني.',
          deleteTitle: 'حذف الحساب',
          deleteDescription:
            'هذا الإجراء يوقف تسجيل الدخول ويزيل بيانات الحساب الشخصية. لن يتم حذف السجلات السوقية النشطة مثل الحجوزات، المدفوعات، العقود أو الإعلانات قبل إغلاقها.',
          deleteConfirmationLabel: 'اكتبي DELETE للتأكيد',
          deletePassword: 'كلمة المرور الحالية',
          deleteButton: 'حذف حسابي',
          deletingAccount: 'جاري حذف الحساب...',
          deleteSuccess: 'تم حذف الحساب. سيتم تسجيل الخروج الآن.',
          deleteError: 'تعذر حذف الحساب.',
          deletePasswordHelp:
            'كلمة المرور مطلوبة لحسابات الدخول بالبريد وكلمة المرور. حسابات Google فقط تحتاج كتابة DELETE.',
          deleteWarning:
            'قبل الحذف، أغلقي أي حجوزات، عقود، مدفوعات، إعلانات، أنشطة أو مشاريع نشطة مرتبطة بالحساب.',
          deleteAdminBlocked:
            'حسابات الأدمن لا يمكن حذفها من صفحة الملف الشخصي. انقلي أو عطّلي صلاحيات الأدمن من لوحة الإدارة أولاً.',
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
          notificationPreferencesTitle: 'Email and notification preferences',
          notificationPreferencesDescription:
            'Choose which optional emails you want to receive. Security, trust, payment, and cancellation emails stay enabled for account and transaction protection.',
          bookingEmails: 'Optional booking workflow emails',
          savedSearchEmails: 'Saved-search match emails',
          marketingEmails: 'Marketing and future promotional emails',
          mandatoryEmails:
            'Account security, verification, trust/safety, payment, and cancellation emails cannot be disabled because they protect your account and transactions.',
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
          sessionControlTitle: 'Active sessions',
          sessionControlDescription:
            'Log out older sessions on other devices and browsers while keeping this session active.',
          logoutOtherSessions: 'Log out other sessions',
          loggingOutSessions: 'Logging out...',
          sessionsLoggedOut: 'Other sessions were logged out successfully.',
          sessionLogoutError: 'Could not log out other sessions.',
          emailChangeTitle: 'Change email',
          emailChangeDescription:
            'Enter your new email and current password. A confirmation link will be sent to the new email.',
          newEmail: 'New email',
          emailChangePassword: 'Current password',
          requestEmailChange: 'Send new email confirmation link',
          requestingEmailChange: 'Sending...',
          emailChangeSent:
            'New email confirmation link prepared. Open the link from the new email to complete the change.',
          emailChangeError: 'Could not prepare email change link.',
          emailChangeDevLink: 'Development email change link',
          emailChangeNeedsPassword:
            'You need to add a password to this account before changing your email.',
          deleteTitle: 'Delete account',
          deleteDescription:
            'This disables sign-in and removes personal account details. Active marketplace records such as bookings, payments, contracts, listings, activities, or projects must be closed before deletion.',
          deleteConfirmationLabel: 'Type DELETE to confirm',
          deletePassword: 'Current password',
          deleteButton: 'Delete my account',
          deletingAccount: 'Deleting account...',
          deleteSuccess: 'Account deleted. You will be signed out now.',
          deleteError: 'Could not delete your account.',
          deletePasswordHelp:
            'Password is required for email/password accounts. Google-only accounts only need the DELETE confirmation.',
          deleteWarning:
            'Before deleting, close any active bookings, contracts, payments, listings, activities, or developer projects linked to this account.',
          deleteAdminBlocked:
            'Admin accounts cannot be deleted from the profile page. Transfer or suspend admin access from the admin console first.',
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
        companyName,
        emailBookingUpdates,
        emailSavedSearchUpdates,
        emailMarketingUpdates
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

  async function handleRequestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) return;

    try {
      setRequestingEmailChange(true);
      setEmailChangeMessage('');
      setEmailChangeError('');
      setDevEmailChangeUrl('');

      const response = await requestEmailChange(
        {
          email: normalizedRequestedEmail,
          currentPassword: emailChangeCurrentPassword
        },
        token
      );

      setRequestedEmail(response.emailChange.pendingEmail);
      setEmailChangeCurrentPassword('');
      setDevEmailChangeUrl(response.emailChange.devEmailChangeVerificationUrl ?? '');
      setEmailChangeMessage(copy.emailChangeSent);
    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setEmailChangeError(caughtError.message);
      } else {
        setEmailChangeError(copy.emailChangeError);
      }
    } finally {
      setRequestingEmailChange(false);
    }
  }

  async function handleLogoutAllSessions() {
    if (!token) return;

    try {
      setLoggingOutSessions(true);
      setSessionMessage('');
      setSessionError('');

      const response = await logoutAllSessions(token);

      replaceSession(response.token, response.user);
      setSessionMessage(copy.sessionsLoggedOut);
    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setSessionError(caughtError.message);
      } else {
        setSessionError(copy.sessionLogoutError);
      }
    } finally {
      setLoggingOutSessions(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !user || !canDeleteAccount) return;

    try {
      setDeletingAccount(true);
      setDeleteMessage('');
      setDeleteError('');

      await deactivateCurrentAccount(
        {
          confirmation: deleteConfirmation,
          ...(user.passwordLoginEnabled ? { currentPassword: deleteCurrentPassword } : {})
        },
        token
      );

      setDeleteMessage(copy.deleteSuccess);

      window.setTimeout(() => {
        logout();
      }, 650);
    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setDeleteError(caughtError.message);
      } else {
        setDeleteError(copy.deleteError);
      }
    } finally {
      setDeletingAccount(false);
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

        <form
          id="email-preferences"
          ref={preferenceCardRef}
          tabIndex={-1}
          className={`profile-card form-card profile-card--notification-preferences ${
            shouldHighlightEmailPreferences ? 'profile-card--highlighted' : ''
          }`}
          onSubmit={handleSubmit}
          aria-labelledby="email-preferences-title"
        >
          <div className="form-group-heading">
            <span className="form-section-icon">
              <Bell size={18} aria-hidden="true" />
            </span>

            <div>
              <h2 id="email-preferences-title">{copy.notificationPreferencesTitle}</h2>
              <p>{copy.notificationPreferencesDescription}</p>
            </div>
          </div>

          <label className="profile-preference-toggle">
            <input
              type="checkbox"
              checked={emailBookingUpdates}
              onChange={(event) => setEmailBookingUpdates(event.target.checked)}
            />
            <span>{copy.bookingEmails}</span>
          </label>

          <label className="profile-preference-toggle">
            <input
              type="checkbox"
              checked={emailSavedSearchUpdates}
              onChange={(event) => setEmailSavedSearchUpdates(event.target.checked)}
            />
            <span>{copy.savedSearchEmails}</span>
          </label>

          <label className="profile-preference-toggle">
            <input
              type="checkbox"
              checked={emailMarketingUpdates}
              onChange={(event) => setEmailMarketingUpdates(event.target.checked)}
            />
            <span>{copy.marketingEmails}</span>
          </label>

          <p className="trust-note">{copy.mandatoryEmails}</p>

          <button className="button-link button-link--secondary" type="submit" disabled={saving}>
            {saving ? copy.saving : copy.save}
          </button>
        </form>

        <form className="profile-card form-card profile-card--email-change" onSubmit={handleRequestEmailChange}>
          <div className="form-group-heading">
            <span className="form-section-icon">
              <Mail size={18} aria-hidden="true" />
            </span>

            <div>
              <h2>{copy.emailChangeTitle}</h2>
              <p>{copy.emailChangeDescription}</p>
            </div>
          </div>

          {!user.passwordLoginEnabled ? (
            <p className="trust-note">{copy.emailChangeNeedsPassword}</p>
          ) : null}

          <label>
            {copy.newEmail}
            <span className="input-with-icon">
              <Mail size={17} aria-hidden="true" />
              <input
                type="email"
                value={requestedEmail}
                onChange={(event) => setRequestedEmail(event.target.value)}
                autoComplete="email"
              />
            </span>
          </label>

          <label>
            {copy.emailChangePassword}
            <span className="input-with-icon">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type="password"
                value={emailChangeCurrentPassword}
                onChange={(event) => setEmailChangeCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={!user.passwordLoginEnabled}
              />
            </span>
          </label>

          {emailChangeMessage ? (
            <p className="form-success" role="status">
              {emailChangeMessage}
            </p>
          ) : null}

          {emailChangeError ? (
            <p className="form-error" role="alert">
              {emailChangeError}
            </p>
          ) : null}

          {devEmailChangeUrl ? (
            <p className="trust-note">
              {copy.emailChangeDevLink}:{' '}
              <a href={devEmailChangeUrl} rel="noreferrer" target="_blank">
                {devEmailChangeUrl}
              </a>
            </p>
          ) : null}

          <button
            className="button-link button-link--secondary"
            type="submit"
            disabled={!canRequestEmailChange}
          >
            {requestingEmailChange ? copy.requestingEmailChange : copy.requestEmailChange}
          </button>
        </form>

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

          <div className="profile-session-control">
            <div>
              <strong>{copy.sessionControlTitle}</strong>
              <p>{copy.sessionControlDescription}</p>
            </div>

            {sessionMessage ? (
              <p className="form-success" role="status">
                {sessionMessage}
              </p>
            ) : null}

            {sessionError ? (
              <p className="form-error" role="alert">
                {sessionError}
              </p>
            ) : null}

            <button
              className="button-link button-link--secondary"
              type="button"
              disabled={loggingOutSessions}
              onClick={() => void handleLogoutAllSessions()}
            >
              <LogOut size={17} aria-hidden="true" />
              {loggingOutSessions ? copy.loggingOutSessions : copy.logoutOtherSessions}
            </button>
          </div>
        </form>

        <form
          className="profile-card form-card profile-card--danger-zone"
          onSubmit={handleDeleteAccount}
        >
          <div className="form-group-heading">
            <span className="form-section-icon form-section-icon--danger">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>

            <div>
              <h2>{copy.deleteTitle}</h2>
              <p>{copy.deleteDescription}</p>
            </div>
          </div>

          <p className="profile-danger-note">{copy.deleteWarning}</p>

          {user.role === 'ADMIN' ? (
            <p className="trust-note">{copy.deleteAdminBlocked}</p>
          ) : null}

          <label>
            {copy.deleteConfirmationLabel}
            <span className="input-with-icon">
              <Trash2 size={17} aria-hidden="true" />
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </span>
          </label>

          {user.passwordLoginEnabled ? (
            <label>
              {copy.deletePassword}
              <span className="input-with-icon">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type="password"
                  value={deleteCurrentPassword}
                  onChange={(event) => setDeleteCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </span>
            </label>
          ) : (
            <p className="trust-note">{copy.deletePasswordHelp}</p>
          )}

          {deleteMessage ? (
            <p className="form-success" role="status">
              {deleteMessage}
            </p>
          ) : null}

          {deleteError ? (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          ) : null}

          <button
            className="button-link button-link--danger"
            type="submit"
            disabled={!canDeleteAccount}
          >
            <Trash2 size={17} aria-hidden="true" />
            {deletingAccount ? copy.deletingAccount : copy.deleteButton}
          </button>
        </form>

      </div>
    </section>
  );
}
