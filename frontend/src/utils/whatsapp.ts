export function normalizeWhatsAppPhone(phone?: string | null) {
  if (!phone) return null;

  let normalized = phone.trim().replace(/[^\d+]/g, '');

  if (normalized.startsWith('+')) normalized = normalized.slice(1);
  if (normalized.startsWith('00')) normalized = normalized.slice(2);
  if (normalized.length === 8) normalized = `968${normalized}`;

  return /^\d{8,15}$/.test(normalized) ? normalized : null;
}

export function createWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);

  if (!normalized) return null;

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function createListingInquiryMessage(title: string, location?: string) {
  return [
    `Hello, I would like to inquire about ${title} on lux.om.`,
    location ? `Location: ${location}` : '',
    'Could you please share the details and availability?'
  ]
    .filter(Boolean)
    .join('\n');
}
