import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Mail, LockKeyhole, ShieldCheck } from 'lucide-react';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ButtonLink from '../components/ButtonLink';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';

export default function Login() {
  const { language } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useDocumentTitle('Login');

  const [email, setEmail] = useState('admin@lux.om');
  const [password, setPassword] = useState('Password123!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'تسجيل الدخول',
          title: 'ادخل إلى حساب lux.om',
          description: 'سجّل الدخول لإدارة العقارات، الأنشطة، الطلبات، ولوحة التحكم.',
          email: 'البريد الإلكتروني',
          password: 'كلمة المرور',
          submit: 'تسجيل الدخول',
          submitting: 'جاري الدخول...',
          noAccount: 'ليس لديك حساب؟',
          createAccount: 'إنشاء حساب',
          adminHint: 'للتجربة كأدمن: admin@lux.om / Password123!',
          error: 'تعذر تسجيل الدخول. تأكدي من البيانات وحاولي مرة أخرى.'
        }
      : {
          eyebrow: 'Login',
          title: 'Access your lux.om account',
          description: 'Sign in to manage listings, activities, inquiries, and your dashboard.',
          email: 'Email',
          password: 'Password',
          submit: 'Login',
          submitting: 'Signing in...',
          noAccount: 'No account yet?',
          createAccount: 'Create account',
          adminHint: '',
          error: 'Could not sign in. Check your details and try again.'
        };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError('');

      await login({ email, password });

      const state = location.state as { from?: string } | null;
      navigate(state?.from || '/dashboard', { replace: true });
    } catch (loginError) {
      console.error(loginError);

      if (loginError instanceof ApiError) {
        setError(loginError.message);
      } else {
        setError(copy.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-section container auth-page auth-page--login">
      <div className="auth-card">
        <div className="form-group-heading">
          <span className="form-section-icon">
            <ShieldCheck size={18} aria-hidden="true" />
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

          <label>
            {copy.password}
            <span className="input-with-icon">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </span>
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button-link button-link--primary" type="submit" disabled={submitting}>
            <LogIn size={17} aria-hidden="true" />
            {submitting ? copy.submitting : copy.submit}
          </button>

          {copy.adminHint ? <p className="auth-helper">{copy.adminHint}</p> : null}

          <p className="auth-helper">
            {copy.noAccount}{' '}
            <Link to="/register" className="text-link">
              {copy.createAccount}
            </Link>
          </p>
        </form>

        <ButtonLink to="/" variant="soft">
          lux.om
        </ButtonLink>
      </div>
    </section>
  );
}