import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-1.5 py-0.5 font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-foreground ring-1 ring-inset ring-border',
        success: 'bg-success-bg text-success-text ring-1 ring-inset ring-success-border',
        warning: 'bg-warning-bg text-warning-text ring-1 ring-inset ring-warning-border',
        danger: 'bg-danger-bg text-danger-text ring-1 ring-inset ring-danger-border',
        info: 'bg-info-bg text-info-text ring-1 ring-inset ring-info-border',
        primary: 'bg-primary-muted text-primary ring-1 ring-inset ring-primary/20',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const DOT_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-foreground-muted/60',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  primary: 'bg-primary',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, dot, children, ...props }, ref) => {
    return (
      <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props}>
        {dot ? (
          <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONES[tone ?? 'neutral'])} />
        ) : null}
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';

export function badgeDotClass(tone: BadgeTone): string {
  return DOT_TONES[tone];
}
