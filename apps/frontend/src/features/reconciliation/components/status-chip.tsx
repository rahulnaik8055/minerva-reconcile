import { cn } from '@/lib/utils';
import type { WorklistItemStatus } from '@/features/reconciliation/types';

const STATUS_STYLES: Record<WorklistItemStatus, { dot: string; text: string; ring: string }> = {
  pending: {
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    ring: 'ring-amber-200 bg-amber-50',
  },
  accepted: {
    dot: 'bg-emerald-600',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200 bg-emerald-50',
  },
  rejected: {
    dot: 'bg-red-500',
    text: 'text-red-700',
    ring: 'ring-red-200 bg-red-50',
  },
  unmatched: {
    dot: 'bg-zinc-400',
    text: 'text-zinc-600',
    ring: 'ring-zinc-200 bg-zinc-50',
  },
};

const LABELS: Record<WorklistItemStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  unmatched: 'Unmatched',
};

export function StatusChip({ status, className }: { status: WorklistItemStatus; className?: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.unmatched;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        style.ring,
        style.text,
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {LABELS[status]}
    </span>
  );
}

export function OutcomeChip({ outcome, className }: { outcome: string; className?: string }) {
  const neutral = outcome === 'exact_settlement_match';
  const negative = ['short_pay', 'missing_settlement', 'unexplained_variance'].includes(outcome);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 font-mono text-[11px] ring-1 ring-inset',
        neutral && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        !neutral && !negative && 'bg-sky-50 text-sky-700 ring-sky-200',
        negative && 'bg-red-50 text-red-700 ring-red-200',
        className,
      )}
    >
      {outcome}
    </span>
  );
}

export function ConfidenceBar({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="font-mono text-xs text-zinc-400">—</span>;
  }

  const percent = Math.round(score * 100);
  const tone = percent >= 90 ? 'bg-emerald-600' : percent >= 60 ? 'bg-amber-500' : 'bg-zinc-300';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-zinc-700">{percent}%</span>
    </div>
  );
}
