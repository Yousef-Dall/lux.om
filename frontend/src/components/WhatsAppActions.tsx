import { MessageCircle } from 'lucide-react';

import { createListingInquiryMessage, createWhatsAppUrl } from '../utils/whatsapp';

type WhatsAppActionsProps = {
  phone?: string | null;
  title: string;
  location?: string;
  label?: string;
};

export default function WhatsAppActions({ phone, title, location, label = 'WhatsApp inquiry' }: WhatsAppActionsProps) {
  const url = createWhatsAppUrl(phone, createListingInquiryMessage(title, location));

  if (!url) return null;

  return (
    <a className="button-link button-link--secondary button-link--whatsapp" href={url} target="_blank" rel="noreferrer">
      <MessageCircle size={16} aria-hidden="true" />
      {label}
    </a>
  );
}
