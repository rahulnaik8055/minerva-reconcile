import { StatBlock, StatRow, type StatTone } from '@/components/ui/stat';
import { formatCents } from '../lib/format';
import { useSummary } from '../hooks/use-review';

export function SummaryStrip() {
  const { data, isLoading, isError } = useSummary();

  if (isLoading) {
    return (
      <StatRow aria-busy>
        {[...Array(5)].map((_, index) => (
          <div key={index} className="min-w-[8.5rem] flex-1 border-l border-border px-4 py-3 first:border-l-0 sm:px-5">
            <div className="h-2.5 w-16 animate-pulse rounded-sm bg-surface-muted" />
            <div className="mt-3 h-5 w-14 animate-pulse rounded-sm bg-surface-muted" />
          </div>
        ))}
      </StatRow>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-dashed border-border-strong bg-surface px-4 py-5 text-center text-secondary text-foreground-muted">
        Summary is unavailable — confirm the API server is running and you are signed in.
      </div>
    );
  }

  const unresolvedValue = Number(data.unresolvedValueCents);

  return (
    <StatRow data-testid="summary-strip">
      <StatBlock label="Total" value={data.totalProposals.toLocaleString()} hint="proposals" />
      <StatBlock label="Matched" value={data.accepted.toLocaleString()} tone="success" hint="accepted" />
      <StatBlock
        label="Needs review"
        value={data.pending.toLocaleString()}
        tone={data.pending > 0 ? 'warning' : 'default'}
        hint="pending"
      />
      <StatBlock
        label="Unmatched"
        value={data.unmatchedBankTransactions.toLocaleString()}
        hint="no candidate found"
      />
      <StatBlock
        label="Unresolved value"
        value={formatCents(unresolvedValue)}
        tone={(unresolvedValue > 0 ? 'warning' : 'success') as StatTone}
        hint="pending + unmatched exposure"
      />
    </StatRow>
  );
}
