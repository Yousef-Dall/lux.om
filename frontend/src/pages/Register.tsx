import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, LockKeyhole, UserPlus, Phone, User, CheckCircle2, Circle } from 'lucide-react';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import { getPasswordPolicyStatus, type PasswordPolicyRuleId } from '../utils/passwordPolicy';

export default function Register() {
  const { language } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  useDocumentTitle('Register');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'USER' | 'OWNER'>('USER');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const copy =
    language === 'ar'
      ? {
          eyebrow: 'إنشاء حساب',
          title: 'انضم إلى lux.om',
          description: 'أنشئ حساباً للبحث، التواصل، أو إدراج عقاراتك على lux.om.',
          name: 'الاسم الكامل',
          email: 'البريد الإلكتروني',
          phone: 'الهاتف',
          companyName: 'اسم الشركة / الوكالة',
          password: 'كلمة المرور',
          passwordHelp: 'يجب أن تحتوي كلمة المرور على:',
          passwordError: 'كلمة المرور لا تستوفي شروط الأمان.',
          passwordRules: {
            length: 'من 10 إلى 100 حرف',
            lowercase: 'حرف صغير واحد على الأقل',
            uppercase: 'حرف كبير واحد على الأقل',
            number: 'رقم واحد على الأقل',
            symbol: 'رمز واحد على الأقل',
            trim: 'لا تبدأ أو تنتهي بمسافة',
            email: 'لا تحتوي على اسم البريد الإلكتروني',
            name: 'لا تحتوي على اسمك'
          },
          accountType: 'نوع الحساب',
          user: 'مستخدم',
          owner: 'مالك / وسيط',
          submit: 'إنشاء الحساب',
          submitting: 'جاري إنشاء الحساب...',
          hasAccount: 'لديك حساب بالفعل؟',
          login: 'تسجيل الدخول',
          error: 'تعذر إنشاء الحساب. حاولي مرة أخرى.'
        }
      : {
          eyebrow: 'Create account',
          title: 'Join lux.om',
          description: 'Create an account to search, inquire, or list your properties on lux.om.',
          name: 'Full name',
          email: 'Email',
          phone: 'Phone',
          companyName: 'Company / agency name',
          password: 'Password',
          passwordHelp: 'Password must include:',
          passwordError: 'Password does not meet the security requirements.',
          passwordRules: {
            length: '10 to 100 characters',
            lowercase: 'At least one lowercase letter',
            uppercase: 'At least one uppercase letter',
            number: 'At least one number',
            symbol: 'At least one symbol',
            trim: 'No spaces at the beginning or end',
            email: 'Does not contain the email username',
            name: 'Does not contain your name'
          },
          accountType: 'Account type',
          user: 'User',
          owner: 'Owner / agent',
          submit: 'Create account',
          submitting: 'Creating account...',
          hasAccount: 'Already have an account?',
          login: 'Login',
          error: 'Could not create your account. Please try again.'
        };

  const passwordPolicy = getPasswordPolicyStatus({
    password,
    email,
    name
  });

  const passwordRuleLabels: Record<PasswordPolicyRuleId, string> = copy.passwordRules;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordPolicy.isValid) {
      setError(copy.passwordError);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await register({
        name,
        email,
        password,
        role,
        phone: phone.trim() || undefined,
        companyName: companyName.trim() || undefined
      });

      navigate('/profile?registered=1', { replace: true });
    } catch (registerError) {
      console.error(registerError);

      if (registerError instanceof ApiError) {
        setError(registerError.message);
      } else {
        setError(copy.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-section container auth-page auth-page--register">
      <div className="auth-card">
        <div className="form-group-heading">
          <span className="form-section-icon">
            <UserPlus size={18} aria-hidden="true" />
          </span>

          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
        </div>

        <form className="form-card" onSubmit={handleSubmit}>
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
              <User size={17} aria-hidden="true" />
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                autoComplete="organization"
              />
            </span>
          </label>

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
            {copy.accountType}
            <select value={role} onChange={(event) => setRole(event.target.value as 'USER' | 'OWNER')}>
              <option value="USER">{copy.user}</option>
              <option value="OWNER">{copy.owner}</option>
            </select>
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="button-link button-link--primary" type="submit" disabled={submitting || !passwordPolicy.isValid}>
            <UserPlus size={17} aria-hidden="true" />
            {submitting ? copy.submitting : copy.submit}
          </button>

          <p className="auth-helper">
            {copy.hasAccount}{' '}
            <Link to="/login" className="text-link">
              {copy.login}
            </Link>
          </p>
        </form>
      </div>
    </section>
  );
}