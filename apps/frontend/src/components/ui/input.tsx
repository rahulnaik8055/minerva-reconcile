import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(
          'flex h-9 w-full rounded-sm border bg-surface px-2.5 text-body text-foreground placeholder:text-foreground-muted/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-danger' : 'border-border-strong',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
