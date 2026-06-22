export type WhatsAppTemplateLanguage = 'en' | 'ar';

export type WhatsAppTemplateType =
  | 'BUYER_INQUIRY'
  | 'VIEWING_REQUEST'
  | 'AVAILABILITY_REQUEST'
  | 'SEND_LOCATION'
  | 'SEND_BOOKING_LINK'
  | 'SEND_PAYMENT_LINK'
  | 'REQUEST_DOCUMENTS'
  | 'FOLLOW_UP_AFTER_INQUIRY'
  | 'TRAVEL_PACKAGE_QUESTION'
  | 'RENTAL_CONTRACT_DISCUSSION';

export type WhatsAppTemplateContext = {
  language?: WhatsAppTemplateLanguage;
  recipientName?: string | null;
  senderName?: string | null;
  listingTitle?: string | null;
  activityTitle?: string | null;
  agencyName?: string | null;
  location?: string | null;
  date?: string | null;
  guests?: number | string | null;
  bookingLink?: string | null;
  paymentLink?: string | null;
  documents?: string[] | null;
  contractTitle?: string | null;
  customNote?: string | null;
};

export type WhatsAppTemplateResult = {
  type: WhatsAppTemplateType;
  language: WhatsAppTemplateLanguage;
  message: string;
};

const DEFAULT_COUNTRY_CODE = '968';

function cleanText(value?: string | number | null) {
  if (value === null || value === undefined) return '';

  return String(value).trim();
}

function withFallback(value: string, fallback: string) {
  return value || fallback;
}

function formatDocuments(documents?: string[] | null, language: WhatsAppTemplateLanguage = 'en') {
  const cleanedDocuments = (documents ?? [])
    .map((document) => document.trim())
    .filter(Boolean);

  if (!cleanedDocuments.length) {
    return language === 'ar'
      ? 'الوثائق المطلوبة'
      : 'the required documents';
  }

  return cleanedDocuments.join(language === 'ar' ? '، ' : ', ');
}

export function normalizeWhatsAppPhoneNumber(phone?: string | null) {
  if (!phone) return null;

  const trimmed = phone.trim();

  if (!trimmed) return null;

  let normalized = trimmed.replace(/[^\d+]/g, '');

  if (normalized.startsWith('+')) {
    normalized = normalized.slice(1);
  }

  if (normalized.startsWith('00')) {
    normalized = normalized.slice(2);
  }

  if (!normalized) return null;

  if (normalized.length === 8) {
    normalized = `${DEFAULT_COUNTRY_CODE}${normalized}`;
  }

  if (!/^\d{8,15}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function createWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = normalizeWhatsAppPhoneNumber(phone);

  if (!normalizedPhone) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function createWhatsAppShareUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function createBuyerInquiryTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = withFallback(cleanText(context.listingTitle), language === 'ar' ? 'العقار' : 'the property');
  const senderName = cleanText(context.senderName);

  if (language === 'ar') {
    return [
      `مرحباً، أود الاستفسار عن ${title} على lux.om.`,
      context.location ? `الموقع: ${context.location}` : '',
      senderName ? `اسمي: ${senderName}` : '',
      context.customNote ? `ملاحظتي: ${context.customNote}` : '',
      'هل يمكنكم مشاركة التفاصيل والتوفر؟'
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello, I would like to inquire about ${title} on lux.om.`,
    context.location ? `Location: ${context.location}` : '',
    senderName ? `My name: ${senderName}` : '',
    context.customNote ? `Note: ${context.customNote}` : '',
    'Could you please share the details and availability?'
  ]
    .filter(Boolean)
    .join('\n');
}

function createViewingRequestTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = withFallback(cleanText(context.listingTitle), language === 'ar' ? 'العقار' : 'the property');

  if (language === 'ar') {
    return [
      `مرحباً، أود طلب موعد لمعاينة ${title}.`,
      context.date ? `التاريخ المفضل: ${context.date}` : '',
      context.senderName ? `الاسم: ${context.senderName}` : '',
      context.customNote ? `ملاحظة: ${context.customNote}` : '',
      'هل يمكن تأكيد الموعد المناسب؟'
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello, I would like to request a viewing for ${title}.`,
    context.date ? `Preferred date: ${context.date}` : '',
    context.senderName ? `Name: ${context.senderName}` : '',
    context.customNote ? `Note: ${context.customNote}` : '',
    'Could you please confirm a suitable time?'
  ]
    .filter(Boolean)
    .join('\n');
}

function createAvailabilityRequestTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = withFallback(
    cleanText(context.activityTitle || context.listingTitle),
    language === 'ar' ? 'هذا العرض' : 'this offer'
  );

  if (language === 'ar') {
    return [
      `مرحباً، أود التأكد من توفر ${title}.`,
      context.date ? `التاريخ: ${context.date}` : '',
      context.guests ? `عدد الضيوف: ${context.guests}` : '',
      context.customNote ? `ملاحظة: ${context.customNote}` : '',
      'هل التوفر مؤكد؟'
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello, I would like to check availability for ${title}.`,
    context.date ? `Date: ${context.date}` : '',
    context.guests ? `Guests: ${context.guests}` : '',
    context.customNote ? `Note: ${context.customNote}` : '',
    'Is availability confirmed?'
  ]
    .filter(Boolean)
    .join('\n');
}

function createSendLocationTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const location = withFallback(cleanText(context.location), language === 'ar' ? 'الموقع' : 'the location');

  if (language === 'ar') {
    return [
      'مرحباً، هل يمكنكم مشاركة موقع العقار أو نقطة الالتقاء؟',
      `الموقع المطلوب: ${location}`,
      context.customNote ? `ملاحظة: ${context.customNote}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'Hello, could you please share the property location or meeting point?',
    `Requested location: ${location}`,
    context.customNote ? `Note: ${context.customNote}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function createBookingLinkTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = withFallback(
    cleanText(context.activityTitle || context.listingTitle),
    language === 'ar' ? 'الحجز' : 'the booking'
  );

  if (language === 'ar') {
    return [
      `مرحباً، هذا رابط الحجز الخاص بـ ${title}:`,
      cleanText(context.bookingLink),
      'يرجى مراجعة التفاصيل قبل المتابعة.',
      context.customNote ? `ملاحظة: ${context.customNote}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello, here is the booking link for ${title}:`,
    cleanText(context.bookingLink),
    'Please review the details before proceeding.',
    context.customNote ? `Note: ${context.customNote}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function createPaymentLinkTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = withFallback(
    cleanText(context.activityTitle || context.listingTitle),
    language === 'ar' ? 'الطلب' : 'the request'
  );

  if (language === 'ar') {
    return [
      `مرحباً، هذا رابط الدفع الخاص بـ ${title}:`,
      cleanText(context.paymentLink),
      'يرجى الدفع فقط بعد مراجعة تفاصيل الحجز والتأكد من أن الرابط تابع لـ lux.om أو مزود الدفع المعتمد.',
      context.customNote ? `ملاحظة: ${context.customNote}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello, here is the payment link for ${title}:`,
    cleanText(context.paymentLink),
    'Please pay only after reviewing the booking details and confirming the link belongs to lux.om or the approved payment provider.',
    context.customNote ? `Note: ${context.customNote}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function createRequestDocumentsTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const documents = formatDocuments(context.documents, language);

  if (language === 'ar') {
    return [
      'مرحباً، لاستكمال المراجعة نحتاج إلى الوثائق التالية:',
      documents,
      'سيتم استخدامها للمراجعة فقط، ولا يعني ذلك وجود تحقق حكومي تلقائي.',
      context.customNote ? `ملاحظة: ${context.customNote}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'Hello, to continue the review we need the following documents:',
    documents,
    'These will be used for review only and do not mean automatic government verification.',
    context.customNote ? `Note: ${context.customNote}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function createFollowUpTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = cleanText(context.listingTitle || context.activityTitle);

  if (language === 'ar') {
    return [
      'مرحباً، نتابع معكم بخصوص الاستفسار السابق على lux.om.',
      title ? `بخصوص: ${title}` : '',
      'هل ما زلتم مهتمين أو ترغبون بتفاصيل إضافية؟',
      context.customNote ? `ملاحظة: ${context.customNote}` : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'Hello, following up on your earlier inquiry on lux.om.',
    title ? `Regarding: ${title}` : '',
    'Are you still interested, or would you like any additional details?',
    context.customNote ? `Note: ${context.customNote}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function createTravelPackageQuestionTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = withFallback(cleanText(context.activityTitle), language === 'ar' ? 'باقة السفر' : 'the travel package');

  if (language === 'ar') {
    return [
      `مرحباً، لدي سؤال بخصوص ${title} على lux.om.`,
      context.date ? `تاريخ السفر المفضل: ${context.date}` : '',
      context.guests ? `عدد المسافرين: ${context.guests}` : '',
      context.customNote ? `السؤال: ${context.customNote}` : '',
      'يرجى تأكيد تفاصيل الطيران والفندق والتأشيرة والتوفر قبل الحجز.'
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello, I have a question about ${title} on lux.om.`,
    context.date ? `Preferred travel date: ${context.date}` : '',
    context.guests ? `Travelers: ${context.guests}` : '',
    context.customNote ? `Question: ${context.customNote}` : '',
    'Please confirm flight, hotel, visa, and availability details before booking.'
  ]
    .filter(Boolean)
    .join('\n');
}

function createRentalContractDiscussionTemplate(context: WhatsAppTemplateContext): string {
  const language = context.language ?? 'en';
  const title = withFallback(
    cleanText(context.contractTitle || context.listingTitle),
    language === 'ar' ? 'مسودة عقد الإيجار' : 'the rental contract draft'
  );

  if (language === 'ar') {
    return [
      `مرحباً، أود مناقشة ${title}.`,
      'هذه مسودة للمراجعة وليست عقداً رسمياً مسجلاً تلقائياً.',
      context.customNote ? `ملاحظة: ${context.customNote}` : '',
      'هل يمكنكم مراجعة التفاصيل؟'
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Hello, I would like to discuss ${title}.`,
    'This is a draft for review and is not an automatically registered official contract.',
    context.customNote ? `Note: ${context.customNote}` : '',
    'Could you please review the details?'
  ]
    .filter(Boolean)
    .join('\n');
}

export function createWhatsAppTemplate(
  type: WhatsAppTemplateType,
  context: WhatsAppTemplateContext = {}
): WhatsAppTemplateResult {
  const language = context.language ?? 'en';

  const message =
    type === 'BUYER_INQUIRY'
      ? createBuyerInquiryTemplate({ ...context, language })
      : type === 'VIEWING_REQUEST'
        ? createViewingRequestTemplate({ ...context, language })
        : type === 'AVAILABILITY_REQUEST'
          ? createAvailabilityRequestTemplate({ ...context, language })
          : type === 'SEND_LOCATION'
            ? createSendLocationTemplate({ ...context, language })
            : type === 'SEND_BOOKING_LINK'
              ? createBookingLinkTemplate({ ...context, language })
              : type === 'SEND_PAYMENT_LINK'
                ? createPaymentLinkTemplate({ ...context, language })
                : type === 'REQUEST_DOCUMENTS'
                  ? createRequestDocumentsTemplate({ ...context, language })
                  : type === 'FOLLOW_UP_AFTER_INQUIRY'
                    ? createFollowUpTemplate({ ...context, language })
                    : type === 'TRAVEL_PACKAGE_QUESTION'
                      ? createTravelPackageQuestionTemplate({ ...context, language })
                      : createRentalContractDiscussionTemplate({ ...context, language });

  return {
    type,
    language,
    message
  };
}

export function createWhatsAppAction(
  phone: string | null | undefined,
  type: WhatsAppTemplateType,
  context: WhatsAppTemplateContext = {}
) {
  const template = createWhatsAppTemplate(type, context);

  return {
    ...template,
    phone: normalizeWhatsAppPhoneNumber(phone),
    url: phone ? createWhatsAppUrl(phone, template.message) : null,
    canSend: Boolean(phone && createWhatsAppUrl(phone, template.message))
  };
}