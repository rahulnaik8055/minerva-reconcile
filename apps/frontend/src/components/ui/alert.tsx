import { cn } from '@/lib/utils';

interface AlertProps {
  children: React.ReactNode;
  className?: string;
}

export function Alert({ children, className }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-secondary text-danger-text',
        className,
      )}
    >
      {children}
    </div>
  );
}
