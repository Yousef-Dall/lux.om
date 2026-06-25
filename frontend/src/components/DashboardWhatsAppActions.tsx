import { useMemo, useState, type ChangeEvent } from 'react';
import { Copy, MessageCircle } from 'lucide-react';

type DashboardWhatsAppActionsProps = {
  item: unknown;
  itemType: 'listing' | 'activity' | 'booking';
  language: 'en' | 'ar';
};

type TemplateOption = {
  id: string;
  labelEn: string;
  labelAr: string;
  build: (context: WhatsAppTemplateContext) => string;
};

type WhatsAppTemplateContext = {
  title: string;
  location: string;
  customerName: string;
  date: string;
  amount: string;
  publicUrl: string;
  paymentUrl: string;
  language: 'en' | 'ar';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getValue(record: unknown, key: string) {
  return isRecord(record) ? record[key] : undefined;
}

function getNestedRecord(record: unknown, key: string) {
  const value = getValue(record, key);

  return isRecord(value) ? value : null;
}

function getText(record: unknown, keys: string | string[], fallback = '') {
  const keyList = Array.isArray(keys) ? keys : [keys];

  for (const key of keyList) {
    const value = getValue(record, key);

    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return fallback;
}

function getFirstText(values: string[], fallback = '') {
  return values.find((value) => value.trim())?.trim() ?? fallback;
}

function getTitle(item: unknown, itemType: DashboardWhatsAppActionsProps['itemType']) {
  if (itemType === 'booking') {
    const activity = getNestedRecord(item, 'activity');
    const listing = getNestedRecord(item, 'listing');

    return getFirstText(
      [
        getText(activity, ['titleEn', 'titleAr', 'title']),
        getText(listing, ['titleEn', 'titleAr', 'title']),
        getText(item, 'title')
      ],
      'lux.om request'
    );
  }

  return getText(
    item,
    itemType === 'activity'
      ? ['titleEn', 'titleAr', 'title']
      : ['titleEn', 'titleAr', 'title'],
    itemType === 'activity' ? 'Activity' : 'Listing'
  );
}

function getLocation(item: unknown, itemType: DashboardWhatsAppActionsProps['itemType']) {
  if (itemType === 'booking') {
    const activity = getNestedRecord(item, 'activity');
    const listing = getNestedRecord(item, 'listing');

    return getFirstText(
      [
        getText(activity, ['locationEn', 'locationAr', 'location']),
        getText(listing, ['locationEn', 'locationAr', 'location'])
      ],
      'Oman'
    );
  }

  return getText(item, ['locationEn', 'locationAr', 'location'], 'Oman');
}

function getCustomerName(item: unknown) {
  return getText(item, ['contactName', 'customerName'], 'there');
}

function getDateText(item: unknown) {
  const rawDate = getText(item, ['scheduledDate', 'date'], '');

  if (!rawDate) return '';

  const date = new Date(rawDate);

  if (Number.isNaN(date.getTime())) return rawDate;

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium'
  }).format(date);
}

function getAmountText(item: unknown) {
  const payment = getNestedRecord(item, 'payment');
  const amount = getText(payment, ['amount'], getText(item, ['amount', 'priceAmount'], ''));
  const currency = getText(payment, ['currency'], getText(item, ['currency', 'priceCurrency'], 'OMR'));

  const parsed = Number(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) return '';

  return `${currency} ${parsed.toLocaleString(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  })}`;
}

function normalizeWhatsAppPhoneNumber(phone?: string | null) {
  if (!phone) return '';

  const trimmed = phone.trim();

  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) return '';

  return hasPlus ? digits : digits;
}

function getPhone(item: unknown, itemType: DashboardWhatsAppActionsProps['itemType']) {
  if (itemType === 'booking') {
    return getFirstText([
      getText(item, 'contactPhone'),
      getText(getNestedRecord(item, 'user'), 'phone')
    ]);
  }

  return getFirstText([
    getText(getNestedRecord(item, 'owner'), 'phone'),
    getText(getNestedRecord(item, 'travelAgency'), 'phone'),
    getText(item, 'phone')
  ]);
}

function getPublicUrl(item: unknown, itemType: DashboardWhatsAppActionsProps['itemType']) {
  if (typeof window === 'undefined') return '';

  if (itemType === 'booking') {
    const activity = getNestedRecord(item, 'activity');
    const listing = getNestedRecord(item, 'listing');

    const activitySlug = getText(activity, 'slug', '');
    const listingSlug = getText(listing, 'slug', '');

    if (activitySlug) return `${window.location.origin}/activities/${activitySlug}`;
    if (listingSlug) return `${window.location.origin}/listings/${listingSlug}`;

    return `${window.location.origin}/dashboard`;
  }

  const slug = getText(item, 'slug', '');

  if (!slug) {
    return `${window.location.origin}/${itemType === 'activity' ? 'activities' : 'listings'}`;
  }

  return `${window.location.origin}/${itemType === 'activity' ? 'activities' : 'listings'}/${slug}`;
}

function getPaymentUrl(item: unknown) {
  if (typeof window === 'undefined') return '';

  const payment = getNestedRecord(item, 'payment');

  return getFirstText([
    getText(payment, ['checkoutUrl', 'paymentUrl', 'hostedCheckoutUrl']),
    `${window.location.origin}/dashboard`
  ]);
}

function createWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = normalizeWhatsAppPhoneNumber(phone);

  if (!normalizedPhone) return '';

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

const listingTemplates: TemplateOption[] = [
  {
    id: 'buyer_inquiry',
    labelEn: 'Buyer inquiry reply',
    labelAr: 'رد استفسار مشتري',
    build: ({ title, location, publicUrl, language }) =>
      language === 'ar'
        ? `مرحباً، شكراً لاهتمامك بعقار ${title} في ${location}. يمكنك مراجعة التفاصيل هنا: ${publicUrl}`
        : `Hello, thank you for your interest in ${title} in ${location}. You can review the details here: ${publicUrl}`
  },
  {
    id: 'viewing_request',
    labelEn: 'Send viewing template',
    labelAr: 'إرسال طلب معاينة',
    build: ({ title, location, publicUrl, language }) =>
      language === 'ar'
        ? `مرحباً، يمكننا ترتيب معاينة لعقار ${title} في ${location}. فضلاً أخبرني بالوقت المناسب لك. التفاصيل: ${publicUrl}`
        : `Hello, we can arrange a viewing for ${title} in ${location}. Please share a suitable time. Details: ${publicUrl}`
  },
  {
    id: 'request_documents',
    labelEn: 'Request documents',
    labelAr: 'طلب مستندات',
    build: ({ title, language }) =>
      language === 'ar'
        ? `مرحباً، لمتابعة طلبك بخصوص ${title}، فضلاً أرسل المستندات أو المعلومات المطلوبة للمراجعة.`
        : `Hello, to continue your request for ${title}, please share the required documents or information for review.`
  }
];

const activityTemplates: TemplateOption[] = [
  {
    id: 'availability',
    labelEn: 'Activity availability',
    labelAr: 'توفر النشاط',
    build: ({ title, location, publicUrl, language }) =>
      language === 'ar'
        ? `مرحباً، بخصوص ${title} في ${location}، فضلاً أخبرني بالتاريخ وعدد الأشخاص للتأكد من التوفر. التفاصيل: ${publicUrl}`
        : `Hello, regarding ${title} in ${location}, please share the preferred date and number of guests so we can confirm availability. Details: ${publicUrl}`
  },
  {
    id: 'booking_link',
    labelEn: 'Send booking link',
    labelAr: 'إرسال رابط الحجز',
    build: ({ title, publicUrl, language }) =>
      language === 'ar'
        ? `مرحباً، يمكنك مراجعة تفاصيل ${title} وبدء الحجز من هنا: ${publicUrl}`
        : `Hello, you can review ${title} and start the booking here: ${publicUrl}`
  },
  {
    id: 'travel_package_question',
    labelEn: 'Travel package question',
    labelAr: 'سؤال باقة سفر',
    build: ({ title, language }) =>
      language === 'ar'
        ? `مرحباً، هل ترغب بمزيد من التفاصيل عن باقة ${title} مثل الفندق، الرحلات، التوفر، والسعر؟`
        : `Hello, would you like more details about ${title}, including hotel, flights, availability, and price?`
  }
];

const bookingTemplates: TemplateOption[] = [
  {
    id: 'follow_up',
    labelEn: 'Follow up after inquiry',
    labelAr: 'متابعة بعد الاستفسار',
    build: ({ customerName, title, date, language }) =>
      language === 'ar'
        ? `مرحباً ${customerName}، نتابع معك بخصوص ${title}${date ? ` بتاريخ ${date}` : ''}. هل ما زلت مهتماً؟`
        : `Hello ${customerName}, following up regarding ${title}${date ? ` on ${date}` : ''}. Are you still interested?`
  },
  {
    id: 'availability_confirmed',
    labelEn: 'Availability response',
    labelAr: 'رد التوفر',
    build: ({ title, date, language }) =>
      language === 'ar'
        ? `مرحباً، التوفر بخصوص ${title}${date ? ` بتاريخ ${date}` : ''} قيد التأكيد. سنوافيك بالتفاصيل قريباً.`
        : `Hello, availability for ${title}${date ? ` on ${date}` : ''} is being confirmed. We will share the details shortly.`
  },
  {
    id: 'payment_reminder',
    labelEn: 'Send payment reminder',
    labelAr: 'إرسال تذكير دفع',
    build: ({ title, amount, paymentUrl, language }) =>
      language === 'ar'
        ? `مرحباً، هذا تذكير بالدفع بخصوص ${title}${amount ? ` بقيمة ${amount}` : ''}. رابط/صفحة الدفع: ${paymentUrl}`
        : `Hello, this is a payment reminder for ${title}${amount ? ` for ${amount}` : ''}. Payment page/link: ${paymentUrl}`
  }
];

function getTemplates(itemType: DashboardWhatsAppActionsProps['itemType']) {
  if (itemType === 'listing') return listingTemplates;
  if (itemType === 'activity') return activityTemplates;

  return bookingTemplates;
}

export default function DashboardWhatsAppActions({
  item,
  itemType,
  language
}: DashboardWhatsAppActionsProps) {
  const templates = getTemplates(itemType);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [copied, setCopied] = useState(false);

  const context = useMemo<WhatsAppTemplateContext>(
    () => ({
      title: getTitle(item, itemType),
      location: getLocation(item, itemType),
      customerName: getCustomerName(item),
      date: getDateText(item),
      amount: getAmountText(item),
      publicUrl: getPublicUrl(item, itemType),
      paymentUrl: getPaymentUrl(item),
      language
    }),
    [item, itemType, language]
  );

  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? templates[0];

  const message = selectedTemplate?.build(context) ?? '';
  const phone = getPhone(item, itemType);
  const whatsAppUrl = createWhatsAppUrl(phone, message);
  const hasPhone = Boolean(whatsAppUrl);

  function handleTemplateChange(event: ChangeEvent<HTMLSelectElement>) {
    setTemplateId(event.target.value);
    setCopied(false);
  }

  async function handleCopyMessage() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        window.prompt('Copy WhatsApp message', message);
      }

      setCopied(true);
    } catch {
      window.prompt('Copy WhatsApp message', message);
    }
  }

  return (
    <div className="dashboard-whatsapp-actions">
      <label>
        <span>{language === 'ar' ? 'قالب واتساب' : 'WhatsApp template'}</span>
        <select value={templateId} onChange={handleTemplateChange}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {language === 'ar' ? template.labelAr : template.labelEn}
            </option>
          ))}
        </select>
      </label>

      <div className="dashboard-whatsapp-actions__buttons">
        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void handleCopyMessage()}
        >
          <Copy size={14} aria-hidden="true" />
          {copied
            ? language === 'ar'
              ? 'تم النسخ'
              : 'Copied'
            : language === 'ar'
              ? 'نسخ الرسالة'
              : 'Copy message'}
        </button>

        {hasPhone ? (
          <a
            className="button-link button-link--primary"
            href={whatsAppUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={14} aria-hidden="true" />
            {language === 'ar' ? 'فتح واتساب' : 'Open WhatsApp'}
          </a>
        ) : (
          <button className="button-link button-link--ghost" type="button" disabled>
            <MessageCircle size={14} aria-hidden="true" />
            {language === 'ar' ? 'لا يوجد رقم' : 'No phone'}
          </button>
        )}
      </div>

      {!hasPhone ? (
        <p className="trust-note">
          {language === 'ar'
            ? 'لا يوجد رقم هاتف متاح. يمكنك نسخ الرسالة وإرسالها يدوياً.'
            : 'No phone number is available. Copy the message and send it manually.'}
        </p>
      ) : null}
    </div>
  );
}
