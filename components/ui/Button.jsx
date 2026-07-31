import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  primary:
    'bg-[var(--action-primary)] text-white hover:bg-[var(--action-primary-hover)] shadow-sm',
  secondary:
    'bg-[var(--surface-primary)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--surface-muted)]',
  tertiary: 'bg-transparent text-[var(--action-primary)] hover:bg-[var(--surface-muted)]',
  destructive: 'bg-[var(--status-danger)] text-white hover:opacity-90',
  ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]',
  link: 'bg-transparent text-[var(--action-primary)] underline-offset-2 hover:underline px-0',
};

const sizes = {
  compact: 'h-8 px-2.5 text-xs',
  standard: 'h-10 px-3.5 text-sm',
  large: 'h-11 px-4 text-base',
};

const Button = forwardRef(function Button(
  {
    children,
    className,
    variant = 'primary',
    size = 'standard',
    type = 'button',
    disabled,
    loading,
    fullWidth,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant] || variants.primary,
        sizes[size] || sizes.standard,
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : null}
      {children}
    </button>
  );
});

export default Button;

export const IconButton = forwardRef(function IconButton(
  { className, label, children, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="compact"
      className={cn('min-h-11 min-w-11 px-0', className)}
      aria-label={label}
      {...props}
    >
      {children}
    </Button>
  );
});
