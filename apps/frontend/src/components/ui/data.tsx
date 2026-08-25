import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Num({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('tabular', className)} {...props} />;
}

export interface FieldListItem {
  label: string;
  value: React.ReactNode;
}

export function FieldList({
  items,
  className,
}: {
  items: FieldListItem[];
  className?: string;
}) {
  return (
    <dl className={cn('text-secondary', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-4 border-b border-border/70 py-1.5 last:border-b-0"
        >
          <dt className="shrink-0 text-meta uppercase tracking-wide text-foreground-muted">
            {item.label}
          </dt>
          <dd className="min-w-0 break-words text-right font-medium text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AiAssistNote({
  title = 'AI-assisted analysis',
  note = 'Verify against source evidence',
  variant = 'advisory',
  className,
}: {
  title?: string;
  note?: string;
  variant?: 'advisory' | 'drafted';
  className?: string;
}) {
  if (variant === 'drafted') {
    return (
      <p
        className={cn(
          'inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-sm border border-warning-border bg-warning-bg px-2 py-1',
          className,
        )}
      >
        <span className="text-label font-semibold uppercase text-warning-text">{title}</span>
        <span className="text-meta text-foreground-muted">{note}</span>
      </p>
    );
  }

  return (
    <p
      className={cn(
        'inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-sm border border-info-border bg-info-bg px-2 py-1',
        className,
      )}
    >
      <span className="text-label font-semibold uppercase text-info-text">{title}</span>
      <span className="text-meta text-foreground-muted">{note}</span>
    </p>
  );
}

export function AiAssistSection({
  title = 'AI assist',
  unavailable = false,
  children,
  className,
}: {
  title?: string;
  unavailable?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-md border border-info-border/60 bg-info-bg/30',
        unavailable && 'border-border border-dashed bg-transparent',
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-info-border/40 px-4 py-2">
        <Sparkles className="h-3.5 w-3.5 text-info-text" aria-hidden />
        <span className="text-label font-semibold uppercase text-info-text">{title}</span>
        {unavailable ? (
          <span className="ml-auto text-meta text-foreground-muted">AI assist unavailable</span>
        ) : (
          <span className="ml-auto text-meta text-foreground-muted">Advisory only</span>
        )}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}
