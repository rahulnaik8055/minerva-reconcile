'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader, PanelLabel, EmptyState } from '@/components/layout/page-header';
import { StatusChip, ConfidenceBar } from '@/features/reconciliation/components/status-chip';
import {
  EXCEPTION_TYPE_DOT,
  EXCEPTION_TYPE_LABELS,
  exceptionStatusClasses,
  EXCEPTION_STATUS_LABELS,
} from '@/features/reconciliation/lib/exception-meta';
import {
  buildDecisionsCsv,
  buildExceptionsCsv,
  buildReportJson,
  downloadFile,
} from '@/features/reconciliation/lib/report-export';
import { formatCents, formatDate, formatSignedCents } from '@/features/reconciliation/lib/format';
import { useExceptions, useSummary, useWorklist } from '@/features/reconciliation/hooks/use-review';

function ExportButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function ReportPage() {
  const summary = useSummary();
  const accepted = useWorklist('accepted', 1, 100);
  const rejected = useWorklist('rejected', 1, 100);
  const exceptions = useExceptions();
  const [showExceptions, setShowExceptions] = useState(true);

  const decisions = useMemo(
    () =>
      [...(accepted.data?.items ?? []), ...(rejected.data?.items ?? [])]
        .filter((item) => item.status !== 'pending')
        .sort((a, b) => ((a.decidedAt ?? '') < (b.decidedAt ?? '') ? 1 : -1)),
    [accepted.data, rejected.data],
  );

  const s = summary.data;

  const stats = s
    ? [
        { label: 'Total transactions', value: String(s.totalBankTransactions) },
        { label: 'Accepted', value: String(s.accepted), tone: 'text-emerald-700' },
        { label: 'Rejected', value: String(s.rejected), tone: 'text-red-600' },
        { label: 'Overridden', value: String(s.overridden), tone: 'text-amber-600' },
        { label: 'Unmatched', value: String(s.unmatchedBankTransactions) },
        {
          label: 'Unresolved value',
          value: formatCents(Number(s.unresolvedValueCents)),
          tone: Number(s.unresolvedValueCents) > 0 ? 'text-red-600' : undefined,
        },
      ]
    : [];

  const loading =
    summary.isLoading || accepted.isLoading || rejected.isLoading || exceptions.isLoading;

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

    downloadFile(`reconcile-report-${stamp}.csv`, body, 'text/csv');
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

    downloadFile(`reconcile-report-${stamp}.json`, json, 'application/json');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Report"
        subtitle="Reviewed decisions only — pending proposals are excluded until a reviewer decides."
        actions={
          <div className="flex gap-2">
            <ExportButton label="Export CSV" onClick={exportCsv} disabled={loading || decisions.length === 0} />
            <ExportButton label="Export JSON" onClick={exportJson} disabled={loading || !s} />
          </div>
        }
      />

      {s ? (
        <dl className="flex flex-wrap rounded-md border border-zinc-200 bg-white">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-32 flex-1 border-l border-zinc-200 px-4 py-3 first:border-l-0">
              <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{stat.label}</dt>
              <dd className={`mt-1 font-mono text-xl tabular-nums ${stat.tone ?? 'text-zinc-900'}`}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Compiling report…</p>
      ) : (
        <p className="py-8 text-center text-sm text-red-600">Could not load report data.</p>
      )}

      {!loading && s !== undefined && s.accepted + s.rejected === 0 ? (
        <EmptyState
          title="No reviewed decisions yet"
          description="Approve or reject proposals in Reconciliation and this report will fill with the recorded outcomes."
          actionHref="/reconciliation"
          actionLabel="Open Reconciliation"
        />
      ) : decisions.length > 0 ? (
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <header className="border-b border-zinc-200 px-4 py-2">
            <PanelLabel>{decisions.length} reviewed decision(s)</PanelLabel>
          </header>

          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                <th className="px-4 py-2 font-semibold">Bank transaction</th>
                <th className="px-4 py-2 font-semibold">Matched record</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
                <th className="px-4 py-2 font-semibold">Confidence</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Rationale</th>
                <th className="px-4 py-2 font-semibold">Reviewer</th>
                <th className="px-4 py-2 font-semibold">Reviewed at</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((item) => (
                <tr key={item.key} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70">
                  <td className="max-w-56 px-4 py-2">
                    <Link
                      href={`/reconciliation/${item.proposalId}`}
                      className="block truncate font-medium text-zinc-800 underline-offset-2 hover:underline"
                    >
                      {item.description}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDate(item.date)}
                      {item.reference ? ` · ${item.reference}` : ''}
                    </span>
                  </td>
                  <td className="max-w-44 truncate px-4 py-2 text-zinc-700" title={item.bestMatch?.label ?? ''}>
                    {item.bestMatch?.label ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums text-zinc-900">
                    {formatCents(item.amountCents, item.currency)}
                  </td>
                  <td className="px-4 py-2">
                    {item.score !== null ? (
                      <span className="flex w-24 items-center gap-1.5">
                        <ConfidenceBar score={item.score} />
                        <span className="font-mono text-xs tabular-nums text-zinc-500">
                          {Math.round(item.score * 100)}%
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusChip status={item.status === 'accepted' ? 'accepted' : 'rejected'} />
                  </td>
                  <td className="max-w-56 px-4 py-2">
                    {item.rationaleText ? (
                      <span className="block truncate text-zinc-600" title={item.rationaleText}>
                        {item.rationaleText}
                      </span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="max-w-36 truncate px-4 py-2 text-zinc-700" title={item.decidedBy ?? ''}>
                    {item.decidedBy ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums text-zinc-600">
                    {item.decidedAt ? formatDate(item.decidedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {!loading && (exceptions.data?.items.length ?? 0) > 0 ? (
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
            <PanelLabel>{exceptions.data!.items.length} open exception(s)</PanelLabel>
            <button
              type="button"
              onClick={() => setShowExceptions((current) => !current)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              {showExceptions ? 'Hide' : 'Show'}
            </button>
          </header>

          {showExceptions ? (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  <th className="px-4 py-2 font-semibold">Exception</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 font-semibold">Evidence</th>
                  <th className="px-4 py-2 font-semibold">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.data!.items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5 font-medium text-zinc-800">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${EXCEPTION_TYPE_DOT[item.exceptionType]}`} />
                        {EXCEPTION_TYPE_LABELS[item.exceptionType]}
                      </span>
                      <span className="block max-w-64 truncate text-xs text-muted-foreground" title={item.title}>
                        {item.title}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums">
                      <span className="block text-zinc-900">{formatCents(item.amountCents, item.currency)}</span>
                      {item.varianceCents !== null ? (
                        <span
                          className={`block text-xs ${
                            item.varianceCents === 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {formatSignedCents(item.varianceCents, item.currency)}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-80 px-4 py-2">
                      {item.evidence.length > 0 ? (
                        <span
                          className="block truncate font-mono text-[11px] text-zinc-500"
                          title={item.evidence.map((entry) => `${entry.label}: ${entry.detail}`).join('\n')}
                        >
                          {item.evidence[0]?.label.replace(/_/g, ' ')}: {item.evidence[0]?.detail}
                          {item.evidence.length > 1 ? ` (+${item.evidence.length - 1} more)` : ''}
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span
                        className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${exceptionStatusClasses(item.status)}`}
                      >
                        {EXCEPTION_STATUS_LABELS[item.status]}
                      </span>
                      {item.proposalId ? (
                        <Link
                          href={`/reconciliation/${item.proposalId}`}
                          className="ml-2 font-mono text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                        >
                          proposal ↗
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Generated {new Date().toLocaleString()} · exports reflect persisted database state at time of export.
      </p>
    </div>
  );
}
