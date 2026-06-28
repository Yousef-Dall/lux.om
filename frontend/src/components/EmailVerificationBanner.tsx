import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck, ShieldAlert } from 'lucide-react';

import { ApiError } from '../api/client';
import { resendEmailVerification } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type EmailVerificationBannerProps = {
  mode?: 'notice' | 'blocking';
};

export default function EmailVerificationBanner({
  mode = 'notice'
}: EmailVerificationBannerProps) {
  const { language } = useLanguage();
  const { token, user, refreshUser } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [devVerificationUrl, setDevVerificationUrl] = useState('');

  if (!user || user.emailVerified) {
    return null;
  }

  const copy =
    language === 'ar'
      ? {
          title:
            mode === 'blocking'
              ? 'يجب تأكيد البريد الإلكتروني قبل المتابعة'
              : 'البريد الإلكتروني غير مؤكد',
          description:
            mode === 'blocking'
              ? 'يمكنك التصفح واستخدام الحساب، لكن إضافة العقارات أو الأنشطة تتطلب تأكيد البريد الإلكتروني أولاً.'
              : 'يرجى تأكيد بريدك الإلكتروني لزيادة موثوقية الحساب وتفعيل صلاحيات النشر عند الحاجة.',
          resend: 'إعادة إرسال رابط التحقق',
          sending: 'جاري الإرسال...',
          profile: 'فتح الملف الشخصي',
          prepared: 'تم تجهيز رابط التحقق.',
          failed: 'تعذر تجهيز رابط التحقق.',
          devLink: 'رابط تحقق التطوير'
        }
      : {
          title:
            mode === 'blocking'
              ? 'Email verification required before continuing'
              : 'Email is not verified',
          description:
            mode === 'blocking'
              ? 'You can browse and use your account, but publishing listings or activities requires email verification first.'
              : 'Please verify your email to improve account trust and unlock publishing permissions when needed.',
          resend: 'Resend verification link',
          sending: 'Sending...',
          profile: 'Open profile',
          prepared: 'Verification link prepared.',
          failed: 'Could not prepare a verification link.',
          devLink: 'Development verification link'
        };

  async function handleResend() {
    if (!token || sending) return;

    try {
      setSending(true);
      setMessage('');
      setError('');
      setDevVerificationUrl('');

      const response = await resendEmailVerification(token);
      await refreshUser();

      setDevVerificationUrl(response.verification.devVerificationUrl ?? '');
      setMessage(copy.prepared);
    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError(copy.failed);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className={`email-verification-banner ${
        mode === 'blocking' ? 'email-verification-banner--blocking' : ''
      }`}
      role={mode === 'blocking' ? 'alert' : 'status'}
    >
      <div className="email-verification-banner__icon">
        {mode === 'blocking' ? (
          <ShieldAlert size={24} aria-hidden="true" />
        ) : (
          <MailCheck size={24} aria-hidden="true" />
        )}
      </div>

      <div className="email-verification-banner__content">
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>

        {message ? <p className="form-success">{message}</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {devVerificationUrl ? (
          <p className="trust-note">
            {copy.devLink}:{' '}
            <a href={devVerificationUrl} rel="noreferrer" target="_blank">
              {devVerificationUrl}
            </a>
          </p>
        ) : null}

        <div className="email-verification-banner__actions">
          <button
            className="button-link button-link--primary"
            type="button"
            disabled={sending}
            onClick={() => void handleResend()}
          >
            {sending ? copy.sending : copy.resend}
          </button>

          <Link className="button-link button-link--secondary" to="/profile">
            {copy.profile}
          </Link>
        </div>
      </div>
    </div>
  );
}
