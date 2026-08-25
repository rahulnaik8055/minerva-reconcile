'use client';

import Link from 'next/link';
import { AiAssistNote, Num } from '@/components/ui/data';
import { Badge } from '@/components/ui/badge';
import { PanelLabel } from '@/components/ui/panel';
import { ConfidenceBar } from '../status-chip';
import {
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_STATUS_TONE,
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_TYPE_TONE,
  causeLabel,
  isSupportedCause,
} from '../../lib/exception-meta';
import { formatCents, formatDate, formatSignedCents } from '../../lib/format';
import type { ExceptionItem, ExceptionRelatedRecord } from '../../types';

function MoneyFigure({
  label,
  cents,
  currency,
  emphasis = false,
}: {
  label: string;
  cents: number | null;
  currency: string;
  emphasis?: boolean;
}) {
  const tone =
    cents === null || cents === 0
      ? 'text-foreground'
      : cents < 0
        ? 'text-danger-text'
        : emphasis
          ? 'text-foreground'
          : 'text-foreground';

  return (
    <div className="min-w-0">
      <p className="text-label font-semibold uppercase text-foreground-muted">{label}</p>
      <Num
        className={`mt-1 truncate font-serif tracking-tight ${
          emphasis ? 'text-lg font-semibold sm:text-xl' : 'text-base font-medium'
        } ${tone}`}
      >
        {cents === null ? '—' : formatCents(cents, currency)}
      </Num>
    </div>
  );
}

function ExplanationBlock({ causes }: { causes: ExceptionItem['causes'] }) {
  if (causes.length === 0) {
    return null;
  }

  const supported = causes.filter((cause) => isSupportedCause(cause.causeType));

  if (supported.length > 0) {
    const primary = supported[0]!;

    return (
      <section className="rounded-sm border border-info-border bg-info-bg px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PanelLabel>Supported explanation</PanelLabel>
          <AiAssistNote />
        </div>

        <div className="mt-3 space-y-2">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-body font-semibold text-foreground">
              {causeLabel(primary.causeType)}
            </span>
            {primary.amountCents !== null ? (
              <Num className="font-serif text-base font-semibold text-warning-text">
                {formatSignedCents(primary.amountCents)}
              </Num>
            ) : null}
          </p>

          <p className="text-secondary leading-relaxed text-foreground-muted">
            {primary.description}
          </p>

          {primary.target ? <RelatedChip record={primary.target} /> : null}

          {supported.length > 1 ? (
            <ul className="space-y-1 border-t border-info-border pt-2">
              {supported.slice(1).map((cause, index) => (
                <li key={index} className="text-meta text-foreground-muted">
                  {causeLabel(cause.causeType)}: {cause.description}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-sm border border-dashed border-border-strong bg-surface-muted px-4 py-3">
      <PanelLabel>Supported explanation</PanelLabel>
      <p className="mt-1.5 text-secondary italic text-foreground-muted">
        No supported explanation in the imported records — this variance is unexplained.
      </p>
    </section>
  );
}

function RelatedChip({ record }: { record: ExceptionRelatedRecord }) {
  if (record.sourceType === 'proposal') {
    return (
      <Link
        href={`/reconciliation/${record.recordId}`}
        className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-meta text-foreground hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {record.label} ↗
      </Link>
    );
  }

  return <span className="inline-flex items-center rounded-sm border border-border bg-surface px-2 py-1 font-mono text-meta text-foreground-muted">{record.label}</span>;
}

export function InvestigationPanel({
  item,
  onOpenRecord,
}: {
  item: ExceptionItem;
  onOpenRecord: (target: ExceptionRelatedRecord) => void;
}) {
  const actualCents =
    item.settlement !== null && item.varianceCents !== null
      ? item.settlement.expectedNetCents + item.varianceCents
      : null;

  const breakdownRows: Array<{ label: string; cents: number }> = item.settlement
    ? [
        { label: 'Gross', cents: item.settlement.grossCents },
        { label: 'Fees', cents: item.settlement.feesCents },
        { label: 'Refunds', cents: item.settlement.refundsCents },
        { label: 'Deductions', cents: item.settlement.deductionsCents },
        { label: 'Adjustments', cents: item.settlement.adjustmentsCents },
      ]
    : [];

  const hasVariance = item.varianceCents !== null && item.varianceCents !== 0;

  return (
    <article className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
      <header className="space-y-3 px-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={EXCEPTION_TYPE_TONE[item.exceptionType]} dot className="uppercase">
            {EXCEPTION_TYPE_LABELS[item.exceptionType]}
          </Badge>
          <Badge tone={EXCEPTION_STATUS_TONE[item.status]}>
            {EXCEPTION_STATUS_LABELS[item.status]}
          </Badge>
          {item.outcome ? (
            <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-meta text-foreground-muted ring-1 ring-inset ring-border">
              {item.outcome}
            </span>
          ) : null}
          {item.confidence !== null ? (
            <span className="ml-auto flex items-center gap-2">
              <ConfidenceBar score={item.confidence} />
            </span>
          ) : null}
        </div>

        <div>
          <h2 className="font-serif text-title font-semibold tracking-tight text-foreground">
            {item.title}
          </h2>
          <p className="mt-0.5 tabular text-secondary text-foreground-muted">
            {[
              item.provider,
              item.settlementReference,
              formatDate(item.date),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {item.detail ? (
          <p className="pb-4 text-secondary leading-relaxed text-foreground-muted">{item.detail}</p>
        ) : (
          <div className="pb-1" />
        )}
      </header>

      {item.settlement ? (
        <section className="px-4 py-4 sm:px-5">
          <PanelLabel>Settlement breakdown</PanelLabel>
          <table className="mt-2 w-full max-w-md text-table">
            <tbody>
              {breakdownRows.map((row) => (
                <tr key={row.label} className="border-b border-border/60">
                  <td className="py-1.5 text-secondary text-foreground-muted">{row.label}</td>
                  <td className="tabular py-1.5 text-right text-secondary text-foreground">
                    {formatSignedCents(row.cents, item.currency)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border-strong">
                <td className="pt-2 text-body font-semibold text-foreground">Expected net</td>
                <td className="tabular pt-2 text-right font-serif text-secondary font-semibold text-foreground">
                  {formatCents(item.settlement!.expectedNetCents, item.currency)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-1 divide-y divide-border rounded-sm border border-border bg-surface-muted/50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3">
              <MoneyFigure
                label="Expected net"
                cents={item.settlement.expectedNetCents}
                currency={item.currency}
                emphasis
              />
            </div>
            <div className="px-4 py-3">
              <MoneyFigure label="Actual deposit" cents={actualCents} currency={item.currency} emphasis />
            </div>
            <div className="px-4 py-3">
              <MoneyFigure
                label={hasVariance ? 'Variance' : item.varianceCents === 0 ? 'Variance — none' : 'Variance'}
                cents={item.varianceCents}
                currency={item.currency}
                emphasis
              />
              {hasVariance && item.varianceCents !== null ? (
                <p className={`mt-0.5 text-meta font-medium ${item.varianceCents < 0 ? 'text-danger-text' : 'text-warning-text'}`}>
                  {item.varianceCents < 0 ? 'Deposit short of expectation' : 'Deposit exceeds expectation'}
                </p>
              ) : item.varianceCents === 0 ? (
                <p className="mt-0.5 text-meta font-medium text-success-text">Exact match</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="px-4 py-4 sm:px-5">
            <MoneyFigure label="Amount" cents={item.amountCents} currency={item.currency} emphasis />
          </div>
          <div className="px-4 py-4 sm:px-5">
            <MoneyFigure label="Actual deposit" cents={actualCents} currency={item.currency} emphasis />
          </div>
          <div className="px-4 py-4 sm:px-5">
            <MoneyFigure label="Variance" cents={item.varianceCents} currency={item.currency} emphasis />
          </div>
        </section>
      )}

      {(item.causes.length > 0 || item.family === 'settlement') && (
        <section className="px-4 py-4 sm:px-5">
          <ExplanationBlock causes={item.causes} />
        </section>
      )}

      {item.evidence.length > 0 ? (
        <section className="px-4 py-4 sm:px-5">
          <PanelLabel>Evidence chain</PanelLabel>
          <ul className="mt-2 space-y-1">
            {item.evidence.map((entry, index) => (
              <li key={index}>
                <button
                  type="button"
                  disabled={entry.target === null}
                  onClick={() => entry.target && onOpenRecord(entry.target)}
                  className={`flex w-full items-start gap-2.5 rounded-sm px-2 py-1.5 text-left ${
                    entry.target
                      ? 'cursor-pointer hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring'
                      : 'cursor-default'
                  }`}
                >
                  <code className="mt-0.5 shrink-0 rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground-muted ring-1 ring-inset ring-border">
                    {entry.label.replace(/_/g, ' ')}
                  </code>
                  <span className="min-w-0 flex-1 text-secondary leading-relaxed text-foreground">
                    {entry.detail}
                  </span>
                  {entry.target ? (
                    <span className="mt-0.5 shrink-0 text-meta font-medium text-foreground-muted">view →</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.relatedRecords.length > 0 ? (
        <section className="px-4 py-4 sm:px-5">
          <PanelLabel>Related records</PanelLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.relatedRecords.map((record) => (
              <RelatedChipRow key={`${record.sourceType}:${record.recordId}`} record={record} onOpenRecord={onOpenRecord} />
            ))}
          </div>
        </section>
      ) : null}

      {item.settlement && item.settlement.lines.length > 0 ? (
        <section className="px-4 py-4 sm:px-5">
          <PanelLabel>Settlement lines</PanelLabel>
          <ul className="mt-2 divide-y divide-border/60">
            {item.settlement.lines.map((line) => (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() =>
                    onOpenRecord({
                      sourceType: 'settlement_line',
                      recordId: line.id,
                      label: `Settlement line ·${line.id.slice(0, 4)}`,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-sm py-1.5 text-left hover:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-20 shrink-0 truncate rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground-muted ring-1 ring-inset ring-border">
                    {line.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-secondary text-foreground">
                    {line.description}
                  </span>
                  <Num className="shrink-0 text-secondary text-foreground">
                    {formatSignedCents(line.amountCents, item.currency)}
                  </Num>
                  <span aria-hidden className="shrink-0 text-foreground-muted/50">→</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.explanation ? (
        <section className="px-4 py-4 sm:px-5">
          <PanelLabel>Reconciler summary</PanelLabel>
          <p className="mt-1.5 text-secondary italic leading-relaxed text-foreground-muted">
            {item.explanation}
          </p>
        </section>
      ) : null}

      {item.proposalId ? (
        <section className="flex flex-wrap items-center justify-between gap-3 bg-surface-muted/60 px-4 py-3 sm:px-5">
          <span className="text-secondary text-foreground-muted">
            Proposal <span className="font-mono text-meta">{item.proposalId.slice(0, 8)}…</span>
            {item.proposalStatus ? ` · ${item.proposalStatus}` : ''}
          </span>
          <Link
            href={`/reconciliation/${item.proposalId}`}
            className="inline-flex items-center rounded-sm bg-primary px-3 py-1.5 text-secondary font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            Open proposal
          </Link>
        </section>
      ) : null}
    </article>
  );
}

function RelatedChipRow({
  record,
  onOpenRecord,
}: {
  record: ExceptionRelatedRecord;
  onOpenRecord: (target: ExceptionRelatedRecord) => void;
}) {
  if (record.sourceType === 'proposal') {
    return (
      <Link
        href={`/reconciliation/${record.recordId}`}
        className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-meta text-foreground hover:border-border-strong hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        {record.label} ↗
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenRecord(record)}
      className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 font-mono text-meta text-foreground hover:border-border-strong hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      {record.label} ↗
    </button>
  );
}
