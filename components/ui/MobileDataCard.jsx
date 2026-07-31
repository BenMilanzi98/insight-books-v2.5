import { cn } from '@/lib/utils';

export default function MobileDataCard({ title, fields = [], actions, onClick, className }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 text-left shadow-[var(--shadow-card)]',
        onClick && 'hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]',
        className
      )}
    >
      {title ? (
        <div className="mb-2 text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      ) : null}
      <dl className="space-y-1.5">
        {fields.map((f, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <dt className="text-[var(--text-muted)]">{f.label}</dt>
            <dd className="text-right font-medium text-[var(--text-primary)]">{f.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </Comp>
  );
}
