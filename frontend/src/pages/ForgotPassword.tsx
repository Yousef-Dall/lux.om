import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send } from 'lucide-react';

import { ApiError } from '../api/client';
import { requestPasswordReset } from '../api/auth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function ForgotPassword() {
  const { language } = useLanguage();

  useDocumentTitle('Forgot password');

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'استعادة كلمة المرور',
          title: 'إعادة تعيين كلمة المرور',
          description:
            'أدخلي بريدك الإلكتروني، وإذا كان الحساب موجوداً سنرسل رابطاً آمناً لإعادة التعيين.',
          email: 'البريد الإلكتروني',
          submit: 'إرسال رابط إعادة التعيين',
          submitting: 'جاري الإرسال...',
          success:
            'إذا كان هذا البريد مسجلاً، سيتم إرسال رابط إعادة تعيين كلمة المرور خلال دقائق.',
          devLink: 'رابط التطوير المحلي',
          login: 'العودة لتسجيل الدخول',
          error: 'تعذر إرسال طلب إعادة التعيين. حاولي مرة أخرى.'
        }
      : {
          eyebrow: 'Password recovery',
          title: 'Reset your password',
          description:
            'Enter your email address. If an account exists, we will send a secure reset link.',
          email: 'Email',
          submit: 'Send reset link',
          submitting: 'Sending...',
          success:
            'If this email is registered, a password reset link will be sent within a few minutes.',
          devLink: 'Local development reset link',
          login: 'Back to login',
          error: 'Could not request a password reset. Please try again.'
        };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      setDevResetUrl(null);

      const response = await requestPasswordReset(email);

      setSuccess(copy.success);
      setDevResetUrl(response.reset.devPasswordResetUrl ?? null);
    } catch (caughtError) {
      console.error(caughtError);

      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError(copy.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-section container auth-page">
      <div className="auth-card">
        <div className="form-group-heading">
          <span className="form-section-icon">
            <Mail size={18} aria-hidden="true" />
          </span>

          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          <label>
            {copy.email}
            <span className="input-with-icon">
              <Mail size={17} aria-hidden="true" />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </span>
          </label>

          {success ? (
            <p className="form-success" role="status">
              {success}
            </p>
          ) : null}

          {devResetUrl ? (
            <a className="auth-dev-link" href={devResetUrl}>
              {copy.devLink}
            </a>
          ) : null}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button-link button-link--primary" type="submit" disabled={submitting}>
            <Send size={17} aria-hidden="true" />
            {submitting ? copy.submitting : copy.submit}
          </button>

          <p className="auth-helper">
            <Link to="/login" className="text-link">
              {copy.login}
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}
