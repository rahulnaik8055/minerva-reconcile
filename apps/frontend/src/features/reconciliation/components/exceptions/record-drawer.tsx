'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { PanelLabel } from '@/components/layout/page-header';
import { useRecord } from '../../hooks/use-review';
import type { ExceptionRelatedRecord } from '../../types';

export interface DrawerTarget {
  sourceType: string;
  recordId: string;
}

export function RecordDrawer({
  target,
  onNavigate,
  onClose,
}: {
  target: DrawerTarget | null;
  onNavigate: (next: ExceptionRelatedRecord) => void;
  onClose: () => void;
}) {
  const open = target !== null;
  const { data, isLoading, isError } = useRecord(target?.sourceType ?? '', target?.recordId ?? '', open);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handler);

    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close record detail"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-zinc-900/30"
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <PanelLabel>{data?.sourceType.replace(/_/g, ' ') ?? 'Record'}</PanelLabel>
            {isLoading ? (
              <div className="mt-1 h-5 w-48 animate-pulse rounded bg-zinc-100" />
            ) : (
              <h2 className="truncate text-[15px] font-semibold text-zinc-900">{data?.title}</h2>
            )}
            {!isLoading && data?.subtitle ? (
              <p className="truncate text-[13px] text-muted-foreground">{data.subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading record…</p> : null}

          {isError ? <p className="text-sm text-red-600">Could not load this record.</p> : null}

          {data ? (
            <>
              <dl>
                {data.fields.map((field) => (
                  <div
                    key={field.label}
                    className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2 last:border-b-0"
                  >
                    <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {field.label}
                    </dt>
                    <dd className="break-words text-right font-mono text-[13px] tabular-nums text-zinc-800">
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>

              {data.importFilename || data.sourceRow !== null ? (
                <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-muted-foreground ring-1 ring-inset ring-zinc-200">
                  Provenance: {data.importFilename ?? 'unknown file'}
                  {data.sourceRow !== null ? ` · row ${data.sourceRow}` : ''}
                </div>
              ) : null}

              {data.parent ? (
                <div>
                  <PanelLabel>Part of</PanelLabel>
                  <button
                    type="button"
                    onClick={() => onNavigate({ ...data.parent!, label: data.parent!.label })}
                    className="mt-1.5 w-full rounded-md border border-zinc-200 px-3 py-2 text-left text-[13px] font-medium text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {data.parent.label} →
                  </button>
                </div>
              ) : null}

              {data.relatedProposals.length > 0 ? (
                <div>
                  <PanelLabel>In proposals</PanelLabel>
                  <ul className="mt-1.5 space-y-1.5">
                    {data.relatedProposals.map((proposal) => (
                      <li key={proposal.id}>
                        <Link
                          href={`/reconciliation/${proposal.id}`}
                          className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-[13px] hover:border-zinc-300 hover:bg-zinc-50"
                        >
                          <span className="font-mono text-xs text-zinc-600">{proposal.id.slice(0, 8)}…</span>
                          <span className="font-medium capitalize text-zinc-800">{proposal.status}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}
