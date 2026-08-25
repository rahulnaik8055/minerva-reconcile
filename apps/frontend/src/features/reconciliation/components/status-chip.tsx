import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorklistItemStatus } from '@/features/reconciliation/types';

const STATUS_TONES: Record<WorklistItemStatus, { tone: 'warning' | 'success' | 'danger' | 'neutral'; label: string }> = {
  pending: { tone: 'warning', label: 'Needs review' },
  accepted: { tone: 'success', label: 'Matched' },
  rejected: { tone: 'danger', label: 'Rejected' },
  unmatched: { tone: 'neutral', label: 'Unmatched' },
};

export function StatusChip({ status, className }: { status: WorklistItemStatus; className?: string }) {
  const style = STATUS_TONES[status] ?? STATUS_TONES.unmatched;

  return (
    <Badge tone={style.tone} dot className={className}>
      {style.label}
    </Badge>
  );
}

const OUTCOME_LABELS: Record<string, string> = {
  exact_settlement_match: 'Exact match',
  short_pay: 'Short-pay',
  missing_settlement: 'Missing settlement',
  unexplained_variance: 'Unexplained variance',
  fee_variance: 'Fee variance',
  refund: 'Refund',
  excess_payment: 'Excess payment',
};

export function OutcomeChip({ outcome, className }: { outcome: string; className?: string }) {
  const neutral = outcome === 'exact_settlement_match';
  const negative = ['short_pay', 'missing_settlement', 'unexplained_variance'].includes(outcome);

  return (
    <Badge tone={neutral ? 'success' : negative ? 'danger' : 'info'} className={cn('text-meta tracking-tight', className)}>
      {OUTCOME_LABELS[outcome] ?? outcome}
    </Badge>
  );
}

export function ConfidenceBar({ score, className }: { score: number | null; className?: string }) {
  if (score === null) {
    return <span className="text-meta text-foreground-muted/60">—</span>;
  }

  const percent = Math.round(score * 100);
  const tone = percent >= 90 ? 'bg-success' : percent >= 60 ? 'bg-warning' : 'bg-border-strong';
  const label = percent >= 90 ? 'Strong' : percent >= 60 ? 'Review' : 'Weak';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span aria-hidden className="h-1 w-12 overflow-hidden rounded-full bg-surface-muted ring-1 ring-inset ring-border">
        <span className={`block h-full ${tone}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="tabular text-meta font-medium text-foreground">{percent}%</span>
      <span className="text-meta text-foreground-muted">{label}</span>
    </span>
  );
}
