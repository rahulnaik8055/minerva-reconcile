'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldList } from '@/components/ui/data';
import { PanelLabel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
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

    document.body.style.overflow = 'hidden';

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close record detail"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/25 animate-fade-in"
      />

      <aside
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl animate-fade-in"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <PanelLabel>{data?.sourceType.replace(/_/g, ' ') ?? 'Record'}</PanelLabel>
            {isLoading ? (
              <div className="mt-1 h-5 w-48 animate-pulse rounded-sm bg-surface-muted" />
            ) : (
              <h2 className="truncate text-body font-semibold text-foreground">{data?.title}</h2>
            )}
            {!isLoading && data?.subtitle ? (
              <p className="truncate text-secondary text-foreground-muted">{data.subtitle}</p>
            ) : null}
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close record detail" autoFocus>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isLoading ? <p className="text-secondary text-foreground-muted">Loading record…</p> : null}

          {isError ? <p className="text-secondary text-danger-text">Could not load this record.</p> : null}

          {data ? (
            <>
              <FieldList
                items={data.fields.map((field) => ({
                  label: field.label,
                  value: field.value,
                }))}
              />

              {data.importFilename || data.sourceRow !== null ? (
                <p className="rounded-sm bg-surface-muted px-3 py-2 text-meta text-foreground-muted ring-1 ring-inset ring-border">
                  Provenance: {data.importFilename ?? 'unknown file'}
                  {data.sourceRow !== null ? ` · row ${data.sourceRow}` : ''}
                </p>
              ) : null}

              {data.parent ? (
                <div>
                  <PanelLabel>Part of</PanelLabel>
                  <button
                    type="button"
                    onClick={() => onNavigate({ ...data.parent!, label: data.parent!.label })}
                    className="mt-1.5 w-full rounded-sm border border-border px-3 py-2 text-left text-secondary font-medium text-foreground hover:border-border-strong hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
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
                          className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-secondary hover:border-border-strong hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="font-mono text-meta text-foreground-muted">{proposal.id.slice(0, 8)}…</span>
                          <span className="font-medium capitalize text-foreground">{proposal.status}</span>
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
    </div>
  );
}
