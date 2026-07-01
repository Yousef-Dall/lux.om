import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type Check = {
  file: string;
  label: string;
  mustInclude: string[];
};

const checks: Check[] = [
  {
    file: 'src/App.tsx',
    label: 'route announcements, skip target focus, and reduced-motion scrolling',
    mustInclude: [
      'function RouteAnnouncer',
      'aria-live="polite"',
      '<RouteAnnouncer />',
      '<main id="main-content" tabIndex={-1}>',
      'prefers-reduced-motion: reduce'
    ]
  },
  {
    file: 'src/components/Navbar.tsx',
    label: 'mobile navigation Escape-key close behavior',
    mustInclude: [
      "event.key === 'Escape'",
      "document.addEventListener('keydown', handleKeyDown)"
    ]
  },
  {
    file: 'src/components/NotificationBell.tsx',
    label: 'notification popover dialog semantics and live states',
    mustInclude: [
      'notification-bell-panel',
      'aria-controls={isOpen ? panelId : undefined}',
      'role="dialog"',
      'aria-busy={loading}',
      'aria-live="polite"'
    ]
  },
  {
    file: 'src/components/ReportModal.tsx',
    label: 'report modal focus restoration, Escape close, and scroll lock',
    mustInclude: [
      'triggerRef',
      'closeButtonRef',
      "document.body.style.overflow = 'hidden'",
      "event.key === 'Escape'",
      'aria-modal="true"'
    ]
  },
  {
    file: 'src/components/SavedButton.tsx',
    label: 'saved button pressed state and accessible errors',
    mustInclude: [
      'aria-pressed=',
      'role="alert"'
    ]
  },
  {
    file: 'src/components/ReviewSection.tsx',
    label: 'review loading/error/empty announcements',
    mustInclude: [
      'aria-busy=',
      'role="status"',
      'role="alert"'
    ]
  },
  {
    file: 'src/pages/Notifications.tsx',
    label: 'notification center loading/error/empty announcements',
    mustInclude: [
      'aria-busy=',
      'role="status"',
      'role="alert"'
    ]
  },
  {
    file: 'src/styles/foundation.css',
    label: 'global focus-visible, reduced-motion, and touch-target polish',
    mustInclude: [
      ':focus-visible',
      '@media (prefers-reduced-motion: reduce)',
      'scroll-behavior: auto'
    ]
  },
  {
    file: 'src/styles/pages.css',
    label: 'mobile notification popover/dialog polish',
    mustInclude: [
      '.notification-bell__panel',
      '@media (max-width: 640px)'
    ]
  }
];

let failed = false;

for (const check of checks) {
  const filePath = join(process.cwd(), check.file);

  if (!existsSync(filePath)) {
    console.error(`✗ ${check.label}: missing ${check.file}`);
    failed = true;
    continue;
  }

  const content = readFileSync(filePath, 'utf8');
  const missing = check.mustInclude.filter((token) => !content.includes(token));

  if (missing.length > 0) {
    console.error(`✗ ${check.label}: ${check.file} is missing ${missing.join(', ')}`);
    failed = true;
    continue;
  }

  console.log(`✓ ${check.label}`);
}

if (failed) {
  process.exit(1);
}

console.log('[lux.om] Frontend accessibility/mobile polish verification passed.');
