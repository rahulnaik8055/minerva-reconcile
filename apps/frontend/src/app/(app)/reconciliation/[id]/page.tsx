'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader, PanelLabel, EmptyState } from '@/components/layout/page-header';
import { StatusChip, ConfidenceBar } from '@/features/reconciliation/components/status-chip';
import {
  useApproveProposal,
  useCandidates,
  useOverrideProposal,
  useProposal,
  useRejectProposal,
} from '@/features/reconciliation/hooks/use-review';
import { formatCents, formatDate, formatPercent } from '@/features/reconciliation/lib/format';
import type { HydratedSource } from '@/features/reconciliation/types';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 py-1.5 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-zinc-800">{value}</dd>
    </div>
  );
}

function SourcePanel({
  label,
  source,
}: {
  label: string;
  source: HydratedSource | undefined;
}) {
  if (!source) {
    return (
      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <PanelLabel>{label}</PanelLabel>
        <p className="mt-4 text-sm text-zinc-400">Not linked</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
        <PanelLabel>{label}</PanelLabel>
        <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
          {source.sourceType.replace('_', ' ')}
        </span>
      </header>

      <dl className="px-4 py-2">
        <Field
          label="Date"
          value={<span className="font-mono tabular-nums">{formatDate(source.date)}</span>}
        />
        <Field
          label="Amount"
          value={
            <span className="font-mono tabular-nums">
              {formatCents(source.amountCents, source.currency ?? 'USD')}
            </span>
          }
        />
        <Field label="Vendor" value={source.vendor ?? '—'} />

        {source.description ? (
          <Field label="Description" value={source.description} />
        ) : null}

        <Field label="Reference" value={
            source.reference ? (
              <span className="font-mono text-xs">{source.reference}</span>
            ) : (
              <span className="text-zinc-400">—</span>
            )
          }
        />
        <Field label="Source file" value={
            source.importFilename ? (
              <span className="font-mono text-xs">{source.importFilename}</span>
            ) : (
              <span className="text-zinc-400">—</span>
            )
          }
        />
        <Field
          label="Source row"
          value={
            source.sourceRow !== null ? (
              <span className="font-mono tabular-nums">#{source.sourceRow}</span>
            ) : (
              <span className="text-zinc-400">—</span>
            )
          }
        />
      </dl>
    </section>
  );
}

interface RationaleFeature {
  name: string;
  tier: string;
  score: number;
  detail: string;
}

function RationalePanel({
  proposalId,
}: {
  proposalId: string;
}) {
  const { data } = useProposal(proposalId);

  if (!data) {
    return null;
  }

  const rationale = data.rationale as
    | { type?: string; summary?: string; reason?: string; features?: RationaleFeature[]; ambiguous?: boolean }
    | null;

  const features = rationale?.features ?? [];

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2">
        <PanelLabel>Match Rationale</PanelLabel>
        <ConfidenceBar score={data.score} />
      </header>

      <div className="space-y-1 px-4 py-3">
        {features.length > 0 ? (
          features.map((feature) => {
            const matched = feature.score >= 0.5;

            return (
              <div key={feature.name} className="flex items-start gap-2 py-0.5">
                <span
                  aria-hidden
                  className={`mt-0.5 font-mono text-sm ${matched ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {matched ? '✓' : '✕'}
                </span>
                <div>
                  <p className="text-[13px] font-medium capitalize text-zinc-800">
                    {feature.name}
                    <span className="ml-2 font-mono text-[11px] font-normal uppercase tracking-wide text-zinc-400">
                      {feature.tier} · {formatPercent(feature.score)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{feature.detail}</p>
                </div>
              </div>
            );
          })
        ) : rationale?.reason ? (
          <p className="text-[13px] text-zinc-700">
            <span className="font-medium">Reviewer note:</span> {rationale.reason}
          </p>
        ) : (
          <p className="text-[13px] text-zinc-500">
            Manual proposal — no automated signal breakdown.
          </p>
        )}

        {rationale?.summary ? (
          <p className="mt-3 rounded-sm bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-700 ring-1 ring-inset ring-zinc-100">
            {rationale.summary}
          </p>
        ) : null}

        {rationale?.ambiguous ? (
          <p className="mt-2 text-[13px] font-medium text-amber-700">
            ⚠ Two or more candidates tied on score — review carefully.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DecisionActions({
  proposalId,
  mode,
}: {
  proposalId: string;
  mode: 'full' | 'overrideOnly';
}) {
  const [note, setNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');

  const approve = useApproveProposal(proposalId);
  const reject = useRejectProposal(proposalId);
  const override = useOverrideProposal(proposalId);
  const { data: candidateData } = useCandidates(proposalId, showOverride);

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <header className="border-b border-zinc-200 px-4 py-2">
        <PanelLabel>{mode === 'full' ? 'Decision' : 'Correct this decision'}</PanelLabel>
      </header>

      <div className="space-y-3 px-4 py-3">
        {mode === 'full' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={approve.isPending || override.isPending}
              onClick={() => approve.mutate(note.trim() ? note.trim() : undefined)}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Approve
            </button>

            <button
              type="button"
              disabled={reject.isPending || override.isPending}
              onClick={() => setShowReject((current) => !current)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-[13px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>

            <button
              type="button"
              disabled={override.isPending}
              onClick={() => setShowOverride((current) => !current)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Override
            </button>

            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional approval note (min 3 chars)"
              className="ml-auto h-8 w-64 rounded-md border border-input px-2 text-[13px]"
            />
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            This decision is historical and cannot be edited. Submit an override to supersede it with a new manual proposal — the original is preserved.
          </p>
        )}

        {showReject ? (
          <div className="rounded-sm border border-red-100 bg-red-50/60 p-3">
            <label className="block text-xs font-medium text-red-800" htmlFor="reject-reason">
              Rejection reason (required)
            </label>
            <textarea
              id="reject-reason"
              rows={2}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Why is this match wrong?"
              className="mt-1 w-full rounded-md border border-red-200 bg-white px-2 py-1.5 text-[13px]"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={rejectReason.trim().length < 3 || reject.isPending}
                onClick={() => {
                  reject.mutate(rejectReason.trim(), {
                    onSuccess: () => {
                      setRejectReason('');
                      setShowReject(false);
                    },
                  });
                }}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                Confirm rejection
              </button>
              <button
                type="button"
                onClick={() => setShowReject(false)}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {showOverride ? (
          <div className="rounded-sm border border-zinc-200 bg-zinc-50/70 p-3">
            <p className="text-xs font-medium text-zinc-700">
              Override preserves this proposal and creates a new manual one linked to your selection.
            </p>

            <label className="mt-2 block text-xs font-medium text-zinc-700" htmlFor="candidate-select">
              Alternative candidate
            </label>
            <select
              id="candidate-select"
              value={selectedCandidate}
              onChange={(event) => setSelectedCandidate(event.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-white px-2 py-1.5 text-[13px]"
            >
              <option value="">Keep current links (no replacement)</option>
              {(candidateData?.candidates ?? []).map((candidate) => (
                <option key={`${candidate.sourceType}:${candidate.recordId}`} value={`${candidate.sourceType}:${candidate.recordId}`}>
                  {formatPercent(candidate.score)} · {candidate.label} ({formatCents(candidate.amountCents)})
                </option>
              ))}
            </select>

            {candidateData && candidateData.candidates.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No scored alternatives found for this bank transaction.
              </p>
            ) : null}

            <label className="mt-2 block text-xs font-medium text-zinc-700" htmlFor="override-reason">
              Reason (required)
            </label>
            <textarea
              id="override-reason"
              rows={2}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Why is an override needed?"
              className="mt-1 w-full rounded-md border border-input bg-white px-2 py-1.5 text-[13px]"
            />

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={overrideReason.trim().length < 3 || override.isPending}
                onClick={() => {
                  const [sourceType, recordId] = selectedCandidate.split(':');

                  override.mutate(
                    {
                      reason: overrideReason.trim(),
                      ...(recordId ? { candidateSourceType: sourceType, candidateRecordId: recordId } : {}),
                    },
                    {
                      onSuccess: () => {
                        setOverrideReason('');
                        setShowOverride(false);
                        setSelectedCandidate('');
                      },
                    },
                  );
                }}
                className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                Submit override
              </button>
              <button
                type="button"
                onClick={() => setShowOverride(false)}
                className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ProposalReviewPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data, isLoading, isError } = useProposal(id);

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading proposal…</p>;
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Proposal not found"
        description="It may have been removed or the link is incorrect."
        actionHref="/reconciliation"
        actionLabel="Back to reconciliation"
      />
    );
  }

  const bankSource = data.hydratedSources.find((source) => source.sourceType === 'bank_transaction');
  const matchedSource = data.hydratedSources.find((source) => source.sourceType !== 'bank_transaction');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/reconciliation" className="font-medium text-zinc-500 hover:text-zinc-900">
          ← Reconciliation
        </Link>
        <StatusChip status={data.status as 'pending' | 'accepted' | 'rejected'} />
        <span className="font-mono text-xs text-zinc-400">{data.method}</span>
        {data.decidedBy ? (
          <span className="text-xs text-muted-foreground">
            decided by {data.decidedBy} · {formatDate(data.decidedAt)}
          </span>
        ) : null}
        {data.supersededBy ? (
          <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            superseded
          </span>
        ) : null}
      </div>

      <PageHeader title="Proposal review" subtitle="Compare both records and the evidence before deciding." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SourcePanel label="Bank Transaction" source={bankSource} />
        <SourcePanel label="Matched Record" source={matchedSource} />
      </div>

      <RationalePanel proposalId={id} />

      <section className="rounded-md border border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 px-4 py-2">
          <PanelLabel>Evidence</PanelLabel>
        </header>

        <div className="grid grid-cols-1 divide-y divide-zinc-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {[bankSource, matchedSource].map((source, index) => (
            <div key={index} className="min-h-24 p-4">
              {source ? (
                <>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                    {source.importFilename ?? 'unknown file'} · row #{source.sourceRow ?? '?'}
                  </p>
                  <div className="mt-2 space-y-1 text-[13px]">
                    <p className="font-medium text-zinc-800">{source.vendor ?? '—'}</p>
                    <p className="font-mono tabular-nums text-zinc-700">
                      {formatCents(source.amountCents, source.currency ?? 'USD')} · {formatDate(source.date)}
                    </p>
                    <p className="text-zinc-600">{source.reference ?? source.description ?? 'No reference'}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400">No record on this side.</p>
              )}
            </div>
          ))}
        </div>

        {data.evidence.length > 0 ? (
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {data.evidence.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-2">
                <span className="mt-0.5 rounded-sm bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-zinc-500">
                  {entry.evidenceType}
                </span>
                <p className="text-[13px] text-zinc-700">{entry.detail}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <DecisionActions proposalId={id} mode={data.status === 'pending' ? 'full' : 'overrideOnly'} />
    </div>
  );
}
