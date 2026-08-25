'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { FieldList, Num, AiAssistNote } from '@/components/ui/data';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatusChip, ConfidenceBar } from '@/features/reconciliation/components/status-chip';
import {
  useAiExplanation,
  useApproveProposal,
  useCandidates,
  useOverrideProposal,
  useProposal,
  useRejectProposal,
} from '@/features/reconciliation/hooks/use-review';
import { formatCents, formatDate, formatPercent } from '@/features/reconciliation/lib/format';
import type { AiExplanation, ProposalDetail, HydratedSource } from '@/features/reconciliation/types';

interface RationaleFeature {
  name: string;
  tier: string;
  score: number;
  detail: string;
}

type Rationale =
  | { type?: string; summary?: string; reason?: string; features?: RationaleFeature[]; ambiguous?: boolean }
  | null;

const METHOD_LABELS: Record<string, string> = {
  engine_match: 'Automatic match',
  manual: 'Manual proposal',
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  bank_transaction: 'Bank transaction',
  ledger_entry: 'Ledger entry',
  invoice: 'Invoice',
  settlement: 'Settlement',
};

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
            <span className="text-meta font-medium text-foreground-muted">
              {SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType}
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
        <p className="text-secondary font-medium text-foreground">
          {feature.name}
          <span className="ml-2 text-meta font-normal text-foreground-muted">
            {feature.tier.replace(/_/g, ' ')} · {formatPercent(feature.score)}
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
        aside={
          <span className="flex items-center gap-2">
            <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted ring-1 ring-inset ring-border">
              Engine score
            </span>
            <ConfidenceBar score={score} />
          </span>
        }
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
  entries,
}: {
  entries: ProposalDetail['evidence'];
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader
        title="Evidence"
        aside={<span className="text-meta text-foreground-muted">Source provenance</span>}
      />

      <ul className="divide-y divide-border/60">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-2">
            <span className="mt-0.5 shrink-0 rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground-muted ring-1 ring-inset ring-border">
              {entry.evidenceType.replace(/_/g, ' ')}
            </span>
            <p className="text-secondary text-foreground">{entry.detail}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RecommendedActionBadge({ action }: { action: string }) {
  const LABELS: Record<string, string> = {
    approve: 'Approve',
    reject: 'Reject',
    override: 'Override',
    investigate_further: 'Investigate further',
    escalate_to_provider: 'Escalate to provider',
  };

  const TONES: Record<string, string> = {
    approve: 'success',
    reject: 'danger',
    override: 'warning',
    investigate_further: 'info',
    escalate_to_provider: 'warning',
  };

  const tone = TONES[action] ?? 'default';

  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
        tone === 'success'
          ? 'bg-success-bg text-success-text ring-success-border'
          : tone === 'danger'
            ? 'bg-danger-bg text-danger-text ring-danger-border'
            : tone === 'warning'
              ? 'bg-warning-bg text-warning-text ring-warning-border'
              : tone === 'info'
                ? 'bg-info-bg text-info-text ring-info-border'
                : 'bg-surface-muted text-foreground-muted ring-border'
      }`}
    >
      {LABELS[action] ?? action}
    </span>
  );
}

function AiExplanationPanel({
  proposalId,
  isPending,
}: {
  proposalId: string;
  isPending: boolean;
}) {
  const ai = useAiExplanation(proposalId);
  const data = ai.data as AiExplanation | undefined;

  return (
    <Panel>
      <PanelHeader
        title="AI analysis"
        aside={
          ai.data ? (
            <AiAssistNote
              variant="drafted"
              title="AI-drafted"
              note="Pending your review"
              className="border-0 bg-transparent p-0"
            />
          ) : (
            <span className="text-meta text-foreground-muted">Advisory only</span>
          )
        }
      />

      <PanelBody className="space-y-3">
        {!ai.data && !ai.isPending ? (
          <Button
            variant="outline"
            disabled={ai.isPending}
            onClick={() => ai.mutate()}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Get AI analysis
          </Button>
        ) : ai.isPending ? (
          <p className="text-secondary italic text-foreground-muted" aria-busy>
            Analyzing…
          </p>
        ) : ai.data ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <RecommendedActionBadge action={data!.recommendedAction} />
              <span className="text-meta text-foreground-muted">
                AI confidence {formatPercent(data!.confidence)}
              </span>
            </div>

            <p className="text-secondary leading-relaxed text-foreground">
              {data!.recommendation}
            </p>

            {data!.reasoning ? (
              <blockquote className="border-l-2 border-info-border pl-3 text-secondary leading-relaxed text-foreground-muted">
                {data!.reasoning}
              </blockquote>
            ) : null}

            {data!.supportingEvidence.length > 0 ? (
              <div>
                <p className="text-label font-semibold uppercase text-foreground-muted">Supporting</p>
                <ul className="mt-1 space-y-0.5">
                  {data!.supportingEvidence.map((ref) => (
                    <li key={ref.ref} className="text-secondary text-foreground">
                      <span className="font-mono text-meta text-foreground-muted">{ref.ref}</span>{' '}
                      {ref.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data!.contradictingEvidence.length > 0 ? (
              <div>
                <p className="text-label font-semibold uppercase text-foreground-muted">Contradicting</p>
                <ul className="mt-1 space-y-0.5">
                  {data!.contradictingEvidence.map((ref) => (
                    <li key={ref.ref} className="text-secondary text-foreground">
                      <span className="font-mono text-meta text-foreground-muted">{ref.ref}</span>{' '}
                      {ref.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </PanelBody>
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
            <span className="text-meta font-medium text-foreground-muted">
              {METHOD_LABELS[data.method] ?? data.method}
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

      <AiExplanationPanel proposalId={id} isPending={data.status === 'pending'} />

      <EvidenceSection entries={data.evidence} />

      <DecisionActions proposalId={id} mode={data.status === 'pending' ? 'full' : 'overrideOnly'} />
    </div>
  );
}
