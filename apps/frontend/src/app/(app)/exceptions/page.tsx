'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, PanelLabel, EmptyState } from '@/components/layout/page-header';
import {
  EXCEPTION_TYPE_DOT,
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_TYPE_ORDER,
  exceptionStatusClasses,
  EXCEPTION_STATUS_LABELS,
} from '@/features/reconciliation/lib/exception-meta';
import { formatCents, formatDate, formatSignedCents } from '@/features/reconciliation/lib/format';
import { useExceptions } from '@/features/reconciliation/hooks/use-review';
import { InvestigationPanel } from '@/features/reconciliation/components/exceptions/investigation-panel';
import { RecordDrawer, type DrawerTarget } from '@/features/reconciliation/components/exceptions/record-drawer';
import type {
  ExceptionItem,
  ExceptionStatus,
  ExceptionType,
} from '@/features/reconciliation/types';

interface Filters {
  types: Set<ExceptionType>;
  status: '' | ExceptionStatus;
  minAmount: string;
  maxAmount: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  types: new Set<ExceptionType>(),
  status: '',
  minAmount: '',
  maxAmount: '',
  dateFrom: '',
  dateTo: '',
};

function filtersActive(filters: Filters): boolean {
  return (
    filters.types.size > 0 ||
    filters.status !== '' ||
    filters.minAmount !== '' ||
    filters.maxAmount !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== ''
  );
}

function applyFilters(items: ExceptionItem[], filters: Filters): ExceptionItem[] {
  const min = filters.minAmount === '' ? null : Math.round(Number(filters.minAmount) * 100);
  const max = filters.maxAmount === '' ? null : Math.round(Number(filters.maxAmount) * 100);

  return items.filter((item) => {
    if (filters.types.size > 0 && !filters.types.has(item.exceptionType)) {
      return false;
    }

    if (filters.status !== '' && item.status !== filters.status) {
      return false;
    }

    const amount = Math.abs(item.amountCents);

    if (min !== null && !Number.isNaN(min) && amount < min) {
      return false;
    }

    if (max !== null && !Number.isNaN(max) && amount > max) {
      return false;
    }

    const day = item.date.slice(0, 10);

    if (filters.dateFrom !== '' && day < filters.dateFrom) {
      return false;
    }

    if (filters.dateTo !== '' && day > filters.dateTo) {
      return false;
    }

    return true;
  });
}

function StatusStat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex-1 border-l border-zinc-200 px-4 py-3 first:border-l-0">
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</dt>
      <dd className={`mt-1 font-mono text-xl tabular-nums ${tone ?? 'text-zinc-900'}`}>{value}</dd>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-32 rounded-md border border-input px-2 text-[13px] tabular-nums"
      />
    </label>
  );
}

function ExceptionRow({
  item,
  selected,
  onSelect,
}: {
  item: ExceptionItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start justify-between gap-3 border-b border-zinc-100 px-4 py-2.5 text-left last:border-b-0 ${
        selected ? 'bg-white ring-1 ring-inset ring-zinc-900' : 'hover:bg-white/70'
      }`}
    >
      <span className="flex min-w-0 items-start gap-2.5">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${EXCEPTION_TYPE_DOT[item.exceptionType]}`} />

        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-zinc-800">{item.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatDate(item.date)}
            {item.detail ? ` · ${item.detail}` : ''}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block font-mono text-[13px] tabular-nums text-zinc-900">
          {formatCents(item.amountCents, item.currency)}
        </span>

        {item.varianceCents !== null ? (
          <span
            className={`block font-mono text-xs tabular-nums ${
              item.varianceCents === 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatSignedCents(item.varianceCents, item.currency)}
          </span>
        ) : (
          <span
            className={`mt-0.5 inline-block rounded-sm px-1 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${exceptionStatusClasses(item.status)}`}
          >
            {EXCEPTION_STATUS_LABELS[item.status]}
          </span>
        )}
      </span>
    </button>
  );
}

export default function ExceptionsPage() {
  const { data, isLoading, isError } = useExceptions();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);

  useEffect(() => {
    if (filtered.length === 0) {
      return;
    }

    if (!filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]!.id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.id === selectedId) ?? null;

  const statusCounts = useMemo(
    () => ({
      open: items.filter((item) => item.status === 'open').length,
      inReview: items.filter((item) => item.status === 'in_review').length,
      resolved: items.filter((item) => item.status === 'resolved').length,
    }),
    [items],
  );

  const grouped = useMemo(() => {
    const map = new Map<ExceptionType, ExceptionItem[]>();

    for (const type of EXCEPTION_TYPE_ORDER) {
      map.set(type, []);
    }

    for (const item of filtered) {
      map.get(item.exceptionType)?.push(item);
    }

    return [...map.entries()].filter(([, list]) => list.length > 0);
  }, [filtered]);

  const toggleType = (type: ExceptionType) => {
    setFilters((current) => {
      const next = new Set(current.types);

      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }

      return { ...current, types: next };
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exceptions"
        subtitle="Every disagreement the engine could support with records — grouped by cause, ready to investigate."
      />

      <dl className="flex rounded-md border border-zinc-200 bg-white">
        <StatusStat label="Exceptions" value={items.length} />
        <StatusStat label="Open" value={statusCounts.open} tone="text-red-600" />
        <StatusStat label="In review" value={statusCounts.inReview} tone="text-amber-600" />
        <StatusStat label="Resolved" value={statusCounts.resolved} tone="text-emerald-700" />
      </dl>

      <div className="space-y-2 rounded-md border border-zinc-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, types: new Set() }))}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              filters.types.size === 0
                ? 'bg-zinc-900 text-white ring-zinc-900'
                : 'bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50'
            }`}
          >
            All types
          </button>

          {EXCEPTION_TYPE_ORDER.map((type) => {
            const active = filters.types.has(type);
            const count = data?.counts[type] ?? 0;

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  active
                    ? 'bg-zinc-900 text-white ring-zinc-900'
                    : 'bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${EXCEPTION_TYPE_DOT[type]}`} />
                {EXCEPTION_TYPE_LABELS[type]}
                <span className={active ? 'text-zinc-400' : 'text-zinc-400'}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as Filters['status'],
                }))
              }
              className="h-7 rounded-md border border-input bg-white px-1.5 text-[13px]"
            >
              <option value="">Any</option>
              <option value="open">Open</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>

          <FilterInput
            label="Min $"
            type="number"
            placeholder="0"
            value={filters.minAmount}
            onChange={(next) => setFilters((current) => ({ ...current, minAmount: next }))}
          />

          <FilterInput
            label="Max $"
            type="number"
            placeholder="∞"
            value={filters.maxAmount}
            onChange={(next) => setFilters((current) => ({ ...current, maxAmount: next }))}
          />

          <FilterInput
            label="From"
            type="date"
            value={filters.dateFrom}
            onChange={(next) => setFilters((current) => ({ ...current, dateFrom: next }))}
          />

          <FilterInput
            label="To"
            type="date"
            value={filters.dateTo}
            onChange={(next) => setFilters((current) => ({ ...current, dateTo: next }))}
          />

          {filtersActive(filters) ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="ml-auto text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Reconciling settlements…</p>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-red-600">Could not load exceptions.</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No exceptions"
          description="Every imported settlement agrees with its linked bank deposit and every movement is matched."
          actionHref="/import"
          actionLabel="Import more data"
        />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-muted-foreground">
          No exceptions match the current filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_1fr]">
          <div className="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50/40 pr-0.5 lg:sticky lg:top-4">
            {grouped.map(([type, list]) => (
              <section key={type}>
                <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-zinc-50/95 px-4 py-2 backdrop-blur-sm">
                  <PanelLabel>
                    <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${EXCEPTION_TYPE_DOT[type]}`} />
                    {EXCEPTION_TYPE_LABELS[type]}
                  </PanelLabel>
                  <span className="font-mono text-xs tabular-nums text-zinc-400">{list.length}</span>
                </header>

                {list.map((item) => (
                  <ExceptionRow
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </section>
            ))}
          </div>

          <div>{selected ? <InvestigationPanel item={selected} onOpenRecord={(record) => setDrawerTarget(record)} /> : null}</div>
        </div>
      )}

      <RecordDrawer
        target={drawerTarget}
        onNavigate={(next) => setDrawerTarget({ sourceType: next.sourceType, recordId: next.recordId })}
        onClose={() => setDrawerTarget(null)}
      />
    </div>
  );
}
