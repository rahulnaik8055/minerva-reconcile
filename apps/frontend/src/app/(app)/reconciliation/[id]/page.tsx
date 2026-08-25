'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { AiAssistNote, FieldList, Num } from '@/components/ui/data';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatusChip, ConfidenceBar } from '@/features/reconciliation/components/status-chip';
import {
  useApproveProposal,
  useCandidates,
  useOverrideProposal,
  useProposal,
  useRejectProposal,
} from '@/features/reconciliation/hooks/use-review';
import { formatCents, formatDate, formatPercent } from '@/features/reconciliation/lib/format';
import type { ProposalDetail, HydratedSource } from '@/features/reconciliation/types';

interface RationaleFeature {
  name: string;
  tier: string;
  score: number;
  detail: string;
}

type Rationale =
  | { type?: string; summary?: string; reason?: string; features?: RationaleFeature[]; ambiguous?: boolean }
  | null;

function SourcePanel({
  label,
  source,
}: {
  label: string;
  source: HydratedSource | undefined;
}) {
  return (
    <Panel className="h-full">
      <PanelHeader
        title={label}
        aside={
          source ? (
            <span className="font-mono text-meta uppercase tracking-wide text-foreground-muted/80">
              {source.sourceType.replace('_', ' ')}
            </span>
          ) : undefined
        }
      />

      {!source ? (
        <PanelBody>
          <p className="text-secondary italic text-foreground-muted">Not linked</p>
        </PanelBody>
      ) : (
        <PanelBody>
          <p className="truncate text-body font-medium text-foreground">{source.vendor ?? '—'}</p>
          <Num className="mt-0.5 block font-serif text-lg font-semibold tracking-tight">
            {formatCents(source.amountCents, source.currency ?? 'USD')}
          </Num>

          <FieldList
            className="mt-3"
            items={[
              { label: 'Date', value: <Num className="font-normal">{formatDate(source.date)}</Num> },
              { label: 'Description', value: source.description ?? '—' },
              {
                label: 'Reference',
                value: source.reference ? (
                  <span className="font-mono font-normal">{source.reference}</span>
                ) : (
                  '—'
                ),
              },
              {
                label: 'Source file',
                value: source.importFilename ? (
                  <span className="font-mono font-normal">{source.importFilename}</span>
                ) : (
                  '—'
                ),
              },
              {
                label: 'Source row',
                value:
                  source.sourceRow !== null ? (
                    <Num className="font-normal">#{source.sourceRow}</Num>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        </PanelBody>
      )}
    </Panel>
  );
}

function SignalRow({ feature }: { feature: RationaleFeature }) {
  const matched = feature.score >= 0.5;

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        aria-label={matched ? 'Signal supported' : 'Signal not supported'}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-semibold ${
          matched ? 'bg-success-bg text-success-text ring-1 ring-inset ring-success-border' : 'bg-danger-bg text-danger-text ring-1 ring-inset ring-danger-border'
        }`}
      >
        {matched ? '✓' : '✕'}
      </span>
      <div className="min-w-0">
        <p className="text-secondary font-medium capitalize text-foreground">
          {feature.name}
          <span className="ml-2 font-mono text-meta font-normal uppercase tracking-wide text-foreground-muted/80">
            {feature.tier} · {formatPercent(feature.score)}
          </span>
        </p>
        <p className="text-meta text-foreground-muted">{feature.detail}</p>
      </div>
    </li>
  );
}

function RationalePanel({ score, rationale }: { score: number; rationale: unknown }) {
  const parsed = rationale as Rationale;
  const features = parsed?.features ?? [];

  return (
    <Panel>
      <PanelHeader
        title="Match rationale"
        aside={<ConfidenceBar score={score} />}
        actions={<AiAssistNote />}
      />

      <PanelBody className="space-y-3">
        {features.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {features.map((feature) => (
              <SignalRow key={feature.name} feature={feature} />
            ))}
          </ul>
        ) : parsed?.reason ? (
          <p className="text-secondary text-foreground">
            <span className="font-medium">Reviewer note:</span> {parsed.reason}
          </p>
        ) : (
          <p className="text-secondary italic text-foreground-muted">
            Manual proposal — no automated signal breakdown.
          </p>
        )}

        {parsed?.summary ? (
          <blockquote className="border-l-2 border-info pl-3 text-secondary leading-relaxed text-foreground-muted">
            {parsed.summary}
          </blockquote>
        ) : null}

        {parsed?.ambiguous ? (
          <p className="flex items-center gap-2 rounded-sm border border-warning-border bg-warning-bg px-2.5 py-1.5 text-secondary text-warning-text">
            <span aria-hidden>⚠</span> Two or more candidates tied on score — review carefully.
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function EvidenceSection({
  sources,
  entries,
}: {
  sources: Array<HydratedSource | undefined>;
  entries: ProposalDetail['evidence'];
}) {
  return (
    <Panel>
      <PanelHeader
        title="Evidence"
        aside={<span className="text-meta text-foreground-muted">Source provenance</span>}
      />

      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
        {sources.map((source, index) => (
          <div key={index} className="min-h-20 p-4">
            {source ? (
              <>
                <p className="font-mono text-meta uppercase tracking-wide text-foreground-muted/80">
                  {source.importFilename ?? 'unknown file'} · row #{source.sourceRow ?? '?'}
                </p>
                <div className="mt-2 space-y-1 text-secondary">
                  <p className="font-medium text-foreground">{source.vendor ?? '—'}</p>
                  <p className="tabular text-foreground">
                    {formatCents(source.amountCents, source.currency ?? 'USD')} · {formatDate(source.date)}
                  </p>
                  <p className="text-foreground-muted">{source.reference ?? source.description ?? 'No reference'}</p>
                </div>
              </>
            ) : (
              <p className="text-secondary text-foreground-muted">No record on this side.</p>
            )}
          </div>
        ))}
      </div>

      {entries.length > 0 ? (
        <ul className="divide-y divide-border/60 border-t border-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 px-4 py-2">
              <span className="mt-0.5 shrink-0 rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground-muted ring-1 ring-inset ring-border">
                {entry.evidenceType}
              </span>
              <p className="text-secondary text-foreground">{entry.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
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
    <Panel className="border-border-strong">
      <PanelHeader
        title={mode === 'full' ? 'Decision' : 'Correct this decision'}
        aside={
          <span className="text-label font-semibold uppercase text-foreground-muted/70">
            Human decision
          </span>
        }
      />

      <PanelBody className="space-y-3">
        {mode === 'full' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="lg"
                disabled={approve.isPending || override.isPending}
                onClick={() => approve.mutate(note.trim() ? note.trim() : undefined)}
              >
                Approve
              </Button>

              <Button
                variant="danger-outline"
                size="lg"
                disabled={reject.isPending || override.isPending}
                onClick={() => setShowReject((current) => !current)}
                aria-expanded={showReject}
              >
                Reject
              </Button>

              <Button
                variant="outline"
                size="lg"
                disabled={override.isPending}
                onClick={() => setShowOverride((current) => !current)}
                aria-expanded={showOverride}
              >
                Override
              </Button>
            </div>

            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional approval note (min 3 chars)"
              aria-label="Optional approval note"
              className="w-full sm:ml-auto sm:w-64"
            />
          </div>
        ) : (
          <p className="max-w-2xl text-secondary text-foreground-muted">
            This decision is historical and cannot be edited. Submit an override to supersede it with
            a new manual proposal — the original is preserved.
          </p>
        )}

        {showReject ? (
          <div className="animate-fade-in rounded-sm border border-danger-border bg-danger-bg p-3">
            <label
              htmlFor="reject-reason"
              className="block text-label font-semibold uppercase tracking-wide text-danger-text"
            >
              Rejection reason (required)
            </label>
            <textarea
              id="reject-reason"
              rows={2}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Why is this match wrong?"
              className="mt-1.5 w-full rounded-sm border border-danger-border bg-surface px-2.5 py-1.5 text-body focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
            />
            <div className="mt-2 flex gap-2">
              <Button
                variant="destructive"
                disabled={rejectReason.trim().length < 3 || reject.isPending}
                onClick={() => {
                  reject.mutate(rejectReason.trim(), {
                    onSuccess: () => {
                      setRejectReason('');
                      setShowReject(false);
                    },
                  });
                }}
              >
                Confirm rejection
              </Button>
              <Button variant="outline" onClick={() => setShowReject(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {showOverride ? (
          <div className="animate-fade-in space-y-2 rounded-sm border border-border-strong bg-surface-muted p-3">
            <p className="text-secondary text-foreground-muted">
              Override preserves this proposal and creates a new manual one linked to your selection.
            </p>

            <label htmlFor="candidate-select" className="block pt-1 text-body font-medium">
              Alternative candidate
            </label>
            <select
              id="candidate-select"
              value={selectedCandidate}
              onChange={(event) => setSelectedCandidate(event.target.value)}
              className="w-full rounded-sm border border-border-strong bg-surface px-2.5 py-2 text-body focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
            >
              <option value="">Keep current links (no replacement)</option>
              {(candidateData?.candidates ?? []).map((candidate) => (
                <option
                  key={`${candidate.sourceType}:${candidate.recordId}`}
                  value={`${candidate.sourceType}:${candidate.recordId}`}
                >
                  {formatPercent(candidate.score)} · {candidate.label} ({formatCents(candidate.amountCents)})
                </option>
              ))}
            </select>

            {candidateData && candidateData.candidates.length === 0 ? (
              <p className="text-meta text-foreground-muted">
                No scored alternatives found for this bank transaction.
              </p>
            ) : null}

            <label htmlFor="override-reason" className="block pt-1 text-body font-medium">
              Reason (required)
            </label>
            <textarea
              id="override-reason"
              rows={2}
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Why is an override needed?"
              className="w-full rounded-sm border border-border-strong bg-surface px-2.5 py-1.5 text-body focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
            />

            <div className="flex gap-2">
              <Button
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
              >
                Submit override
              </Button>
              <Button variant="outline" onClick={() => setShowOverride(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

export default function ProposalReviewPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { data, isLoading, isError } = useProposal(id);

  if (isLoading) {
    return <p className="py-12 text-center text-secondary text-foreground-muted" aria-busy>Loading proposal…</p>;
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
    <div className="space-y-6">
      <Link
        href="/reconciliation"
        className="inline-flex items-center gap-1 text-secondary font-medium text-foreground-muted hover:text-foreground"
      >
        <span aria-hidden>←</span> Reconciliation
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border pb-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={data.status as 'pending' | 'accepted' | 'rejected'} />
            <span className="font-mono text-meta uppercase tracking-wide text-foreground-muted/80">
              {data.method}
            </span>
            {data.supersededBy ? <Badge tone="warning">superseded</Badge> : null}
          </div>
          <h1 className="mt-2 max-w-3xl font-serif text-title font-semibold tracking-tight text-foreground">
            {bankSource?.description ?? bankSource?.vendor ?? 'Proposal review'}
          </h1>
          {data.decidedBy ? (
            <p className="mt-1 text-secondary text-foreground-muted">
              Decided by {data.decidedBy} · {formatDate(data.decidedAt)}
            </p>
          ) : (
            <p className="mt-1 text-secondary text-foreground-muted">
              Compare both records and the evidence before deciding.
            </p>
          )}
        </div>

        <Num className="shrink-0 font-serif text-title font-semibold tracking-tight">
          {formatCents(bankSource?.amountCents ?? null, bankSource?.currency ?? 'USD')}
        </Num>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <SourcePanel label="Source record" source={bankSource} />
        <SourcePanel label="Proposed match" source={matchedSource} />
      </div>

      <RationalePanel score={data.score} rationale={data.rationale} />

      <EvidenceSection sources={[bankSource, matchedSource]} entries={data.evidence} />

      <DecisionActions proposalId={id} mode={data.status === 'pending' ? 'full' : 'overrideOnly'} />
    </div>
  );
}
