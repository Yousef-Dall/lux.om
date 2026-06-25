import { useState } from 'react';
import { Bell, TrendingUp } from 'lucide-react';

import { createInvestorWatchlistItem } from '../api/saved';

type InvestorWatchlistFormProps = {
  listingId: string;
  listingTitle: string;
  token: string | null;
  suggestedPrice?: string | number | null;
  language: 'ar' | 'en';
};

export default function InvestorWatchlistForm({
  listingId,
  listingTitle,
  token,
  suggestedPrice,
  language
}: InvestorWatchlistFormProps) {
  const copy =
    language === 'ar'
      ? {
          eyebrow: 'متابعة المستثمر',
          title: 'إضافة إلى قائمة متابعة المستثمر',
          description:
            'احفظ العقار مع سعر مستهدف وملاحظات. التنبيهات الخارجية تحتاج مزود إشعارات قبل تفعيلها.',
          targetPrice: 'السعر المستهدف',
          notes: 'ملاحظات المستثمر',
          notesPlaceholder: 'مثال: مناسب إذا انخفض السعر أو ظهرت مقارنات قريبة.',
          add: 'إضافة للمتابعة',
          adding: 'جاري الإضافة...',
          success: 'تمت إضافة العقار إلى قائمة متابعة المستثمر.',
          login: 'سجّلي الدخول لإضافة العقار إلى قائمة المتابعة.',
          error: 'تعذر إضافة العقار إلى قائمة المتابعة حالياً.'
        }
      : {
          eyebrow: 'Investor watchlist',
          title: 'Add to investor watchlist',
          description:
            'Save this listing with a target price and notes. External alerts require a notification provider before activation.',
          targetPrice: 'Target price',
          notes: 'Investor notes',
          notesPlaceholder: 'Example: interesting if the price drops or new comparables appear nearby.',
          add: 'Add to watchlist',
          adding: 'Adding...',
          success: 'Listing added to your investor watchlist.',
          login: 'Sign in to add this listing to your watchlist.',
          error: 'Could not add this listing to your watchlist right now.'
        };

  const [targetPrice, setTargetPrice] = useState(
    suggestedPrice !== undefined && suggestedPrice !== null ? String(suggestedPrice) : ''
  );
  const [notes, setNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!token) {
      setStatusMessage('');
      setErrorMessage(copy.login);
      return;
    }

    const parsedTargetPrice = targetPrice.trim() ? Number(targetPrice) : undefined;

    if (
      parsedTargetPrice !== undefined &&
      (!Number.isFinite(parsedTargetPrice) || parsedTargetPrice < 0)
    ) {
      setStatusMessage('');
      setErrorMessage(copy.error);
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage('');
      setErrorMessage('');

      await createInvestorWatchlistItem(
        {
          listingId,
          notes: notes.trim() || undefined,
          targetPrice: parsedTargetPrice,
          alertOnPriceChange: true,
          alertOnNewComparables: false
        },
        token
      );

      setStatusMessage(copy.success);
      setErrorMessage('');
    } catch (error) {
      console.error(error);
      setStatusMessage('');
      setErrorMessage(copy.error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="investor-watchlist-form"
      aria-label={`${copy.title}: ${listingTitle}`}
    >
      <div>
        <p className="eyebrow">
          <TrendingUp size={15} aria-hidden="true" />
          {copy.eyebrow}
        </p>
        <h3>{copy.title}</h3>
        <p>{copy.description}</p>
      </div>

      <div className="investor-watchlist-form__grid">
        <label>
          {copy.targetPrice}
          <input
            type="number"
            min="0"
            inputMode="decimal"
            value={targetPrice}
            onChange={(event) => setTargetPrice(event.target.value)}
          />
        </label>

        <label>
          {copy.notes}
          <textarea
            rows={3}
            value={notes}
            placeholder={copy.notesPlaceholder}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>

      <button
        className="button-link button-link--secondary"
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleSubmit()}
      >
        <Bell size={16} aria-hidden="true" />
        {isSubmitting ? copy.adding : copy.add}
      </button>

      {statusMessage ? (
        <p className="form-success" role="status">
          {statusMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
