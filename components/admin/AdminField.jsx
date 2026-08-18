'use client';

import { cn } from '@/lib/utils';
import { tx } from '@/lib/i18n/runtime';

const baseControl =
  'w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-white px-3 py-2.5 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)] disabled:opacity-60';

function Label({ htmlFor, children, className, required }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('mb-1 block text-sm font-medium text-[var(--admin-text)]', className)}
    >
      {tx(children)}
      {required ? <span className="text-[var(--admin-danger)]"> *</span> : null}
    </label>
  );
}

function Hint({ children, className }) {
  return <p className={cn('mt-1 text-xs text-[var(--admin-text-muted)]', className)}>{tx(children)}</p>;
}

function Error({ children, className }) {
  if (!children) return null;
  return (
    <p className={cn('mt-1 text-xs text-[var(--admin-danger)]', className)} role="alert">
      {tx(children)}
    </p>
  );
}

function Input({ className, ...props }) {
  return <input className={cn(baseControl, 'h-11', className)} {...props} />;
}

function Select({ className, children, ...props }) {
  return (
    <select className={cn(baseControl, 'h-11', className)} {...props}>
      {children}
    </select>
  );
}

function Textarea({ className, ...props }) {
  return <textarea className={cn(baseControl, 'min-h-[6rem]', className)} {...props} />;
}

function Checkbox({ className, label, id, ...props }) {
  return (
    <label htmlFor={id} className={cn('inline-flex items-center gap-2 text-sm text-[var(--admin-text)]', className)}>
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
        {...props}
      />
      {tx(label)}
    </label>
  );
}

function Field({ label, htmlFor, required, error, hint, children, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {tx(label)}
        </Label>
      ) : null}
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
      <Error>{error}</Error>
    </div>
  );
}

const AdminField = Object.assign(Field, {
  Label,
  Hint,
  Error,
  Input,
  Select,
  Textarea,
  Checkbox,
});

export default AdminField;
