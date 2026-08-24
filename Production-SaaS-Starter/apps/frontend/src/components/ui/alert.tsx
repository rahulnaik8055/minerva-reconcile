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
        'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      {children}
    </div>
  );
}
