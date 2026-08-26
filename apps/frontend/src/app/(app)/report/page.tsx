'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { StatusChip } from '@/features/reconciliation/components/status-chip';
import {
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_TYPE_TONE,
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_STATUS_TONE,
} from '@/features/reconciliation/lib/exception-meta';
import {
  buildDecisionsCsv,
  buildExceptionsCsv,
  buildReportJson,
  downloadFile,
} from '@/features/reconciliation/lib/report-export';
import { formatCents, formatDate, formatSignedCents } from '@/features/reconciliation/lib/format';
import { useActivity, useExceptions, useSummary, useWorklist } from '@/features/reconciliation/hooks/use-review';

export default function ReportPage() {
  const summary = useSummary();
  const accepted = useWorklist('accepted', 1, 100);
  const rejected = useWorklist('rejected', 1, 100);
  const exceptions = useExceptions();
  const activity = useActivity(undefined, 500);
  const [showExceptions, setShowExceptions] = useState(true);

  const decisions = useMemo(
    () =>
      [...(accepted.data?.items ?? []), ...(rejected.data?.items ?? [])]
        .filter((item) => item.status !== 'pending')
        .sort((a, b) => ((a.decidedAt ?? '') < (b.decidedAt ?? '') ? 1 : -1)),
    [accepted.data, rejected.data],
  );

  const aiAssistedCount = useMemo(() => {
    if (!activity.data?.entries) return 0;
    return activity.data.entries.filter(
      (entry) =>
        (entry.action === 'proposal.approved' ||
          entry.action === 'proposal.rejected' ||
          entry.action === 'proposal.overridden') &&
        entry.payload?.aiUsed === true,
    ).length;
  }, [activity.data]);

  const totalDecisions = useMemo(() => {
    if (!activity.data?.entries) return 0;
    return activity.data.entries.filter(
      (entry) =>
        entry.action === 'proposal.approved' ||
        entry.action === 'proposal.rejected' ||
        entry.action === 'proposal.overridden',
    ).length;
  }, [activity.data]);

  const s = summary.data;

  const stats = s
    ? [
        {
          label: 'Auto-matched',
          value: String(s.accepted),
          tone: 'text-success-text',
          hint: 'Engine matched, approved by reviewer',
        },
        {
          label: 'Human-decided',
          value: String(s.rejected + s.overridden),
          tone: 'text-warning-text',
          hint: 'Rejected or overridden decisions',
        },
        {
          label: 'AI-assisted',
          value: totalDecisions > 0 ? `${aiAssistedCount} of ${totalDecisions}` : '0',
          tone: 'text-info-text',
          hint: 'Decisions with AI advisory review',
        },
        {
          label: 'Still open',
          value: String(s.pending + s.unmatchedBankTransactions),
          tone: s.pending + s.unmatchedBankTransactions > 0 ? 'text-danger-text' : undefined,
          hint: 'Awaiting review or unmatched',
        },
        {
          label: 'Unresolved value',
          value: formatCents(Number(s.unresolvedValueCents)),
          tone: Number(s.unresolvedValueCents) > 0 ? 'text-danger-text' : undefined,
        },
      ]
    : [];

  const loading =
    summary.isLoading || accepted.isLoading || rejected.isLoading || exceptions.isLoading || activity.isLoading;

  function exportCsv(): void {
    if (decisions.length === 0) {
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const decisionsCsv = buildDecisionsCsv(decisions);
    const exceptionItems = exceptions.data?.items ?? [];
    const body =
      exceptionItems.length > 0
        ? `${decisionsCsv}\n\n${buildExceptionsCsv(exceptionItems)}`
        : decisionsCsv;

    downloadFile(`matchbook-report-${stamp}.csv`, body, 'text/csv');
  }

  function exportJson(): void {
    if (!s) {
      return;
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const json = buildReportJson(
      {
        totalBankTransactions: s.totalBankTransactions,
        accepted: s.accepted,
        rejected: s.rejected,
        overridden: s.overridden,
        unmatchedBankTransactions: s.unmatchedBankTransactions,
        unresolvedValueCents: s.unresolvedValueCents,
      },
      decisions,
      exceptions.data?.items ?? [],
    );

    downloadFile(`matchbook-report-${stamp}.json`, json, 'application/json');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report"
        description="Reviewed decisions only — pending proposals are excluded until a reviewer decides."
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="lg" onClick={exportCsv} disabled={loading || decisions.length === 0}>
              Export CSV
            </Button>
            <Button variant="outline" size="lg" onClick={exportJson} disabled={loading || !s}>
              Export JSON
            </Button>
          </div>
        }
      />

      {s ? (
        <dl className="flex flex-wrap overflow-hidden rounded-md border border-border bg-surface" data-testid="report-summary">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-36 flex-1 border-l border-border px-4 py-3 first:border-l-0 sm:px-5">
              <dt className="text-label font-semibold uppercase text-foreground-muted">{stat.label}</dt>
              <dd className={`tabular mt-1.5 font-serif text-title leading-none tracking-tight ${stat.tone ?? 'text-foreground'}`}>
                {stat.value}
              </dd>
              {'hint' in stat && stat.hint ? (
                <dd className="mt-1 text-meta text-foreground-muted">{stat.hint}</dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : loading ? (
        <p className="py-10 text-center text-secondary text-foreground-muted">Compiling report…</p>
      ) : (
        <p className="py-10 text-center text-secondary text-danger-text">Could not load report data.</p>
      )}

      {!loading && s !== undefined && s.accepted + s.rejected === 0 ? (
        <EmptyState
          title="No reviewed decisions yet"
          description="Approve or reject proposals in Reconciliation and this report will fill with the recorded outcomes."
          actionHref="/reconciliation"
          actionLabel="Open Reconciliation"
        />
      ) : decisions.length > 0 ? (
        <Panel className="overflow-hidden">
          <PanelHeader title={`${decisions.length} reviewed decision${decisions.length === 1 ? '' : 's'}`} />

          <TableWrap>
            <Table className="min-w-[36rem]">
              <thead>
                <tr>
                  <Th>Bank transaction</Th>
                  <Th className="hidden md:table-cell">Matched record</Th>
                  <Th numeric>Amount</Th>
                  <Th>Status</Th>
                  <Th className="hidden lg:table-cell">Reviewer</Th>
                  <Th numeric className="hidden sm:table-cell">Reviewed at</Th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((item) => (
                  <tr key={item.key} className="last:border-b-0 transition-colors hover:bg-surface-muted/60">
                    <Td className="max-w-56">
                      <Link
                        href={`/reconciliation/${item.proposalId}`}
                        className="block truncate font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        {item.description}
                      </Link>
                      <span className="tabular block truncate text-meta text-foreground-muted">
                        {formatDate(item.date)}
                        {item.reference ? ` · ${item.reference}` : ''}
                      </span>
                    </Td>
                    <Td className="hidden max-w-44 truncate md:table-cell" title={item.bestMatch?.label ?? ''}>
                      {item.bestMatch?.label ?? <span className="text-foreground-muted/50">—</span>}
                    </Td>
                    <Td numeric className="whitespace-nowrap font-medium">
                      {formatCents(item.amountCents, item.currency)}
                    </Td>
                    <Td>
                      <StatusChip status={item.status === 'accepted' ? 'accepted' : 'rejected'} />
                    </Td>
                    <Td className="hidden max-w-36 truncate lg:table-cell" title={item.decidedBy ?? ''}>
                      {item.decidedBy ?? <span className="text-foreground-muted/50">—</span>}
                    </Td>
                    <Td numeric className="hidden whitespace-nowrap tabular text-meta text-foreground-muted sm:table-cell">
                      {item.decidedAt ? formatDate(item.decidedAt) : '—'}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      ) : null}

      {!loading && (exceptions.data?.items.length ?? 0) > 0 ? (
        <Panel className="overflow-hidden">
          <PanelHeader
            title={`${exceptions.data!.items.length} exception${exceptions.data!.items.length === 1 ? '' : 's'}`}
            actions={
              <button
                type="button"
                onClick={() => setShowExceptions((current) => !current)}
                aria-expanded={showExceptions}
                className="print:hidden text-meta font-medium text-foreground-muted hover:text-foreground"
              >
                {showExceptions ? 'Hide' : 'Show'}
              </button>
            }
          />

          {showExceptions ? (
            <TableWrap>
              <Table className="min-w-[40rem]">
                <thead>
                  <tr>
                    <Th>Exception</Th>
                    <Th numeric>Amount</Th>
                    <Th className="hidden lg:table-cell">Evidence</Th>
                    <Th>Resolution</Th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.data!.items.map((item) => (
                    <tr key={item.id} className="last:border-b-0 transition-colors hover:bg-surface-muted/60">
                      <Td>
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <Badge tone={EXCEPTION_TYPE_TONE[item.exceptionType]} dot aria-hidden />
                          {EXCEPTION_TYPE_LABELS[item.exceptionType]}
                        </span>
                        <span className="block max-w-64 truncate text-meta text-foreground-muted" title={item.title}>
                          {item.title}
                        </span>
                      </Td>
                      <Td numeric className="whitespace-nowrap">
                        <span className="tabular block font-medium">{formatCents(item.amountCents, item.currency)}</span>
                        {item.varianceCents !== null ? (
                          <span
                            className={`tabular block text-meta ${
                              item.varianceCents === 0 ? 'text-success-text' : 'text-danger-text'
                            }`}
                          >
                            {formatSignedCents(item.varianceCents, item.currency)}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="hidden max-w-80 lg:table-cell">
                        {item.evidence.length > 0 ? (
                          <span
                            className="block truncate font-mono text-meta text-foreground-muted"
                            title={item.evidence.map((entry) => `${entry.label}: ${entry.detail}`).join('\n')}
                          >
                            {item.evidence[0]?.label.replace(/_/g, ' ')}: {item.evidence[0]?.detail}
                            {item.evidence.length > 1 ? ` (+${item.evidence.length - 1} more)` : ''}
                          </span>
                        ) : (
                          <span className="text-foreground-muted/50">—</span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={EXCEPTION_STATUS_TONE[item.status]}>
                          {EXCEPTION_STATUS_LABELS[item.status]}
                        </Badge>
                        {item.proposalId ? (
                          <Link
                            href={`/reconciliation/${item.proposalId}`}
                            className="ml-2 font-mono text-meta text-foreground-muted underline-offset-2 hover:text-primary hover:underline print:hidden"
                          >
                            proposal ↗
                          </Link>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
