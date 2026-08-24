'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/layout/page-header';
import { useActivity } from '@/features/reconciliation/hooks/use-review';
import { formatDateTime, shortenHash } from '@/features/reconciliation/lib/format';
import type { ChainVerification } from '@/features/reconciliation/types';

function ActionBadge({ action }: { action: string }) {
  const tone =
    action === 'proposal.approved'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : action === 'proposal.rejected'
        ? 'bg-red-50 text-red-700 ring-red-200'
        : action === 'proposal.overridden' || action === 'proposal.created'
          ? 'bg-amber-50 text-amber-800 ring-amber-200'
          : 'bg-zinc-100 text-zinc-600 ring-zinc-200';

  return (
    <span className={`inline-block whitespace-nowrap rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset ${tone}`}>
      {action}
    </span>
  );
}

function IntegrityCell({
  status,
  hash,
}: {
  status: 'verified' | 'unverified';
  hash: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] ${
        status === 'verified' ? 'text-emerald-700' : 'text-red-600'
      }`}
      title={hash}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status === 'verified' ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      {status === 'verified' ? 'Verified' : 'Unverified'}
      <code className="rounded-sm bg-zinc-100 px-1 py-0.5 text-zinc-400">{shortenHash(hash, 6)}</code>
    </span>
  );
}

function ChainBanner({ verification }: { verification: ChainVerification }) {
  if (verification.valid) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 rounded-md bg-emerald-50 px-4 py-3 ring-1 ring-inset ring-emerald-200"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 6.5L5 9l4.5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-[13px] font-semibold text-emerald-900">
          Hash chain valid — all {verification.checkedCount} entries verified against genesis.
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md bg-red-50 px-4 py-3 ring-1 ring-inset ring-red-300"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M6 2v5M6 9.5v.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <p className="text-[13px] text-red-900">
        <span className="font-bold">Audit chain INVALID</span> — first failure at entry #{(verification.brokenAtIndex ?? 0) + 1}.{' '}
        <span className="font-medium">{verification.reason}</span> Entries from that point cannot be trusted.
      </p>
    </div>
  );
}

export default function ActivityPage() {
  const { data, isLoading, isError } = useActivity(undefined, 500);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const verification = data?.verification;

  const actions = useMemo(() => [...new Set(entries.map((entry) => entry.action))].sort(), [entries]);
  const entityTypes = useMemo(
    () => [...new Set(entries.map((entry) => entry.entityType))].sort(),
    [entries],
  );

  const filtered = entries.filter((entry) => {
    if (actionFilter !== '' && entry.action !== actionFilter) {
      return false;
    }

    if (entityFilter !== '' && entry.entityType !== entityFilter) {
      return false;
    }

    const day = entry.timestamp.slice(0, 10);

    if (dateFrom !== '' && day < dateFrom) {
      return false;
    }

    if (dateTo !== '' && day > dateTo) {
      return false;
    }

    return true;
  });

  function integrityStatusAt(index: number): 'verified' | 'unverified' {
    if (!verification || verification.valid) {
      return 'verified';
    }

    return verification.brokenAtIndex === null || index < verification.brokenAtIndex
      ? 'verified'
      : 'unverified';
  }

  const filtersActive = actionFilter !== '' || entityFilter !== '' || dateFrom !== '' || dateTo !== '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity"
        subtitle="Append-only audit log of every decision and override. Each entry is hash-chained to its predecessor."
      />

      {verification ? <ChainBanner verification={verification} /> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-zinc-200 bg-white px-4 py-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          Action
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="h-7 max-w-48 rounded-md border border-input bg-white px-1.5 text-[13px]"
          >
            <option value="">Any</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          Entity
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            className="h-7 rounded-md border border-input bg-white px-1.5 text-[13px]"
          >
            <option value="">Any</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-7 rounded-md border border-input px-2 text-[13px]"
          />
        </label>

        <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-7 rounded-md border border-input px-2 text-[13px]"
          />
        </label>

        <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {filtered.length} of {entries.length} entries · oldest first
        </span>

        {filtersActive ? (
          <button
            type="button"
            onClick={() => {
              setActionFilter('');
              setEntityFilter('');
              setDateFrom('');
              setDateTo('');
            }}
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Reset
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Verifying chain…</p>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-red-600">Could not load the activity log.</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No activity recorded yet"
          description="Approve, reject or override a proposal and every action will be recorded here on an immutable chain."
          actionHref="/reconciliation"
          actionLabel="Open Reconciliation"
        />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-muted-foreground">
          No entries match the current filters.
        </p>
      ) : (
        <section className="overflow-hidden rounded-md border border-zinc-200 bg-white">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                <th className="px-4 py-2 font-semibold">Time</th>
                <th className="px-4 py-2 font-semibold">Actor</th>
                <th className="px-4 py-2 font-semibold">Action</th>
                <th className="px-4 py-2 font-semibold">Entity</th>
                <th className="px-4 py-2 font-semibold">Reason</th>
                <th className="px-4 py-2 font-semibold">Integrity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, index) => {
                const payload = entry.payload as Record<string, unknown> | null;
                const reason =
                  payload !== null && typeof payload['reason'] === 'string' ? payload['reason'] : null;

                return (
                  <tr key={entry.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs tabular-nums text-zinc-600">
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="max-w-40 truncate px-4 py-2 text-zinc-700" title={entry.actor}>
                      {entry.actor}
                    </td>
                    <td className="px-4 py-2">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-600">
                      {entry.entityType === 'proposal' ? (
                        <Link
                          href={`/reconciliation/${entry.entityId}`}
                          className="underline-offset-2 hover:text-zinc-900 hover:underline"
                        >
                          proposal ·{shortenHash(entry.entityId, 6)}
                        </Link>
                      ) : (
                        <>
                          {entry.entityType} ·{shortenHash(entry.entityId, 6)}
                        </>
                      )}
                    </td>
                    <td className="max-w-72 px-4 py-2">
                      {reason ? (
                        <span className="block truncate italic text-zinc-600" title={reason}>
                          “{reason}”
                        </span>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <IntegrityCell status={integrityStatusAt(index)} hash={entry.hash} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
