import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

type AccessibleDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'medium' | 'large';
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export default function AccessibleDialog({
  open,
  title,
  description,
  closeLabel,
  children,
  onClose,
  size = 'medium',
  initialFocusRef,
  returnFocusRef
}: AccessibleDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const applicationRoot = document.getElementById('root');
    const previousAriaHidden = applicationRoot?.getAttribute('aria-hidden');
    const previousInert = applicationRoot?.inert ?? false;
    document.body.style.overflow = 'hidden';
    if (applicationRoot) {
      applicationRoot.inert = true;
      applicationRoot.setAttribute('aria-hidden', 'true');
    }

    let focusObserver: MutationObserver | null = null;

    const focusInitialTarget = () => {
      const target = initialFocusRef?.current;
      if (!target) return false;
      target.focus();
      return true;
    };

    const frame = window.requestAnimationFrame(() => {
      if (!focusInitialTarget()) (closeButtonRef.current ?? dialogRef.current)?.focus();
    });

    if (initialFocusRef && dialogRef.current) {
      focusObserver = new MutationObserver(() => {
        const target = initialFocusRef.current;
        if (!target || !dialogRef.current) return;
        const activeElement = document.activeElement;
        const canMoveFallbackFocus =
          activeElement === closeButtonRef.current
          || activeElement === dialogRef.current
          || !(activeElement instanceof Node)
          || !dialogRef.current.contains(activeElement);
        if (canMoveFallbackFocus) target.focus();
        focusObserver?.disconnect();
        focusObserver = null;
      });
      focusObserver.observe(dialogRef.current, { childList: true, subtree: true });
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      focusObserver?.disconnect();
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (applicationRoot) {
        applicationRoot.inert = previousInert;
        if (previousAriaHidden == null) applicationRoot.removeAttribute('aria-hidden');
        else applicationRoot.setAttribute('aria-hidden', previousAriaHidden);
      }
      const explicitReturnTarget = returnFocusRef?.current;
      if (explicitReturnTarget?.isConnected) explicitReturnTarget.focus();
      else if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [initialFocusRef, open, returnFocusRef]);

  if (!open) return null;

  return createPortal(
    <div className="accessible-dialog__backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCloseRef.current();
    }}>
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`accessible-dialog accessible-dialog--${size}`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="accessible-dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            aria-label={closeLabel}
            className="accessible-dialog__close"
            onClick={() => onCloseRef.current()}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="accessible-dialog__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}
