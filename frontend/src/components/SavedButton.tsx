import { useState } from 'react';

import { saveActivity, saveListing, unsaveActivity, unsaveListing } from '../api/saved';
import { useAuth } from '../auth/AuthContext';

type SavedButtonProps = {
  targetId: string;
  targetType: 'listing' | 'activity';
  initiallySaved?: boolean;
};

export default function SavedButton({ targetId, targetType, initiallySaved = false }: SavedButtonProps) {
  const { token, isAuthenticated } = useAuth();
  const [saved, setSaved] = useState(initiallySaved);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    if (!token || !isAuthenticated || loading) return;

    setLoading(true);

    try {
      if (targetType === 'listing') {
        saved ? await unsaveListing(targetId, token) : await saveListing(targetId, token);
      } else {
        saved ? await unsaveActivity(targetId, token) : await saveActivity(targetId, token);
      }

      setSaved((current) => !current);
    } finally {
      setLoading(false);
    }
  }

  if (!isAuthenticated) return null;

  return (
    <button className="button-link button-link--ghost" type="button" onClick={handleToggle} disabled={loading}>
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
