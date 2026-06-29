import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck, XCircle } from 'lucide-react';

import { ApiError } from '../api/client';
import { verifyEmail } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

const verifiedEmailTokens = new Set<string>();
const verificationRequests = new Map<string, Promise<void>>();

export default function VerifyEmail() {
  const { language } = useLanguage();
  const { isAuthenticated, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();

  useDocumentTitle('Verify email');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'تأكيد البريد',
          loading: 'جاري تأكيد بريدك الإلكتروني...',
          success: 'تم تأكيد البريد الإلكتروني',
          successText: 'تم تحديث حالة حسابك بنجاح.',
          alreadyVerified: 'تم تأكيد بريدك الإلكتروني بنجاح.',
          error: 'تعذر تأكيد البريد',
          missing: 'رابط التحقق غير مكتمل.',
          expired: 'رابط التحقق غير صالح أو منتهي الصلاحية.',
          dashboard: 'الذهاب للوحة التحكم',
          login: 'تسجيل الدخول'
        }
      : {
          eyebrow: 'Email verification',
          loading: 'Verifying your email address...',
          success: 'Email verified',
          successText: 'Your account status has been updated successfully.',
          alreadyVerified: 'Your email has been verified successfully.',
          error: 'Could not verify email',
          missing: 'The verification link is missing a token.',
          expired: 'Verification link is invalid or expired.',
          dashboard: 'Go to dashboard',
          login: 'Login'
        };

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage(copy.missing);
      return;
    }

    const verificationToken = token;
    let active = true;

    async function runVerification() {
      try {
        setStatus('loading');

        if (verifiedEmailTokens.has(verificationToken)) {
          if (!active) return;

          setStatus('success');
          setMessage(copy.alreadyVerified);
          return;
        }

        let verificationRequest = verificationRequests.get(verificationToken);

        if (!verificationRequest) {
          verificationRequest = verifyEmail(verificationToken).then(async () => {
            if (isAuthenticated) {
              await refreshUser();
            }

            verifiedEmailTokens.add(verificationToken);
          });

          verificationRequests.set(verificationToken, verificationRequest);
        }

        await verificationRequest;

        if (!active) return;

        setStatus('success');
        setMessage(copy.successText);
      } catch (caughtError) {
        console.error(caughtError);
        verificationRequests.delete(verificationToken);

        if (isAuthenticated) {
          const refreshedUser = await refreshUser().catch(() => null);

          if (refreshedUser?.emailVerified) {
            verifiedEmailTokens.add(verificationToken);

            if (!active) return;

            setStatus('success');
            setMessage(copy.alreadyVerified);
            return;
          }
        }

        if (!active) return;

        setStatus('error');

        if (caughtError instanceof ApiError) {
          setMessage(caughtError.message);
        } else {
          setMessage(copy.expired);
        }
      }
    }

    void runVerification();

    return () => {
      active = false;
    };
  }, [
    copy.alreadyVerified,
    copy.expired,
    copy.missing,
    copy.successText,
    isAuthenticated,
    refreshUser,
    searchParams
  ]);

  return (
    <section className="page-section container verify-email-page">
      <div className="verify-email-card">
        <p className="eyebrow">{copy.eyebrow}</p>

        {status === 'loading' ? (
          <>
            <MailCheck size={36} aria-hidden="true" />
            <h1>{copy.loading}</h1>
          </>
        ) : null}

        {status === 'success' ? (
          <>
            <CheckCircle2 size={42} aria-hidden="true" />
            <h1>{copy.success}</h1>
            <p>{message}</p>
            <Link className="button-link button-link--primary" to="/dashboard">
              {copy.dashboard}
            </Link>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <XCircle size={42} aria-hidden="true" />
            <h1>{copy.error}</h1>
            <p>{message}</p>
            <Link className="button-link button-link--secondary" to="/login">
              {copy.login}
            </Link>
          </>
        ) : null}
      </div>
    </section>
  );
}
