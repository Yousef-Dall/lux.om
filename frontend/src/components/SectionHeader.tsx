import type { ReactNode } from 'react';
import { cn } from '../utils/format';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  level?: 1 | 2 | 3;
  actions?: ReactNode;
  className?: string;
};

export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  level = 2,
  actions,
  className
}: SectionHeaderProps) {
  const HeadingTag = `h${level}` as const;

  return (
    <header
      className={cn(
        'section-header',
        `section-header--${align}`,
        Boolean(actions) && 'section-header--with-actions',
        className
      )}
    >
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <HeadingTag>{title}</HeadingTag>
        {description ? <p>{description}</p> : null}
      </div>

      {actions ? <div className="section-header__actions">{actions}</div> : null}
    </header>
  );
}