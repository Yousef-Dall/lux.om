import { AlertCircle, CheckCircle2, CircleDot, Sparkles } from 'lucide-react';

type CreationReadinessCheck = {
  key: string;
  title: string;
  description: string;
  done: boolean;
  critical?: boolean;
};

type CreationReadinessPanelProps = {
  title: string;
  description: string;
  completion: number;
  readyLabel: string;
  reviewLabel: string;
  checks: CreationReadinessCheck[];
  language: 'en' | 'ar';
};

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function CreationReadinessPanel({
  title,
  description,
  completion,
  readyLabel,
  reviewLabel,
  checks,
  language
}: CreationReadinessPanelProps) {
  const safeCompletion = clampPercent(completion);
  const completedCount = checks.filter((check) => check.done).length;
  const criticalOpenCount = checks.filter((check) => check.critical && !check.done).length;
  const optionalOpenCount = checks.length - completedCount - criticalOpenCount;

  return (
    <aside className="creation-readiness-panel" aria-label={title}>
      <div className="creation-readiness-panel__summary">
        <div>
          <p className="eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            {reviewLabel}
          </p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        <div className="creation-readiness-panel__score" aria-label={`${safeCompletion}% ${readyLabel}`}>
          <strong>{safeCompletion}%</strong>
          <span>{readyLabel}</span>
        </div>
      </div>

      <div className="creation-readiness-panel__progress" aria-hidden="true">
        <span style={{ width: `${safeCompletion}%` }} />
      </div>

      <ul className="creation-readiness-list">
        {checks.map((check) => {
          const Icon = check.done ? CheckCircle2 : check.critical ? AlertCircle : CircleDot;

          return (
            <li
              className={`creation-readiness-item${check.done ? ' is-done' : ''}${
                check.critical && !check.done ? ' is-critical' : ''
              }`}
              key={check.key}
            >
              <Icon size={17} aria-hidden="true" />
              <div>
                <strong>{check.title}</strong>
                <span>{check.description}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="creation-readiness-panel__footnote">
        {criticalOpenCount > 0
          ? language === 'ar'
            ? `${criticalOpenCount} عناصر أساسية تحتاج إكمال قبل مراجعة أسرع.`
            : `${criticalOpenCount} core items still need attention for faster review.`
          : optionalOpenCount > 0
            ? language === 'ar'
              ? 'الأساسيات جاهزة. أضف التحسينات الاختيارية لزيادة الثقة والتحويل.'
              : 'Core items are ready. Add optional upgrades to improve trust and conversion.'
            : language === 'ar'
              ? 'الإرسال يبدو جاهزاً لمراجعة قوية.'
              : 'This submission looks ready for a strong review.'}
      </p>
    </aside>
  );
}

export type { CreationReadinessCheck };
