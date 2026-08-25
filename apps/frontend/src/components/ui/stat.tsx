import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<StatTone, string> = {
  default: 'text-foreground',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
};

export function StatBlock({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-[8.5rem] flex-1 border-l border-border px-4 py-3 first:border-l-0 sm:px-5',
        className,
      )}
    >
      <dt className="text-label font-semibold uppercase text-foreground-muted">{label}</dt>
      <dd
        className={cn(
          'tabular mt-1.5 font-serif text-lg leading-none tracking-tight',
          TONE_CLASSES[tone],
        )}
      >
        {value}
      </dd>
      {hint ? <p className="mt-1 text-meta text-foreground-muted">{hint}</p> : null}
    </div>
  );
}

export function StatRow({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDListElement>) {
  return (
    <dl
      className={cn('flex flex-wrap overflow-hidden rounded-md border border-border bg-surface', className)}
      {...props}
    >
      {children}
    </dl>
  );
}
