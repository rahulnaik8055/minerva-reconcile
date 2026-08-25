import Link from 'next/link';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border pb-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-serif text-title font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-secondary leading-relaxed text-foreground-muted">
              {description}
            </p>
          ) : null}
          {meta}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-border-strong bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <p className="text-body font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-secondary text-foreground-muted">{description}</p>

      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex items-center rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-secondary font-medium text-foreground hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
