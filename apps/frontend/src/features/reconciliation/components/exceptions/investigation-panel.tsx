'use client';

import Link from 'next/link';
import { PanelLabel } from '@/components/layout/page-header';
import { ConfidenceBar } from '../status-chip';
import {
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_TYPE_DOT,
  EXCEPTION_TYPE_LABELS,
  causeLabel,
  exceptionStatusClasses,
  isSupportedCause,
} from '../../lib/exception-meta';
import { formatCents, formatDate, formatSignedCents } from '../../lib/format';
import type { ExceptionItem, ExceptionRelatedRecord } from '../../types';

function StatusBadge({ status }: { status: ExceptionItem['status'] }) {
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${exceptionStatusClasses(status)}`}
    >
      {EXCEPTION_STATUS_LABELS[status]}
    </span>
  );
}

function TypeBadge({ item }: { item: ExceptionItem }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
      <span className={`h-1.5 w-1.5 rounded-full ${EXCEPTION_TYPE_DOT[item.exceptionType]}`} />
      {EXCEPTION_TYPE_LABELS[item.exceptionType]}
    </span>
  );
}

function MoneyCell({
  label,
  cents,
  currency,
  tone = 'neutral',
}: {
  label: string;
  cents: number | null;
  currency: string;
  tone?: 'neutral' | 'negative' | 'positive';
}) {
  const toneClass =
    tone === 'negative' ? 'text-red-600' : tone === 'positive' ? 'text-emerald-700' : 'text-zinc-900';

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
      <p className={`mt-1 truncate font-mono text-xl tabular-nums md:text-2xl ${toneClass}`}>
        {cents === null ? '—' : formatCents(cents, currency)}
      </p>
    </div>
  );
}

function varianceTone(varianceCents: number): 'neutral' | 'negative' | 'positive' {
  if (varianceCents < 0) {
    return 'negative';
  }

  return varianceCents > 0 ? 'positive' : 'neutral';
}

function ExplanationBlock({ causes }: { causes: ExceptionItem['causes'] }) {
  if (causes.length === 0) {
    return null;
  }

  const supported = causes.filter((cause) => isSupportedCause(cause.causeType));

  if (supported.length > 0) {
    const primary = supported[0];

    return (
      <section className="overflow-hidden rounded-md bg-zinc-900">
        <header className="border-b border-zinc-700/60 px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Supported explanation
          </p>
        </header>

        <div className="space-y-3 px-4 py-3">
          <p className="font-mono text-lg tabular-nums text-white">
            {causeLabel(primary.causeType)}
            {primary.amountCents !== null ? (
              <span className="ml-2 text-amber-300">{formatSignedCents(primary.amountCents)}</span>
            ) : null}
          </p>

          <p className="text-[13px] leading-relaxed text-zinc-300">{primary.description}</p>

          {primary.target ? (
            <RelatedChip record={primary.target} variant="onDark" />
          ) : null}

          {supported.length > 1 ? (
            <ul className="space-y-1 border-t border-zinc-700/60 pt-2">
              {supported.slice(1).map((cause, index) => (
                <li key={index} className="text-xs text-zinc-400">
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
    <section className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
        Supported explanation
      </p>
      <p className="mt-1.5 text-[13px] italic text-zinc-600">
        No supported explanation in the imported records — this variance is unexplained.
      </p>
    </section>
  );
}

function RelatedChip({
  record,
  variant = 'light',
}: {
  record: ExceptionRelatedRecord;
  variant?: 'light' | 'onDark';
}) {
  const base =
    variant === 'onDark'
      ? 'inline-flex items-center gap-1 rounded-sm bg-zinc-800 px-2 py-1 font-mono text-[11px] text-zinc-200 hover:bg-zinc-700'
      : '';

  if (record.sourceType === 'proposal') {
    return (
      <Link href={`/reconciliation/${record.recordId}`} className={`${base} underline-offset-2 hover:underline`}>
        {record.label} ↗
      </Link>
    );
  }

  return <span className={base}>{record.label}</span>;
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

  return (
    <article className="divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 bg-white">
      <header className="space-y-3 px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge item={item} />
          <StatusBadge status={item.status} />
          {item.outcome ? (
            <span className="rounded-sm bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 ring-1 ring-inset ring-zinc-200">
              {item.outcome}
            </span>
          ) : null}
          {item.confidence !== null ? (
            <span className="ml-auto flex w-32 items-center gap-2">
              <ConfidenceBar score={item.confidence} />
              <span className="font-mono text-xs tabular-nums text-zinc-500">
                {Math.round(item.confidence * 100)}%
              </span>
            </span>
          ) : null}
        </div>

        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">{item.title}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {[
              item.provider,
              item.settlementReference,
              formatDate(item.date),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {item.detail ? <p className="pb-4 text-[13px] leading-relaxed text-zinc-700">{item.detail}</p> : <div className="pb-1" />}
      </header>

      <section className="grid grid-cols-3 divide-x divide-zinc-200 bg-zinc-50/60">
        <div className="px-5 py-4">
          <MoneyCell
            label={item.settlement ? 'Expected net' : 'Amount'}
            cents={item.settlement ? item.settlement.expectedNetCents : item.amountCents}
            currency={item.currency}
          />
        </div>
        <div className="px-5 py-4">
          <MoneyCell label="Actual deposit" cents={actualCents} currency={item.currency} />
        </div>
        <div className="px-5 py-4">
          <MoneyCell
            label="Variance"
            cents={item.varianceCents}
            currency={item.currency}
            tone={item.varianceCents === null ? 'neutral' : varianceTone(item.varianceCents)}
          />
        </div>
      </section>

      {breakdownRows.length > 0 ? (
        <section className="px-5 py-4">
          <PanelLabel>Settlement breakdown</PanelLabel>
          <table className="mt-2 w-full text-[13px]">
            <tbody>
              {breakdownRows.map((row) => (
                <tr key={row.label} className="border-b border-zinc-100 last:border-b-0">
                  <td className="py-1.5 text-zinc-600">{row.label}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums text-zinc-800">
                    {formatSignedCents(row.cents, item.currency)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-300">
                <td className="pt-2 font-medium text-zinc-900">Expected net</td>
                <td className="pt-2 text-right font-mono font-semibold tabular-nums text-zinc-900">
                  {formatCents(item.settlement!.expectedNetCents, item.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      {(item.causes.length > 0 || item.family === 'settlement') && (
        <section className="px-5 py-4">
          <ExplanationBlock causes={item.causes} />
        </section>
      )}

      {item.evidence.length > 0 ? (
        <section className="px-5 py-4">
          <PanelLabel>Evidence</PanelLabel>
          <ul className="mt-2 space-y-1">
            {item.evidence.map((entry, index) => (
              <li key={index}>
                <button
                  type="button"
                  disabled={entry.target === null}
                  onClick={() => entry.target && onOpenRecord(entry.target)}
                  className={`flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left ${
                    entry.target
                      ? 'cursor-pointer hover:bg-zinc-50'
                      : 'cursor-default'
                  }`}
                >
                  <code className="mt-0.5 shrink-0 rounded-sm bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                    {entry.label.replace(/_/g, ' ')}
                  </code>
                  <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-zinc-700">
                    {entry.detail}
                  </span>
                  {entry.target ? (
                    <span className="mt-0.5 shrink-0 text-xs font-medium text-zinc-400">view →</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {item.relatedRecords.length > 0 ? (
        <section className="px-5 py-4">
          <PanelLabel>Related records</PanelLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.relatedRecords.map((record) => (
              <RelatedChipRow key={`${record.sourceType}:${record.recordId}`} record={record} onOpenRecord={onOpenRecord} />
            ))}
          </div>
        </section>
      ) : null}

      {item.settlement && item.settlement.lines.length > 0 ? (
        <section className="px-5 py-4">
          <PanelLabel>Settlement lines</PanelLabel>
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                <th className="pb-1.5 pr-2 font-semibold">Type</th>
                <th className="pb-1.5 pr-2 font-semibold">Description</th>
                <th className="pb-1.5 pr-2 text-right font-semibold">Amount</th>
                <th className="pb-1.5" />
              </tr>
            </thead>
            <tbody>
              {item.settlement.lines.map((line) => (
                <tr
                  key={line.id}
                  onClick={() =>
                    onOpenRecord({
                      sourceType: 'settlement_line',
                      recordId: line.id,
                      label: `Settlement line ·${line.id.slice(0, 4)}`,
                    })
                  }
                  className="cursor-pointer border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50"
                >
                  <td className="py-1.5 pr-2">
                    <span className="rounded-sm bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                      {line.type}
                    </span>
                  </td>
                  <td className="max-w-[14rem] truncate py-1.5 pr-2 text-zinc-700">{line.description}</td>
                  <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-zinc-800">
                    {formatSignedCents(line.amountCents, item.currency)}
                  </td>
                  <td className="w-6 py-1.5 text-right text-zinc-300">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {item.explanation ? (
        <section className="px-5 py-4">
          <PanelLabel>Reconciler summary</PanelLabel>
          <p className="mt-1.5 text-[13px] italic leading-relaxed text-muted-foreground">
            {item.explanation}
          </p>
        </section>
      ) : null}

      {item.proposalId ? (
        <section className="flex items-center justify-between gap-3 bg-zinc-50/60 px-5 py-3">
          <span className="text-[13px] text-muted-foreground">
            Proposal <span className="font-mono text-xs">{item.proposalId.slice(0, 8)}…</span>
            {item.proposalStatus ? ` · ${item.proposalStatus}` : ''}
          </span>
          <Link
            href={`/reconciliation/${item.proposalId}`}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-zinc-700"
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
        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 font-mono text-[11px] text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
      >
        {record.label} ↗
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenRecord(record)}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 font-mono text-[11px] text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
    >
      {record.label} ↗
    </button>
  );
}
