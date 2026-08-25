'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/layout/page-header';
import { Badge, badgeDotClass } from '@/components/ui/badge';
import { Panel, PanelLabel } from '@/components/ui/panel';
import { Input } from '@/components/ui/input';
import {
  EXCEPTION_TYPE_LABELS,
  EXCEPTION_TYPE_ORDER,
  EXCEPTION_TYPE_TONE,
  EXCEPTION_STATUS_LABELS,
  EXCEPTION_STATUS_TONE,
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
    <div className="min-w-[8.5rem] flex-1 border-l border-border px-4 py-3 first:border-l-0 sm:px-5">
      <dt className="text-label font-semibold uppercase text-foreground-muted">{label}</dt>
      <dd className={`tabular mt-1.5 font-serif text-lg leading-none tracking-tight ${tone ?? 'text-foreground'}`}>
        {value}
      </dd>
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
    <label className="flex items-center gap-1.5 text-meta font-medium text-foreground-muted">
      <span>{label}</span>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-7 w-32 py-0 text-secondary"
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
      aria-current={selected ? 'true' : undefined}
      className={`flex w-full items-start justify-between gap-3 border-b border-border/60 px-4 py-2.5 text-left transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
        selected
          ? 'bg-surface-muted ring-1 ring-inset ring-primary/30'
          : 'hover:bg-surface-muted/50'
      }`}
    >
      <span className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${badgeDotClass(EXCEPTION_TYPE_TONE[item.exceptionType])}`} />
        <span className="min-w-0">
          <span className="block truncate text-secondary font-medium text-foreground">{item.title}</span>
          <span className="tabular block truncate text-meta text-foreground-muted">
            {formatDate(item.date)}
            {item.detail ? ` · ${item.detail}` : ''}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="tabular block text-secondary font-medium text-foreground">
          {formatCents(item.amountCents, item.currency)}
        </span>

        {item.varianceCents !== null ? (
          <span
            className={`tabular block text-meta ${
              item.varianceCents === 0 ? 'text-success-text' : 'text-danger-text'
            }`}
          >
            {formatSignedCents(item.varianceCents, item.currency)}
          </span>
        ) : (
          <Badge tone={EXCEPTION_STATUS_TONE[item.status]} className="mt-0.5 text-[10px]">
            {EXCEPTION_STATUS_LABELS[item.status]}
          </Badge>
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
    <div className="space-y-6">
      <PageHeader
        title="Exceptions"
        description="Every disagreement the engine could support with records — grouped by cause, ready to investigate."
      />

      <dl className="flex flex-wrap overflow-hidden rounded-md border border-border bg-surface" data-testid="exceptions-summary">
        <StatusStat label="Exceptions" value={items.length} />
        <StatusStat label="Open" value={statusCounts.open} tone="text-danger-text" />
        <StatusStat label="In review" value={statusCounts.inReview} tone="text-warning-text" />
        <StatusStat label="Resolved" value={statusCounts.resolved} tone="text-success-text" />
      </dl>

      <Panel>
        <div className="space-y-2.5 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilters((current) => ({ ...current, types: new Set() }))}
              aria-pressed={filters.types.size === 0}
              className={`rounded-full px-2.5 py-1 text-meta font-medium ring-1 ring-inset focus-visible:ring-2 focus-visible:ring-ring ${
                filters.types.size === 0
                  ? 'bg-primary text-white ring-primary'
                  : 'bg-surface text-foreground-muted ring-border-strong hover:bg-surface-muted'
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
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-meta font-medium ring-1 ring-inset focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? 'bg-primary text-white ring-primary'
                      : 'bg-surface text-foreground-muted ring-border-strong hover:bg-surface-muted'
                  }`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${badgeDotClass(EXCEPTION_TYPE_TONE[type])}`} />
                  {EXCEPTION_TYPE_LABELS[type]}
                  <span className="tabular text-foreground-muted/70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-2.5">
            <label className="flex items-center gap-1.5 text-meta font-medium text-foreground-muted">
              Status
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as Filters['status'],
                  }))
                }
                className="h-7 rounded-sm border border-border-strong bg-surface px-1.5 text-secondary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
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
                className="ml-auto text-meta font-medium text-foreground-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Reset filters
              </button>
            ) : null}
          </div>
        </div>
      </Panel>

      {isLoading ? (
        <p className="py-12 text-center text-secondary text-foreground-muted" aria-busy>Reconciling settlements…</p>
      ) : isError ? (
        <p className="py-12 text-center text-secondary text-danger-text">Could not load exceptions.</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No exceptions"
          description="Every imported settlement agrees with its linked bank deposit and every movement is matched."
          actionHref="/import"
          actionLabel="Import more data"
        />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-secondary text-foreground-muted">
          No exceptions match the current filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_1fr] xl:grid-cols-[24rem_1fr]">
          <div className="scrollbar-thin max-h-none space-y-4 overflow-y-auto lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)]">
            {grouped.map(([type, list]) => (
              <Panel key={type}>
                <header className="sticky top-0 z-10 flex items-center justify-between rounded-t-md border-b border-border bg-surface-muted/95 px-4 py-2">
                  <span className="flex items-center gap-1.5">
                    <Badge tone={EXCEPTION_TYPE_TONE[type]} dot aria-hidden />
                    <PanelLabel>{EXCEPTION_TYPE_LABELS[type]}</PanelLabel>
                  </span>
                  <span className="tabular text-meta text-foreground-muted">{list.length}</span>
                </header>

                {list.map((item) => (
                  <ExceptionRow
                    key={item.id}
                    item={item}
                    selected={item.id === selectedId}
                    onSelect={() => {
                      setSelectedId(item.id);

                      if (window.matchMedia('(max-width: 1023px)').matches) {
                        requestAnimationFrame(() => {
                          document.getElementById('investigation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                      }
                    }}
                  />
                ))}
              </Panel>
            ))}
          </div>

          <div id="investigation" className="scroll-mt-20">
            {selected ? (
              <InvestigationPanel item={selected} onOpenRecord={(record) => setDrawerTarget(record)} />
            ) : null}
          </div>
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
