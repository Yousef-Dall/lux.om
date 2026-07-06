import { Clock3, RefreshCw, WifiOff } from 'lucide-react';

export type OperationalStatusLanguage = 'en' | 'ar';

type OperationalStatusPanelProps = {
  language: OperationalStatusLanguage;
  updatedAt?: Date | null;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  refreshLabel?: string;
  title?: string;
  description?: string;
  className?: string;
};

function formatUpdatedAt(value: Date | null | undefined, language: OperationalStatusLanguage) {
  if (!value) return language === 'ar' ? 'لم يتم التحديث بعد' : 'Not refreshed yet';

  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-OM' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short'
  }).format(value);
}

export default function OperationalStatusPanel({
  language,
  updatedAt,
  loading = false,
  error = '',
  onRefresh,
  refreshLabel,
  title,
  description,
  className = ''
}: OperationalStatusPanelProps) {
  const copy =
    language === 'ar'
      ? {
          title: 'حالة البيانات المباشرة',
          description: 'تعرض هذه اللوحة آخر نسخة تم تحميلها وتتيح تحديثاً آمناً بدون مغادرة مساحة العمل.',
          lastUpdated: 'آخر تحديث',
          refreshing: 'جاري التحديث...',
          refresh: 'تحديث',
          error: 'تعذر تحديث البيانات. يتم عرض آخر نسخة متاحة.'
        }
      : {
          title: 'Live data status',
          description: 'This panel shows the latest loaded snapshot and supports a safe refresh without leaving the workspace.',
          lastUpdated: 'Last refreshed',
          refreshing: 'Refreshing...',
          refresh: 'Refresh',
          error: 'Could not refresh data. Showing the latest available snapshot.'
        };

  const panelClass = ['operational-status-panel', className].filter(Boolean).join(' ');

  return (
    <aside className={panelClass} aria-live="polite">
      <div className="operational-status-panel__content">
        <span className="operational-status-panel__icon" aria-hidden="true">
          {error ? <WifiOff size={18} /> : <Clock3 size={18} />}
        </span>

        <div>
          <strong>{title ?? copy.title}</strong>
          <p>{description ?? copy.description}</p>
          <small>
            {loading ? copy.refreshing : `${copy.lastUpdated}: ${formatUpdatedAt(updatedAt, language)}`}
          </small>
          {error ? <small className="operational-status-panel__error">{error || copy.error}</small> : null}
        </div>
      </div>

      {onRefresh ? (
        <button
          className="button-link button-link--secondary operational-status-panel__button"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {loading ? copy.refreshing : refreshLabel ?? copy.refresh}
        </button>
      ) : null}
    </aside>
  );
}
