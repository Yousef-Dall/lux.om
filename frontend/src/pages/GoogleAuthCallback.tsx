import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, XCircle } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

function sanitizeReturnTo(returnTo: string | null) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/dashboard';
  }

  if (returnTo.startsWith('/login') || returnTo.startsWith('/register')) {
    return '/dashboard';
  }

  return returnTo;
}

export default function GoogleAuthCallback() {
  const { language } = useLanguage();
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useDocumentTitle('Google login');

  const [error, setError] = useState('');

  const copy =
    language === 'ar'
      ? {
          loading: 'جاري تسجيل الدخول عبر Google...',
          errorTitle: 'تعذر تسجيل الدخول عبر Google',
          error: 'رابط تسجيل الدخول غير مكتمل أو انتهت صلاحيته.',
          login: 'العودة لتسجيل الدخول'
        }
      : {
          loading: 'Signing you in with Google...',
          errorTitle: 'Could not sign in with Google',
          error: 'The Google login link is missing or expired.',
          login: 'Back to login'
        };

  useEffect(() => {
    let active = true;

    async function complete() {
      const token = searchParams.get('token');
      const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

      if (!token) {
        setError(copy.error);
        return;
      }

      try {
        await completeOAuthLogin(token);

        if (!active) return;

        navigate(returnTo, { replace: true });
      } catch (caughtError) {
        console.error(caughtError);

        if (!active) return;

        setError(copy.error);
      }
    }

    void complete();

    return () => {
      active = false;
    };
  }, [completeOAuthLogin, copy.error, navigate, searchParams]);

  return (
    <section className="page-section container auth-page">
      <div className="auth-card">
        {error ? (
          <>
            <span className="form-section-icon">
              <XCircle size={18} aria-hidden="true" />
            </span>
            <h1>{copy.errorTitle}</h1>
            <p className="form-error" role="alert">
              {error}
            </p>
            <Link className="button-link button-link--secondary" to="/login">
              {copy.login}
            </Link>
          </>
        ) : (
          <>
            <span className="form-section-icon">
              <Loader2 size={18} aria-hidden="true" />
            </span>
            <h1>{copy.loading}</h1>
          </>
        )}
      </div>
    </section>
  );
}
