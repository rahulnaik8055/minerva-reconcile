'use client';

import { useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, PanelBody, PanelLabel } from '@/components/ui/panel';
import {
  useLoadDemoData,
  useResetDemoData,
  useDemoStatus,
} from '@/features/reconciliation/hooks/use-demo';
import { importCsv } from '@/features/reconciliation/services/review.service';
import type { ImportSummary } from '@/features/reconciliation/types';

const IMPORT_TYPES = [
  {
    type: 'bank',
    title: 'Bank transactions',
    hint: 'One row per bank movement. Required: date, amount, description.',
  },
  {
    type: 'ledger',
    title: 'Ledger entries',
    hint: 'General-ledger postings used as match candidates.',
  },
  {
    type: 'invoice',
    title: 'Invoices',
    hint: 'Receivables matched against incoming payments.',
  },
  {
    type: 'settlement',
    title: 'Settlement lines',
    hint: 'Provider payout lines, grouped into settlements by reference.',
  },
] as const;

function Notice({
  tone,
  children,
}: {
  tone: 'danger' | 'success' | 'neutral';
  children: React.ReactNode;
}) {
  const classes =
    tone === 'danger'
      ? 'border-danger-border bg-danger-bg text-danger-text'
      : tone === 'success'
        ? 'border-success-border bg-success-bg text-success-text'
        : 'border-border bg-surface-muted text-foreground-muted';

  return <div className={`rounded-sm border px-3 py-2 ${classes}`}>{children}</div>;
}

function ImportCard({ type, title, hint }: { type: string; title: string; hint: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const summary = await importCsv(type, file);
      setResult(summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed');
    } finally {
      setBusy(false);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <Panel className="flex flex-col">
      <PanelHeader title={title} />
      <p className="px-4 pt-2 text-meta leading-relaxed text-foreground-muted">{hint}</p>

      <PanelBody className="mt-auto space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          aria-label={`${title} CSV file`}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void handleFile(file);
            }
          }}
          className="block w-full cursor-pointer rounded-sm border border-border-strong bg-surface px-2.5 py-2 text-secondary file:mr-3 file:cursor-pointer file:rounded-sm file:border-0 file:bg-surface-muted file:px-2.5 file:py-1.5 file:text-meta file:font-medium hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        />

        <p className="text-meta text-foreground-muted">
          CSV up to 5 MB · identical files are rejected as duplicates.
        </p>

        {busy ? (
          <p className="text-meta font-medium text-foreground" aria-busy>
            Uploading and validating…
          </p>
        ) : null}

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {result ? (
          <Notice tone="success">
            <p className="text-meta font-semibold">
              {result.filename} — {result.importedCount} of {result.rowCount} rows imported
              {result.rejectedCount > 0 ? `, ${result.rejectedCount} rejected` : ''}
            </p>

            {result.errors.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {result.errors.slice(0, 4).map((rowError) => (
                  <li key={rowError.row} className="font-mono text-[11px]">
                    row {rowError.row}: {rowError.message}
                  </li>
                ))}
                {result.errors.length > 4 ? (
                  <li className="text-[11px] italic">…and {result.errors.length - 4} more</li>
                ) : null}
              </ul>
            ) : null}
          </Notice>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function DemoPanel() {
  const { data: status } = useDemoStatus();
  const loadDemo = useLoadDemoData();
  const resetDemo = useResetDemoData();

  return (
    <section className="rounded-md border border-warning-border bg-warning-bg/60">
      <header className="flex flex-col gap-2 border-b border-warning-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <PanelLabel>Demo data</PanelLabel>
          <p className="mt-1 max-w-3xl text-secondary leading-relaxed text-warning-text">
            Replaces all reconciliation data with a deterministic synthetic dataset, then runs the
            real matching engine. Every proposal, score, and piece of evidence is produced by the
            same pipeline as a CSV import.
          </p>
        </div>

        {status?.demoDataLoaded ? (
          <span className="shrink-0 self-start rounded-sm border border-warning-border bg-warning-bg px-2 py-1 text-label font-semibold uppercase tracking-wide text-warning-text">
            Synthetic dataset loaded
          </span>
        ) : null}
      </header>

      <PanelBody className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="lg"
            disabled={loadDemo.isPending || resetDemo.isPending}
            onClick={() => loadDemo.mutate()}
          >
            {loadDemo.isPending ? 'Loading demo data…' : 'Load demo data'}
          </Button>

          <Button
            variant="outline"
            size="lg"
            disabled={loadDemo.isPending || resetDemo.isPending}
            onClick={() => resetDemo.mutate()}
          >
            {resetDemo.isPending ? 'Clearing…' : 'Reset demo data'}
          </Button>
        </div>

        {loadDemo.isError ? (
          <Notice tone="danger">
            {loadDemo.error instanceof Error ? loadDemo.error.message : 'Loading demo data failed'}
          </Notice>
        ) : null}

        {resetDemo.isError ? (
          <Notice tone="danger">
            {resetDemo.error instanceof Error ? resetDemo.error.message : 'Reset failed'}
          </Notice>
        ) : null}

        {loadDemo.data ? (
          <Notice tone="neutral">
            Loaded: {loadDemo.data.bankTransactions} bank transactions,{' '}
            {loadDemo.data.ledgerEntries} ledger entries, {loadDemo.data.invoices} invoices,{' '}
            {loadDemo.data.settlements} settlements ({loadDemo.data.settlementLines} lines). The
            engine created {loadDemo.data.proposalsCreated} proposals for review.
          </Notice>
        ) : null}
      </PanelBody>
    </section>
  );
}

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Import"
        description="Load CSV source data. Every import is hashed, validated row-by-row, and recorded immutably."
      />

      <DemoPanel />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {IMPORT_TYPES.map((item) => (
          <ImportCard key={item.type} {...item} />
        ))}
      </div>
    </div>
  );
}
