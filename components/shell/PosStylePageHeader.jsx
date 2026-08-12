import { cn } from '@/lib/utils';

/**
 * POS-matched module page header (Approach B visual parity).
 * Large title, muted subtitle, glass secondary action buttons on the right.
 */
export default function PosStylePageHeader({
  title,
  description,
  actions,
  className,
  children,
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center lg:mb-8',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
        {children}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>
      ) : null}
    </div>
  );
}

/** Secondary / outline action button matching POS header buttons. */
export function PosStyleHeaderButton({
  as: Comp = 'button',
  className,
  children,
  ...props
}) {
  return (
    <Comp
      className={cn(
        'inline-flex items-center rounded-lg border border-gray-300 bg-white/80 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition-all hover:bg-white hover:shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
