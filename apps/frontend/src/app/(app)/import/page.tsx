'use client';

import { useRef, useState } from 'react';
import { PageHeader, PanelLabel } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
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
    <section className="rounded-md border border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 px-4 py-2">
        <PanelLabel>{title}</PanelLabel>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </header>

      <div className="space-y-2 px-4 py-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void handleFile(file);
            }
          }}
          className="block w-full cursor-pointer rounded-md border border-input bg-white px-2 py-1.5 text-[13px] file:mr-3 file:rounded-sm file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium"
        />

        <p className="text-xs text-muted-foreground">CSV up to 5 MB · identical files are rejected as duplicates.</p>

        {busy ? <p className="text-xs font-medium text-zinc-600">Uploading and validating…</p> : null}

        {error ? (
          <p className="rounded-sm bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="rounded-sm bg-emerald-50 px-3 py-2 ring-1 ring-inset ring-emerald-200">
            <p className="text-xs font-semibold text-emerald-800">
              {result.filename} — {result.importedCount} of {result.rowCount} rows imported
              {result.rejectedCount > 0 ? `, ${result.rejectedCount} rejected` : ''}
            </p>

            {result.errors.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {result.errors.slice(0, 4).map((rowError) => (
                  <li key={rowError.row} className="font-mono text-[11px] text-emerald-900">
                    row {rowError.row}: {rowError.message}
                  </li>
                ))}
                {result.errors.length > 4 ? (
                  <li className="text-[11px] italic text-emerald-800">
                    …and {result.errors.length - 4} more
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DemoPanel() {
  const { data: status } = useDemoStatus();
  const loadDemo = useLoadDemoData();
  const resetDemo = useResetDemoData();

  return (
    <section className="rounded-md border border-amber-300 bg-amber-50">
      <header className="flex items-center justify-between gap-3 border-b border-amber-200 px-4 py-2">
        <div>
          <PanelLabel>Demo data</PanelLabel>
          <p className="mt-0.5 text-xs text-amber-800">
            Replaces all reconciliation data with a deterministic synthetic dataset, then runs the
            real matching engine. Every proposal, score, and piece of evidence is produced by the
            same pipeline as a CSV import.
          </p>
        </div>

        {status?.demoDataLoaded ? (
          <span className="shrink-0 rounded-sm bg-amber-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            Demo dataset — synthetic financial data
          </span>
        ) : null}
      </header>

      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={loadDemo.isPending || resetDemo.isPending}
            onClick={() => loadDemo.mutate()}
          >
            {loadDemo.isPending ? 'Loading demo data…' : 'Load demo data'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={loadDemo.isPending || resetDemo.isPending}
            onClick={() => resetDemo.mutate()}
          >
            {resetDemo.isPending ? 'Clearing…' : 'Reset demo data'}
          </Button>
        </div>

        {loadDemo.isError ? (
          <p className="rounded-sm bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
            {loadDemo.error instanceof Error ? loadDemo.error.message : 'Loading demo data failed'}
          </p>
        ) : null}

        {resetDemo.isError ? (
          <p className="rounded-sm bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
            {resetDemo.error instanceof Error ? resetDemo.error.message : 'Reset failed'}
          </p>
        ) : null}

        {loadDemo.data ? (
          <div className="rounded-sm bg-white px-3 py-2 ring-1 ring-inset ring-amber-200">
            <p className="text-xs font-semibold text-amber-900">
              Loaded: {loadDemo.data.bankTransactions} bank transactions,{' '}
              {loadDemo.data.ledgerEntries} ledger entries, {loadDemo.data.invoices} invoices,{' '}
              {loadDemo.data.settlements} settlements ({loadDemo.data.settlementLines} lines). The
              engine created {loadDemo.data.proposalsCreated} proposals for review.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Import"
        subtitle="Load CSV source data. Every import is hashed, validated row-by-row, and recorded immutably."
      />

      <DemoPanel />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {IMPORT_TYPES.map((item) => (
          <ImportCard key={item.type} {...item} />
        ))}
      </div>
    </div>
  );
}
