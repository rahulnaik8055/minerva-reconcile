'use client';

import { useRef, useState } from 'react';
import { PageHeader, PanelLabel } from '@/components/layout/page-header';
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

export default function ImportPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Import"
        subtitle="Load CSV source data. Every import is hashed, validated row-by-row, and recorded immutably."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {IMPORT_TYPES.map((item) => (
          <ImportCard key={item.type} {...item} />
        ))}
      </div>
    </div>
  );
}
