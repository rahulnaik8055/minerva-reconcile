import { cn } from '@/lib/utils';

interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div';
}

export function Panel({ as: Tag = 'section', className, ...props }: PanelProps) {
  return <Tag className={cn('rounded-md border border-border bg-surface', className)} {...props} />;
}

export function PanelHeader({
  title,
  actions,
  aside,
  className,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2',
        className,
      )}
    >
      {typeof title === 'string' ? <PanelLabel>{title}</PanelLabel> : title}
      {aside}
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PanelLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        'text-label font-semibold uppercase text-foreground-muted',
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3', className)} {...props} />;
}
