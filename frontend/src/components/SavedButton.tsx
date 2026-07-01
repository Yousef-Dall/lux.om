import { useState } from 'react';

import { saveActivity, saveListing, unsaveActivity, unsaveListing } from '../api/saved';
import { useAuth } from '../auth/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

type SavedButtonProps = {
  targetId: string;
  targetType: 'listing' | 'activity';
  initiallySaved?: boolean;
};

export default function SavedButton({ targetId, targetType, initiallySaved = false }: SavedButtonProps) {
  const { token, isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [saved, setSaved] = useState(initiallySaved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleToggle() {
    if (!token || !isAuthenticated || loading) return;

    setLoading(true);
    setError('');

    try {
      if (targetType === 'listing') {
        saved ? await unsaveListing(targetId, token) : await saveListing(targetId, token);
      } else {
        saved ? await unsaveActivity(targetId, token) : await saveActivity(targetId, token);
      }

      setSaved((current) => !current);
    } catch {
      setError(copy.error);
    } finally {
      setLoading(false);
    }
  }

  const copy =
    language === 'ar'
      ? {
          save: 'حفظ',
          saved: 'محفوظ',
          saving: 'جاري الحفظ...',
          target: targetType === 'listing' ? 'العقار' : 'النشاط',
          error: 'تعذر تحديث الحفظ حالياً.'
        }
      : {
          save: 'Save',
          saved: 'Saved',
          saving: 'Saving...',
          target: targetType === 'listing' ? 'listing' : 'activity',
          error: 'Could not update saved state right now.'
        };

  if (!isAuthenticated) return null;

  return (
    <>
      <button
        aria-label={`${saved ? copy.saved : copy.save} ${copy.target}`}
        aria-pressed={saved}
        className="button-link button-link--ghost"
        type="button"
        onClick={() => void handleToggle()}
        disabled={loading}
      >
        {loading ? copy.saving : saved ? copy.saved : copy.save}
      </button>

      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
