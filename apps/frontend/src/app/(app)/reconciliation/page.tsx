'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader, EmptyState } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { SummaryStrip } from '@/features/reconciliation/components/summary-strip';
import { ConfidenceBar, StatusChip } from '@/features/reconciliation/components/status-chip';
import { useGenerateProposals, useWorklist } from '@/features/reconciliation/hooks/use-review';
import { formatCents, formatDate } from '@/features/reconciliation/lib/format';
import type { WorklistFilter } from '@/features/reconciliation/types';

const FILTERS: Array<{ value: WorklistFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Needs review' },
  { value: 'accepted', label: 'Matched' },
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
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation"
        description="Every bank movement with a proposed counterpart. Review before anything posts."
        actions={
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            size="lg"
            className="print:hidden"
          >
            {generate.isPending ? 'Matching…' : 'Match unmatched banks'}
          </Button>
        }
      />

      <SummaryStrip />

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-3 pt-2 sm:px-4">
          <div
            className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin"
            role="tablist"
            aria-label="Status filter"
          >
            {FILTERS.map((item) => {
              const active = filter === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setFilter(item.value);
                    setPage(1);
                  }}
                  className={`whitespace-nowrap border-b-2 px-2.5 py-2 text-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? 'border-foreground font-semibold text-foreground'
                      : 'border-transparent font-medium text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {data ? (
            <p className="hidden pb-2 tabular text-meta text-foreground-muted sm:block">
              {data.total.toLocaleString()} rows · page {data.page} of {data.totalPages}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="px-4 py-12 text-center text-secondary text-foreground-muted" aria-busy>
            Loading worklist…
          </div>
        ) : isError || !data ? (
          <div className="px-4 py-12 text-center text-secondary text-danger-text">
            Could not load the worklist. Confirm you are signed in and the API is reachable.
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            className="rounded-none border-0"
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
          <TableWrap>
            <Table className="min-w-[34rem] md:min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>Transaction</Th>
                  <Th numeric className="min-w-28">
                    Amount
                  </Th>
                  <Th className="hidden md:table-cell">Proposed match</Th>
                  <Th className="hidden xl:table-cell">Confidence</Th>
                  <Th numeric>Action</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.key}
                    className="group transition-colors last:border-b-0 hover:bg-surface-muted/60"
                  >
                    <Td className="whitespace-nowrap">
                      <StatusChip status={item.status} />
                    </Td>
                    <Td className="whitespace-nowrap tabular text-meta text-foreground-muted">
                      {formatDate(item.date)}
                    </Td>
                    <Td className="max-w-72">
                      <p className="truncate font-medium text-foreground" title={item.description}>
                        {item.description}
                      </p>
                      <p className="truncate text-meta text-foreground-muted">
                        {item.vendor}
                        {item.reference ? ` · ${item.reference}` : ''}
                      </p>
                    </Td>
                    <Td numeric className="whitespace-nowrap font-medium text-foreground">
                      {formatCents(item.amountCents, item.currency)}
                    </Td>
                    <Td className="hidden max-w-64 md:table-cell">
                      {item.bestMatch ? (
                        <span
                          className="block truncate text-foreground"
                          title={item.bestMatch.label}
                        >
                          {item.bestMatch.label}
                        </span>
                      ) : (
                        <span className="text-foreground-muted/60">—</span>
                      )}
                    </Td>
                    <Td className="hidden whitespace-nowrap xl:table-cell">
                      <ConfidenceBar score={item.score} />
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {item.proposalId ? (
                        <Link
                          href={`/reconciliation/${item.proposalId}`}
                          className="inline-flex rounded-sm border border-border-strong bg-surface px-2.5 py-1 text-meta font-medium text-foreground hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Review ${item.description}`}
                        >
                          Review
                        </Link>
                      ) : item.bestMatch ? (
                        <span className="text-meta italic text-foreground-muted">no proposal</span>
                      ) : (
                        <span className="text-meta text-foreground-muted/60">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 sm:px-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="tabular text-meta text-foreground-muted">
              Page {page} / {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
