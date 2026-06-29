import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Circle, KeyRound, LockKeyhole } from 'lucide-react';

import { ApiError } from '../api/client';
import { resetPassword } from '../api/auth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { getPasswordPolicyStatus, type PasswordPolicyRuleId } from '../utils/passwordPolicy';

export default function ResetPassword() {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();

  useDocumentTitle('Reset password');

  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'كلمة مرور جديدة',
          title: 'اختاري كلمة مرور جديدة',
          description: 'استخدمي كلمة مرور قوية لحماية حسابك في lux.om.',
          password: 'كلمة المرور الجديدة',
          confirmPassword: 'تأكيد كلمة المرور',
          passwordHelp: 'يجب أن تحتوي كلمة المرور على:',
          passwordMismatch: 'كلمتا المرور غير متطابقتين.',
          missingToken: 'رابط إعادة التعيين غير مكتمل.',
          success: 'تم تحديث كلمة المرور. يمكنك الآن تسجيل الدخول.',
          submit: 'تحديث كلمة المرور',
          submitting: 'جاري التحديث...',
          login: 'تسجيل الدخول',
          error: 'تعذر تحديث كلمة المرور. تأكدي من الرابط وحاولي مرة أخرى.',
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
          eyebrow: 'New password',
          title: 'Choose a new password',
          description: 'Use a strong password to protect your lux.om account.',
          password: 'New password',
          confirmPassword: 'Confirm password',
          passwordHelp: 'Password must include:',
          passwordMismatch: 'Passwords do not match.',
          missingToken: 'The reset link is missing a token.',
          success: 'Your password has been updated. You can now log in.',
          submit: 'Update password',
          submitting: 'Updating...',
          login: 'Login',
          error: 'Could not reset your password. Check the link and try again.',
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

  const passwordPolicy = useMemo(
    () =>
      getPasswordPolicyStatus({
        password
      }),
    [password]
  );

  const passwordRuleLabels: Record<PasswordPolicyRuleId, string> = copy.passwordRules;
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = Boolean(token) && passwordPolicy.isValid && passwordsMatch && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError(copy.missingToken);
      return;
    }

    if (!passwordsMatch) {
      setError(copy.passwordMismatch);
      return;
    }

    if (!passwordPolicy.isValid) {
      setError(copy.error);
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');

      await resetPassword({
        token,
        password
      });

      setSuccess(copy.success);
      setPassword('');
      setConfirmPassword('');
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
            <KeyRound size={18} aria-hidden="true" />
          </span>

          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
          <label>
            {copy.password}
            <span className="input-with-icon">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                required
                minLength={10}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </span>
          </label>

          <div className="password-policy" aria-live="polite">
            <p>{copy.passwordHelp}</p>
            <ul>
              {passwordPolicy.rules.map((rule) => (
                <li
                  key={rule.id}
                  className={rule.passed ? 'password-policy__item--passed' : ''}
                >
                  {rule.passed ? (
                    <CheckCircle2 size={15} aria-hidden="true" />
                  ) : (
                    <Circle size={15} aria-hidden="true" />
                  )}
                  <span>{passwordRuleLabels[rule.id]}</span>
                </li>
              ))}
            </ul>
          </div>

          <label>
            {copy.confirmPassword}
            <span className="input-with-icon">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                required
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

          {success ? (
            <p className="form-success" role="status">
              {success}
            </p>
          ) : null}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button-link button-link--primary" type="submit" disabled={!canSubmit}>
            <KeyRound size={17} aria-hidden="true" />
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
