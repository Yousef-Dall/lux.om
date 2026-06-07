import { forwardRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../utils/format';

type ButtonLinkVariant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'soft';

type ButtonLinkProps = LinkProps & {
  variant?: ButtonLinkVariant;
  isFullWidth?: boolean;
  isDisabled?: boolean;
};

const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      className,
      variant = 'primary',
      isFullWidth = false,
      isDisabled = false,
      'aria-disabled': ariaDisabled,
      tabIndex,
      onClick,
      ...props
    },
    ref
  ) => {
    return (
      <Link
        ref={ref}
        className={cn(
          'button-link',
          `button-link--${variant}`,
          isFullWidth && 'button-link--full',
          isDisabled && 'button-link--disabled',
          className
        )}
        aria-disabled={ariaDisabled ?? isDisabled}
        tabIndex={isDisabled ? -1 : tabIndex}
        onClick={(event) => {
          if (isDisabled) {
            event.preventDefault();
            return;
          }

          onClick?.(event);
        }}
        {...props}
      />
    );
  }
);

ButtonLink.displayName = 'ButtonLink';

export default ButtonLink;