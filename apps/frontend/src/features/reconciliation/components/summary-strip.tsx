import { formatCents } from '../lib/format';
import { useSummary } from '../hooks/use-review';

function Stat({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'warning';
  hint?: string;
}) {
  return (
    <div className="flex min-w-[9.5rem] flex-1 flex-col justify-between border-l border-zinc-200 px-4 py-3 first:border-l-0">
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd
        className={`mt-2 font-mono text-xl tabular-nums leading-none ${
          tone === 'positive' ? 'text-emerald-700' : tone === 'warning' ? 'text-amber-700' : 'text-zinc-900'
        }`}
      >
        {value}
      </dd>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SummaryStrip() {
  const { data, isLoading, isError } = useSummary();

  if (isLoading) {
    return (
      <div className="flex rounded-md border border-zinc-200 bg-white" aria-busy>
        {[...Array(5)].map((_, index) => (
          <div key={index} className="min-w-[9.5rem] flex-1 border-r border-zinc-100 p-4 last:border-r-0">
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
            <div className="mt-3 h-5 w-12 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-muted-foreground">
        Summary is unavailable — confirm the API server is running and you are signed in.
      </div>
    );
  }

  return (
    <dl className="flex rounded-md border border-zinc-200 bg-white">
      <Stat label="Total" value={data.totalProposals.toLocaleString()} hint="proposals" />
      <Stat label="Matched" value={data.accepted.toLocaleString()} tone="positive" hint="accepted" />
      <Stat
        label="Needs Review"
        value={data.pending.toLocaleString()}
        tone={data.pending > 0 ? 'warning' : 'default'}
        hint="pending"
      />
      <Stat
        label="Unmatched"
        value={data.unmatchedBankTransactions.toLocaleString()}
        hint="no candidate found"
      />
      <Stat
        label="Unresolved Value"
        value={formatCents(Number(data.unresolvedValueCents))}
        tone={Number(data.unresolvedValueCents) > 0 ? 'warning' : 'positive'}
        hint="pending + unmatched exposure"
      />
    </dl>
  );
}
