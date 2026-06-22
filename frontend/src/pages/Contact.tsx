import {
  Building2,
  CheckCircle2,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import { ApiError } from '../api/client';
import { createWhatsAppUrl } from '../utils/whatsapp';
import { createInquiry } from '../api/inquiries';
import SectionHeader from '../components/SectionHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLanguage } from '../i18n/LanguageContext';
import type { ContactFormState, InquiryType } from '../types';

const initialState: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  message: ''
};

const LUX_WHATSAPP_PHONE = '+96890000000';

type InquiryOption = {
  type: InquiryType;
  value: string;
  icon: typeof Home;
  label: string;
};

export default function Contact() {
  const { t, language } = useLanguage();

  useDocumentTitle('Contact');

  const [form, setForm] = useState(initialState);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryType>('GENERAL');

  const copy = useMemo(
    () =>
      language === 'ar'
        ? {
            inquiryType: 'نوع الاستفسار',
            property: 'عقار',
            activity: 'نشاط',
            ownerAgent: 'مالك / وسيط',
            developer: 'مطور',
            general: 'استفسار عام',
            propertyMessage: 'أنا مهتم بعقار منشور على lux.om.',
            activityMessage: 'أريد الحجز أو السؤال عن نشاط.',
            ownerMessage: 'أنا مالك أو وسيط وأرغب في إدراج عقاراتي على lux.om.',
            developerMessage: 'أنا شركة تطوير عقاري وأرغب في الشراكة مع lux.om.',
            generalMessage: 'أرغب في التواصل مع فريق lux.om.',
            namePlaceholder: 'الاسم الكامل',
            emailPlaceholder: 'you@example.com',
            phonePlaceholder: '+968 9000 0000',
            messagePlaceholder: 'اكتب لنا ما تبحث عنه...',
            detailsText:
              'تواصل مع فريق lux.om للاستفسارات العقارية، حجوزات الأنشطة، انضمام الملاك، أو شراكات المطورين.',
            email: 'البريد الإلكتروني',
            phone: 'الهاتف',
            location: 'الموقع',
            chatWhatsapp: 'تحدث معنا على واتساب',
            orWhatsapp: 'أو تحدثي معنا مباشرة على واتساب',
            whatsappMessage: 'مرحباً، أود التواصل مع فريق lux.om.',
            sending: 'جاري الإرسال...',
            fallbackError: 'تعذر إرسال الاستفسار. حاولي مرة أخرى.'
          }
        : {
            inquiryType: 'Inquiry type',
            property: 'Property',
            activity: 'Activity',
            ownerAgent: 'Owner / agent',
            developer: 'Developer',
            general: 'General',
            propertyMessage: 'I am interested in a property listing on lux.om.',
            activityMessage: 'I want to book or ask about an activity.',
            ownerMessage: 'I am an owner or agent and want to list properties on lux.om.',
            developerMessage:
              'I represent a real estate developer and want to partner with lux.om.',
            generalMessage: 'I would like to contact the lux.om team.',
            namePlaceholder: 'Your full name',
            emailPlaceholder: 'you@example.com',
            phonePlaceholder: '+968 9000 0000',
            messagePlaceholder: 'Tell us what you are looking for...',
            detailsText:
              'Reach the lux.om team for property inquiries, activity bookings, owner onboarding, or developer partnership questions.',
            email: 'Email',
            phone: 'Phone',
            location: 'Location',
            chatWhatsapp: 'Chat on WhatsApp',
            orWhatsapp: 'or chat with us directly on WhatsApp',
            whatsappMessage: 'Hello, I would like to contact the lux.om team.',
            sending: 'Sending...',
            fallbackError: 'Could not send your inquiry. Please try again.'
          },
    [language]
  );

  const whatsappUrl = createWhatsAppUrl(LUX_WHATSAPP_PHONE, copy.whatsappMessage);

  const inquiryTypes = useMemo<InquiryOption[]>(
    () => [
      {
        type: 'PROPERTY',
        value: copy.propertyMessage,
        icon: Home,
        label: copy.property
      },
      {
        type: 'ACTIVITY',
        value: copy.activityMessage,
        icon: Sparkles,
        label: copy.activity
      },
      {
        type: 'OWNER_PARTNERSHIP',
        value: copy.ownerMessage,
        icon: Building2,
        label: copy.ownerAgent
      },
      {
        type: 'DEVELOPER_PARTNERSHIP',
        value: copy.developerMessage,
        icon: Building2,
        label: copy.developer
      },
      {
        type: 'GENERAL',
        value: copy.generalMessage,
        icon: MessageCircle,
        label: copy.general
      }
    ],
    [copy]
  );

  function updateForm(field: keyof ContactFormState, value: string) {
    setSubmitted(false);
    setSubmitError('');
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyInquiryTemplate(type: InquiryType, message: string) {
    setSelectedInquiry(type);
    setSubmitted(false);
    setSubmitError('');
    setForm((current) => ({
      ...current,
      message: current.message.trim() ? current.message : message
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSubmitting(true);
      setSubmitted(false);
      setSubmitError('');

      await createInquiry({
  type: selectedInquiry,
  name: form.name,
  email: form.email,
  phone: form.phone.trim() || undefined,
  message: form.message
});

      setSubmitted(true);
      setSelectedInquiry('GENERAL');
      setForm(initialState);
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError(copy.fallbackError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-section container contact-page">
      <SectionHeader
        eyebrow={t.contact.eyebrow}
        title={t.contact.title}
        description={t.contact.description}
      />

      <div className="contact-layout contact-layout--premium">
        <form className="form-card contact-form-card" onSubmit={handleSubmit}>
          <div className="form-group-heading">
            <span className="form-section-icon">
              <MessageCircle size={18} aria-hidden="true" />
            </span>

            <div>
              <p className="eyebrow">{copy.inquiryType}</p>
              <h2>{t.contact.message}</h2>
            </div>
          </div>

          <div className="inquiry-type-grid" aria-label={copy.inquiryType}>
            {inquiryTypes.map((item) => {
              const Icon = item.icon;
              const isActive = selectedInquiry === item.type;

              return (
                <button
                  key={item.type}
                  type="button"
                  className={isActive ? 'active' : ''}
                  onClick={() => applyInquiryTemplate(item.type, item.value)}
                >
                  <Icon size={18} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="form-grid form-grid--two">
            <label>
              {t.contact.name}
              <input
                required
                name="name"
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                autoComplete="name"
                placeholder={copy.namePlaceholder}
              />
            </label>

            <label>
              {t.contact.email}
              <input
                required
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
                autoComplete="email"
                placeholder={copy.emailPlaceholder}
              />
            </label>
          </div>

          <label>
            {t.contact.phone}
            <input
              name="phone"
              value={form.phone}
              onChange={(event) => updateForm('phone', event.target.value)}
              autoComplete="tel"
              placeholder={copy.phonePlaceholder}
            />
          </label>

          <label>
            {t.contact.message}
            <textarea
              required
              name="message"
              rows={6}
              value={form.message}
              onChange={(event) => updateForm('message', event.target.value)}
              placeholder={copy.messagePlaceholder}
            />
          </label>

          <button className="button-link button-link--primary" type="submit" disabled={submitting}>
            <Mail size={17} aria-hidden="true" />
            {submitting ? copy.sending : t.common.sendInquiry}
          </button>

          {whatsappUrl ? (
            <a className="contact-form-whatsapp-hint" href={whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={15} aria-hidden="true" />
              {copy.orWhatsapp}
            </a>
          ) : null}

          {submitError ? (
            <p className="form-error" role="alert">
              {submitError}
            </p>
          ) : null}

          {submitted ? (
            <p className="success-message success-message--floating" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              {t.contact.submitted}
            </p>
          ) : null}
        </form>

        <aside className="contact-card contact-card--premium">
          <div>
            <p className="eyebrow">{t.footer.contact}</p>
            <h2>{t.contact.contactDetails}</h2>
            <p>{copy.detailsText}</p>
          </div>

          <div className="contact-method-list">
            <a href="mailto:hello@lux.om">
              <Mail size={18} aria-hidden="true" />
              <span>
                <small>{copy.email}</small>
                hello@lux.om
              </span>
            </a>

            <a href="tel:+96890000000">
              <Phone size={18} aria-hidden="true" />
              <span>
                <small>{copy.phone}</small>
                +968 9000 0000
              </span>
            </a>

            {whatsappUrl ? (
              <a className="contact-whatsapp-action" href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle size={18} aria-hidden="true" />
                <span>
                  <small>WhatsApp</small>
                  {copy.chatWhatsapp}
                </span>
              </a>
            ) : null}

            <span>
              <MapPin size={18} aria-hidden="true" />
              <span>
                <small>{copy.location}</small>
                {t.footer.address}
              </span>
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}