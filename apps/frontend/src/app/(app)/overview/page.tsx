'use client';

import Link from 'next/link';
import { PageHeader, EmptyState } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { SummaryStrip } from '@/features/reconciliation/components/summary-strip';
import {
  useActivity,
  useExceptions,
  useWorklist,
} from '@/features/reconciliation/hooks/use-review';
import { formatCents, formatDate, formatDateTime } from '@/features/reconciliation/lib/format';
import { StatusChip, OutcomeChip } from '@/features/reconciliation/components/status-chip';

export default function OverviewPage() {
  const worklist = useWorklist('all', 1, 8);
  const activity = useActivity(undefined, 6);
  const exceptions = useExceptions();

  const pendingExceptionCount = exceptions.data?.exceptionCount ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Current state of the reconciliation cycle. Nothing posts without a human decision."
        actions={
          <Link href="/reconciliation" className="print:hidden">
            <Button size="lg">Open Reconciliation</Button>
          </Link>
        }
      />

      <SummaryStrip />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Panel className="overflow-hidden lg:col-span-2">
          <PanelHeader
            title="Latest items awaiting or receiving decisions"
            actions={
              <Link
                href="/reconciliation"
                className="text-meta font-medium text-foreground-muted hover:text-foreground"
              >
                View all →
              </Link>
            }
          />

          {worklist.isLoading ? (
            <p className="px-4 py-10 text-center text-secondary text-foreground-muted" aria-busy>
              Loading…
            </p>
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
            <TableWrap>
              <Table className="min-w-[30rem]">
                <thead>
                  <tr>
                    <Th>Status</Th>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th numeric>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {(worklist.data?.items ?? []).map((item) => (
                    <tr
                      key={item.key}
                      className="last:border-b-0 transition-colors hover:bg-surface-muted/60"
                    >
                      <Td>
                        <StatusChip status={item.status} />
                      </Td>
                      <Td className="whitespace-nowrap tabular text-meta text-foreground-muted">
                        {formatDate(item.date)}
                      </Td>
                      <Td className="max-w-[18rem] truncate font-medium text-foreground">
                        {item.description}
                      </Td>
                      <Td numeric className="whitespace-nowrap font-medium">
                        {formatCents(item.amountCents, item.currency)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Activity"
            actions={
              <Link
                href="/activity"
                className="text-meta font-medium text-foreground-muted hover:text-foreground"
              >
                Full log →
              </Link>
            }
          />

          <p className="mx-3 mt-3 rounded-sm border px-3 py-2 text-meta font-medium border-success-border bg-success-bg text-success-text">
            {activity.data?.verification.valid
              ? `Audit chain verified · ${activity.data?.verification.checkedCount ?? 0} entries`
              : 'Audit chain broken — investigate in Activity'}
          </p>

          <ul className="divide-y divide-border/60 p-3">
            {(activity.data?.entries ?? [])
              .slice()
              .reverse()
              .slice(0, 5)
              .map((entry) => (
                <li key={entry.id} className="py-2 first:pt-0 last:pb-0">
                  <p className="text-secondary font-medium text-foreground">{entry.action}</p>
                  <p className="mt-0.5 text-meta text-foreground-muted">
                    {entry.actor} · {formatDateTime(entry.timestamp)}
                  </p>
                  {entry.payload?.reason ? (
                    <p className="mt-0.5 truncate text-meta italic text-foreground-muted">
                      "{String(entry.payload.reason)}"
                    </p>
                  ) : null}
                </li>
              ))}
            {(activity.data?.entries.length ?? 0) === 0 ? (
              <li className="py-4 text-center text-secondary text-foreground-muted">
                No activity recorded yet.
              </li>
            ) : null}
          </ul>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Settlement exceptions"
          aside={
            <span className="tabular text-meta text-foreground-muted">
              {pendingExceptionCount !== null
                ? `${exceptions.data?.exceptionCount} exception(s) of ${exceptions.data?.totalSettlements} settlement(s)`
                : ''}
            </span>
          }
          actions={
            <Link
              href="/exceptions"
              className="text-meta font-medium text-foreground-muted hover:text-foreground"
            >
              Investigate →
            </Link>
          }
        />

        {(exceptions.data?.items.length ?? 0) === 0 ? (
          <p className="px-4 py-8 text-center text-secondary text-foreground-muted">
            No open settlement exceptions.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(exceptions.data?.items ?? []).slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-secondary font-medium text-foreground">
                    {item.provider}
                    {item.settlementReference ? ` · ${item.settlementReference}` : ''}
                  </p>
                  <p className="truncate text-meta text-foreground-muted">{item.explanation}</p>
                </div>
                {item.outcome ? <OutcomeChip outcome={item.outcome} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
