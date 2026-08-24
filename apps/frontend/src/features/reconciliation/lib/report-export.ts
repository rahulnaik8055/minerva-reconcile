import type { ExceptionItem, ReviewSummary, WorklistItem } from '../types';

export interface ReportExportPayload {
  generatedAt: string;
  summary: Pick<
    ReviewSummary,
    | 'totalBankTransactions'
    | 'accepted'
    | 'rejected'
    | 'overridden'
    | 'unmatchedBankTransactions'
    | 'unresolvedValueCents'
  >;
  decisions: Array<{
    proposalId: string;
    bankTransactionId: string;
    bankDate: string;
    bankDescription: string;
    bankReference: string | null;
    amountCents: number;
    currency: string;
    matchedRecord: string | null;
    confidence: number | null;
    status: string;
    rationale: string | null;
    reviewer: string | null;
    reviewedAt: string | null;
  }>;
  exceptions: Array<{
    id: string;
    exceptionType: string;
    title: string;
    amountCents: number;
    currency: string;
    varianceCents: number | null;
    status: string;
    evidence: string[];
    resolution: string;
    proposalId: string | null;
  }>;
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

const DECISION_HEADERS = [
  'proposal_id',
  'bank_transaction_id',
  'bank_date',
  'bank_description',
  'bank_reference',
  'amount',
  'currency',
  'matched_record',
  'confidence',
  'status',
  'rationale',
  'reviewer',
  'reviewed_at',
] as const;

const EXCEPTION_HEADERS = [
  'exception_id',
  'exception_type',
  'title',
  'amount',
  'currency',
  'variance',
  'status',
  'evidence',
  'resolution',
  'proposal_id',
] as const;

export function buildDecisionsCsv(decisions: WorklistItem[]): string {
  const lines = [DECISION_HEADERS.join(',')];

  for (const item of decisions) {
    lines.push(
      [
        item.proposalId ?? '',
        item.bankTransactionId,
        item.date,
        item.description,
        item.reference ?? '',
        centsToDollars(item.amountCents),
        item.currency,
        item.bestMatch?.label ?? '',
        item.score === null ? '' : item.score.toFixed(4),
        item.status,
        item.rationaleText ?? '',
        item.decidedBy ?? '',
        item.decidedAt ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return lines.join('\n');
}

export function buildExceptionsCsv(exceptions: ExceptionItem[]): string {
  const lines = [EXCEPTION_HEADERS.join(',')];

  for (const item of exceptions) {
    lines.push(
      [
        item.id,
        item.exceptionType,
        item.title,
        centsToDollars(item.amountCents),
        item.currency,
        item.varianceCents === null ? '' : centsToDollars(item.varianceCents),
        item.status,
        item.evidence.map((entry) => `${entry.label}: ${entry.detail}`).join(' | '),
        item.status === 'resolved' ? 'Resolved via accepted proposal' : EXCEPTION_STATUS_TEXT[item.status],
        item.proposalId ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return lines.join('\n');
}

const EXCEPTION_STATUS_TEXT: Record<string, string> = {
  open: 'Open — awaiting review',
  in_review: 'In review — pending decision',
};

export function buildReportJson(
  summary: ReportExportPayload['summary'],
  decisions: WorklistItem[],
  exceptions: ExceptionItem[],
): string {
  const payload: ReportExportPayload = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalBankTransactions: summary.totalBankTransactions,
      accepted: summary.accepted,
      rejected: summary.rejected,
      overridden: summary.overridden,
      unmatchedBankTransactions: summary.unmatchedBankTransactions,
      unresolvedValueCents: summary.unresolvedValueCents,
    },
    decisions: decisions.map((item) => ({
      proposalId: item.proposalId ?? '',
      bankTransactionId: item.bankTransactionId,
      bankDate: item.date,
      bankDescription: item.description,
      bankReference: item.reference,
      amountCents: item.amountCents,
      currency: item.currency,
      matchedRecord: item.bestMatch?.label ?? null,
      confidence: item.score,
      status: item.status,
      rationale: item.rationaleText,
      reviewer: item.decidedBy,
      reviewedAt: item.decidedAt,
    })),
    exceptions: exceptions.map((item) => ({
      id: item.id,
      exceptionType: item.exceptionType,
      title: item.title,
      amountCents: item.amountCents,
      currency: item.currency,
      varianceCents: item.varianceCents,
      status: item.status,
      evidence: item.evidence.map((entry) => `${entry.label}: ${entry.detail}`),
      resolution:
        item.status === 'resolved'
          ? 'Resolved via accepted proposal'
          : (EXCEPTION_STATUS_TEXT[item.status] ?? item.status),
      proposalId: item.proposalId,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
