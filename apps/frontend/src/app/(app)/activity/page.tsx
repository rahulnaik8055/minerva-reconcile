'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useActivity } from '@/features/reconciliation/hooks/use-review';
import { formatDateTime } from '@/features/reconciliation/lib/format';
import type { ChainVerification } from '@/features/reconciliation/types';

function actionTone(action: string): 'success' | 'danger' | 'warning' | 'neutral' {
  if (action === 'proposal.approved') {
    return 'success';
  }

  if (action === 'proposal.rejected') {
    return 'danger';
  }

  if (action === 'proposal.overridden' || action === 'proposal.created') {
    return 'warning';
  }

  return 'neutral';
}

const ACTION_LABELS: Record<string, string> = {
  'proposal.approved': 'Approved',
  'proposal.rejected': 'Rejected',
  'proposal.overridden': 'Overridden',
  'proposal.created': 'Created',
};

const ENTITY_LABELS: Record<string, string> = {
  proposal: 'Proposal',
  bank_transaction: 'Bank transaction',
  ledger_entry: 'Ledger entry',
  invoice: 'Invoice',
  settlement: 'Settlement',
  settlement_line: 'Settlement line',
  import: 'Import',
};

function ActionBadge({ action }: { action: string }) {
  return (
    <Badge tone={actionTone(action)} className="text-meta tracking-tight">
      {ACTION_LABELS[action] ?? action}
    </Badge>
  );
}

function IntegrityCell({ status }: { status: 'verified' | 'unverified' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-meta ${
        status === 'verified' ? 'text-success-text' : 'text-danger-text'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${status === 'verified' ? 'bg-success' : 'bg-danger'}`}
      />
      {status === 'verified' ? 'Verified' : 'Unverified'}
    </span>
  );
}

function ChainBanner({ verification }: { verification: ChainVerification }) {
  if (verification.valid) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-md border border-success-border bg-success-bg px-4 py-3"
      >
        <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-[11px] font-bold text-white">
          ✓
        </span>
        <p className="text-secondary text-success-text">
          <span className="font-semibold">Hash chain valid</span> — all{' '}
          {verification.checkedCount} entries verified against genesis.
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-danger-border bg-danger-bg px-4 py-3"
    >
        <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white">
        !
      </span>
      <p className="text-secondary text-danger-text">
        <span className="font-semibold">Audit chain invalid</span> — first failure at entry #
        {(verification.brokenAtIndex ?? 0) + 1}. <span className="font-medium">{verification.reason}</span>{' '}
        Entries from that point cannot be trusted.
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

  const selectClass =
    'h-7 max-w-full rounded-sm border border-border-strong bg-surface px-1.5 text-secondary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Append-only audit log of every decision and override. Each entry is hash-chained to its predecessor."
      />

      {verification ? <ChainBanner verification={verification} /> : null}

      <Panel className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4">
        <label className="flex items-center gap-1.5 text-meta font-medium text-foreground-muted">
          Action
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className={selectClass}
          >
            <option value="">Any</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-meta font-medium text-foreground-muted">
          Entity
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            className={selectClass}
          >
            <option value="">Any</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {ENTITY_LABELS[type] ?? type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-meta font-medium text-foreground-muted">
          From
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="From date"
            className="h-7 w-36 py-0 text-secondary"
          />
        </label>

        <label className="flex items-center gap-1.5 text-meta font-medium text-foreground-muted">
          To
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="To date"
            className="h-7 w-36 py-0 text-secondary"
          />
        </label>

        <span className="tabular ml-auto hidden text-meta text-foreground-muted sm:block">
          {filtered.length} of {entries.length} entries
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
            className="ml-auto text-meta font-medium text-foreground-muted underline-offset-2 hover:text-foreground hover:underline sm:ml-0"
          >
            Reset
          </button>
        ) : null}
      </Panel>

      {isLoading ? (
        <p className="py-12 text-center text-secondary text-foreground-muted" aria-busy>Verifying chain…</p>
      ) : isError ? (
        <p className="py-12 text-center text-secondary text-danger-text">Could not load the activity log.</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No activity recorded yet"
          description="Approve, reject or override a proposal and every action will be recorded here on an immutable chain."
          actionHref="/reconciliation"
          actionLabel="Open Reconciliation"
        />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-secondary text-foreground-muted">
          No entries match the current filters.
        </p>
      ) : (
        <Panel className="overflow-hidden">
          <TableWrap>
            <Table className="min-w-[44rem]">
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th className="hidden md:table-cell">Actor</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th className="hidden lg:table-cell">Reason</Th>
                  <Th>Integrity</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, index) => {
                  const payload = entry.payload as Record<string, unknown> | null;
                  const reason =
                    payload !== null && typeof payload['reason'] === 'string' ? payload['reason'] : null;

                  return (
                    <tr key={entry.id} className="last:border-b-0 transition-colors hover:bg-surface-muted/60">
                      <Td className="whitespace-nowrap tabular text-meta text-foreground-muted">
                        {formatDateTime(entry.timestamp)}
                      </Td>
                      <Td className="hidden max-w-40 truncate md:table-cell" title={entry.actor}>
                        {entry.actor}
                      </Td>
                      <Td>
                        <ActionBadge action={entry.action} />
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-meta text-foreground">
                        {entry.entityType === 'proposal' ? (
                          <Link
                            href={`/reconciliation/${entry.entityId}`}
                            className="underline-offset-2 hover:text-primary hover:underline"
                          >
                            {ENTITY_LABELS[entry.entityType] ?? entry.entityType} ·{entry.entityId.slice(0, 6)}
                          </Link>
                        ) : (
                          <>
                            {ENTITY_LABELS[entry.entityType] ?? entry.entityType} ·{entry.entityId.slice(0, 6)}
                          </>
                        )}
                      </Td>
                      <Td className="hidden max-w-72 lg:table-cell">
                        {reason ? (
                          <span className="block truncate italic text-foreground-muted" title={reason}>
                            “{reason}”
                          </span>
                        ) : (
                          <span className="text-foreground-muted/50">—</span>
                        )}
                      </Td>
                      <Td>
                        <IntegrityCell status={integrityStatusAt(index)} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      )}
    </div>
  );
}
