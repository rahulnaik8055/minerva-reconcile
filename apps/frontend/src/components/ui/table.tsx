import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export function TableWrap({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('scrollbar-thin overflow-x-auto', className)}
      {...props}
    />
  );
}

export const Table = forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => {
    return (
      <table
        ref={ref}
        className={cn('w-full min-w-full border-collapse text-table', className)}
        {...props}
      />
    );
  },
);

Table.displayName = 'Table';

export function Th({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-border bg-surface-muted/70 px-3 py-2 text-label font-semibold uppercase text-foreground-muted',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-border/60 px-3 py-2 align-middle',
        numeric && 'text-right tabular',
        className,
      )}
      {...props}
    />
  );
}
