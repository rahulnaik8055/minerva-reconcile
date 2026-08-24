'use client';

import Link from 'next/link';
import { PageHeader, PanelLabel, EmptyState } from '@/components/layout/page-header';
import { SummaryStrip } from '@/features/reconciliation/components/summary-strip';
import { useActivity, useExceptions, useWorklist } from '@/features/reconciliation/hooks/use-review';
import { formatCents, formatDate, formatDateTime } from '@/features/reconciliation/lib/format';
import { StatusChip, OutcomeChip } from '@/features/reconciliation/components/status-chip';

function ShortHash({ hash }: { hash: string }) {
  return (
    <code className="rounded-sm bg-zinc-100 px-1 py-0.5 font-mono text-[11px] text-zinc-500" title={hash}>
      {hash.slice(0, 10)}…
    </code>
  );
}

export default function OverviewPage() {
  const worklist = useWorklist('all', 1, 8);
  const activity = useActivity(undefined, 6);
  const exceptions = useExceptions();

  const pendingExceptionCount = exceptions.data?.exceptionCount ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        subtitle="Current state of the reconciliation cycle. Nothing posts without a human decision."
        actions={
          <Link
            href="/reconciliation"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-zinc-700"
          >
            Open Reconciliation
          </Link>
        }
      />

      <SummaryStrip />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-md border border-zinc-200 bg-white lg:col-span-2">
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
            <PanelLabel>Latest items awaiting or receiving decisions</PanelLabel>
            <Link href="/reconciliation" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
              View all →
            </Link>
          </header>

          {worklist.isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (worklist.data?.items.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No imported data yet"
                description="Import a bank CSV and ledger CSV to produce reconciliation proposals."
                actionHref="/import"
                actionLabel="Go to Import"
              />
            </div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(worklist.data?.items ?? []).map((item) => (
                  <tr key={item.key} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70">
                    <td className="px-3 py-1.5"><StatusChip status={item.status} /></td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs tabular-nums text-zinc-600">
                      {formatDate(item.date)}
                    </td>
                    <td className="max-w-[18rem] truncate px-3 py-1.5 font-medium text-zinc-800">{item.description}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums">
                      {formatCents(item.amountCents, item.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-md border border-zinc-200 bg-white">
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
            <PanelLabel>Activity</PanelLabel>
            <Link href="/activity" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
              Full log →
            </Link>
          </header>

          {activity.data && !activity.data.verification.valid ? (
            <p className="mx-3 mt-3 rounded-sm bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
              Audit chain verification FAILED — the log may have been tampered with.
            </p>
          ) : (
            <p className="mx-3 mt-3 rounded-sm bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Audit chain verified ({activity.data?.verification.checkedCount ?? 0} entries).
            </p>
          )}

          <ul className="divide-y divide-zinc-100 p-3">
            {(activity.data?.entries ?? []).slice().reverse().slice(0, 5).map((entry) => (
              <li key={entry.id} className="py-2 first:pt-0 last:pb-0">
                <p className="text-[13px] font-medium text-zinc-800">{entry.action}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {entry.actor} · {formatDateTime(entry.timestamp)} · <ShortHash hash={entry.hash} />
                </p>
                {entry.payload?.reason ? (
                  <p className="mt-0.5 truncate text-xs italic text-zinc-500">“{String(entry.payload.reason)}”</p>
                ) : null}
              </li>
            ))}
            {(activity.data?.entries.length ?? 0) === 0 ? (
              <li className="py-4 text-center text-sm text-muted-foreground">No activity recorded yet.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="rounded-md border border-zinc-200 bg-white">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
          <PanelLabel>Settlement exceptions</PanelLabel>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {pendingExceptionCount !== null
              ? `${exceptions.data?.exceptionCount} exception(s) of ${exceptions.data?.totalSettlements} settlement(s)`
              : ''}
          </span>
        </header>

        {(exceptions.data?.items.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No open settlement exceptions.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {(exceptions.data?.items ?? []).slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-zinc-800">
                    {item.provider}
                    {item.settlementReference ? ` · ${item.settlementReference}` : ''}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.explanation}</p>
                </div>
                {item.outcome ? <OutcomeChip outcome={item.outcome} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
