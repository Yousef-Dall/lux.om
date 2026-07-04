import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, LockKeyhole, UserPlus, Phone, User, CheckCircle2, Circle } from 'lucide-react';

import { ApiError } from '../api/client';
import { getGoogleOAuthStartUrl, type PublicRegistrationRole } from '../api/auth';
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
  const [role, setRole] = useState<PublicRegistrationRole>('USER');
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
          activityProvider: 'مزود أنشطة',
          travelAgency: 'وكالة سفر',
          developer: 'شركة تطوير عقاري',
          userHelp: 'حساب المستخدم مناسب للتصفح، الاستفسارات، الحجز، والدفع.',
          ownerHelp: 'حساب المالك / الوسيط مناسب لإضافة العقارات واستقبال العملاء المحتملين وطلبات الزيارة.',
          activityProviderHelp: 'حساب مزود الأنشطة مناسب لإدارة التجارب والحجوزات والسعة والمدفوعات.',
          travelAgencyHelp: 'حساب وكالة السفر مناسب لإدارة باقات السفر والبرامج وطلبات المجموعات.',
          developerHelp: 'حساب شركة التطوير مناسب لإدارة المشاريع والوحدات وجاهزية الإطلاق.',
          submit: 'إنشاء الحساب',
          googleUser: 'المتابعة مع Google كمستخدم',
          googleOwner: 'المتابعة مع Google كمالك / وسيط',
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
          activityProvider: 'Activity provider',
          travelAgency: 'Travel agency',
          developer: 'Developer company',
          userHelp: 'User accounts are for browsing, inquiries, bookings, and payments.',
          ownerHelp: 'Owner / agent accounts are for submitting real-estate listings and receiving leads or viewing requests.',
          activityProviderHelp: 'Activity provider accounts are for managing experiences, bookings, capacity, and payments.',
          travelAgencyHelp: 'Travel agency accounts are for managing travel packages, itineraries, and group requests.',
          developerHelp: 'Developer company accounts are for managing projects, units, and launch readiness.',
          submit: 'Create account',
          googleUser: 'Continue with Google as user',
          googleOwner: 'Continue with Google as owner / agent',
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

  const accountTypeOptions: Array<{
    value: PublicRegistrationRole;
    label: string;
    help: string;
  }> = [
    {
      value: 'USER',
      label: copy.user,
      help: copy.userHelp
    },
    {
      value: 'OWNER',
      label: copy.owner,
      help: copy.ownerHelp
    },
    {
      value: 'ACTIVITY_PROVIDER',
      label: copy.activityProvider,
      help: copy.activityProviderHelp
    },
    {
      value: 'TRAVEL_AGENCY',
      label: copy.travelAgency,
      help: copy.travelAgencyHelp
    },
    {
      value: 'DEVELOPER',
      label: copy.developer,
      help: copy.developerHelp
    }
  ];

  const selectedAccountType = accountTypeOptions.find((option) => option.value === role);

  useEffect(() => {
    if (role === 'USER' && companyName) {
      setCompanyName('');
    }
  }, [companyName, role]);

  function handleGoogleRegister(nextRole: PublicRegistrationRole) {
    window.location.href = getGoogleOAuthStartUrl({
      role: nextRole,
      returnTo: '/dashboard'
    });
  }

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
          <div className="auth-provider-actions">
            <button
              className="button-link button-link--secondary auth-provider-button"
              type="button"
              onClick={() => handleGoogleRegister('USER')}
            >
              G
              {copy.googleUser}
            </button>

            <button
              className="button-link button-link--secondary auth-provider-button"
              type="button"
              onClick={() => handleGoogleRegister('OWNER')}
            >
              G
              {copy.googleOwner}
            </button>
          </div>

          <div className="auth-divider" aria-hidden="true">
            <span />
          </div>

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

          {role !== 'USER' ? (
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
          ) : null}

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
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as PublicRegistrationRole)}
            >
              {accountTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>{selectedAccountType?.help ?? copy.userHelp}</small>
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