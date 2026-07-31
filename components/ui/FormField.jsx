import { useId } from 'react';
import { cn } from '@/lib/utils';

export default function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}) {
  const autoId = useId();
  const id = htmlFor || autoId;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint && !error ? `${id}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-secondary)]">
          {label}
          {required ? <span className="text-[var(--status-danger)]"> *</span> : null}
        </label>
      ) : null}
      {typeof children === 'function'
        ? children({ id, 'aria-invalid': !!error, 'aria-describedby': errorId || hintId })
        : children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-[var(--status-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...props }) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--surface-primary)] px-3 text-sm text-[var(--text-primary)]',
        'placeholder:text-[var(--text-muted)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)]',
        invalid
          ? 'border-[var(--status-danger)]'
          : 'border-[var(--border-default)]',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }) {
  return (
    <textarea
      className={cn(
        'min-h-[5rem] w-full rounded-[var(--radius-sm)] border bg-[var(--surface-primary)] px-3 py-2 text-sm text-[var(--text-primary)]',
        'placeholder:text-[var(--text-muted)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)]',
        invalid
          ? 'border-[var(--status-danger)]'
          : 'border-[var(--border-default)]',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-[var(--radius-sm)] border bg-[var(--surface-primary)] px-3 text-sm text-[var(--text-primary)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--focus-ring)]',
        invalid
          ? 'border-[var(--status-danger)]'
          : 'border-[var(--border-default)]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
