'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/page-header';
import { SummaryStrip } from '@/features/reconciliation/components/summary-strip';
import { ConfidenceBar, StatusChip } from '@/features/reconciliation/components/status-chip';
import { useGenerateProposals, useWorklist } from '@/features/reconciliation/hooks/use-review';
import { formatCents, formatDate } from '@/features/reconciliation/lib/format';
import type { WorklistFilter } from '@/features/reconciliation/types';

const FILTERS: Array<{ value: WorklistFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'unmatched', label: 'Unmatched' },
];

const PAGE_SIZE = 25;

export default function ReconciliationPage() {
  const [filter, setFilter] = useState<WorklistFilter>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useWorklist(filter, page, PAGE_SIZE);
  const generate = useGenerateProposals();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reconciliation"
        subtitle="Every bank movement with a proposed counterpart. Review before anything posts."
        actions={
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {generate.isPending ? 'Matching…' : 'Match unmatched banks'}
          </button>
        }
      />

      <SummaryStrip />

      <div className="rounded-md border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
          <div className="flex items-center gap-1" role="tablist" aria-label="Status filter">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={filter === item.value}
                onClick={() => {
                  setFilter(item.value);
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium ${
                  filter === item.value
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {data ? (
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {data.total.toLocaleString()} rows · page {data.page} of {data.totalPages}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading worklist…</div>
        ) : isError || !data ? (
          <div className="px-4 py-10 text-center text-sm text-red-600">
            Could not load the worklist. Confirm you are signed in and the API is reachable.
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title={filter === 'unmatched' ? 'Nothing is unmatched' : 'No proposals here yet'}
            description={
              filter === 'all'
                ? 'Import bank transactions and ledger records to generate reconciliation proposals.'
                : `No items currently match the “${filter}” filter.`
            }
            actionHref="/import"
            actionLabel="Import data"
          />
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Best Match</th>
                <th className="px-3 py-2 font-semibold">Confidence</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.key} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70">
                  <td className="whitespace-nowrap px-3 py-2">
                    <StatusChip status={item.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs tabular-nums text-zinc-600">
                    {formatDate(item.date)}
                  </td>
                  <td className="max-w-[20rem] px-3 py-2">
                    <p className="truncate font-medium text-zinc-800" title={item.description}>
                      {item.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.vendor}
                      {item.reference ? ` · ${item.reference}` : ''}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[13px] tabular-nums text-zinc-900">
                    {formatCents(item.amountCents, item.currency)}
                  </td>
                  <td className="max-w-[16rem] px-3 py-2">
                    {item.bestMatch ? (
                      <span className="block truncate text-zinc-700" title={item.bestMatch.label}>
                        {item.bestMatch.label}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <ConfidenceBar score={item.score} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {item.proposalId ? (
                      <Link
                        href={`/reconciliation/${item.proposalId}`}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Review
                      </Link>
                    ) : (
                      <span className="text-xs italic text-zinc-400">no proposal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-40 hover:bg-zinc-50"
            >
              Previous
            </button>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              Page {page} / {data.totalPages}
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-40 hover:bg-zinc-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
