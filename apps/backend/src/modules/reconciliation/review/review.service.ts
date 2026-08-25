import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { PgTransaction } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  activityLog,
  bankTransactions,
  evidence,
  imports as importsTable,
  invoices,
  ledgerEntries,
  proposalLinks,
  reconciliationProposals,
  settlementLines,
  settlements,
} from '../../../database/schema';
import { computeActivityHash, GENESIS_HASH } from '../domain/audit/activity-hash';
import { verifyActivityChain } from '../domain/audit/verify-chain';
import type { ActivityChainEntry } from '../domain/audit/verify-chain';
import { reconcileSettlements } from '../domain/settlements/settlement-reconciler';
import { formatMoney } from '../domain/settlements/money';
import { normalizeReference } from '../../imports/lib/normalize';
import {
  buildAiSystemPrompt,
  sanitizeAiExplanation,
} from '../ai/ai-sanitize';
import type { AllowedAiEvidenceRef, AiExplanationDto, AiStatusDto } from '../ai/ai-sanitize';
import { completeJson, getAiProviderConfig, isAiConfigured } from '../ai/ai-provider';
import type {
  SettlementReconciliationItem,
} from '../domain/settlements/types';
import { generateProposals } from '../domain/engine';
import type { Database, DatabaseConnection } from '../../../interfaces/database.interface';
import type {
  ActivityEntryDto,
  ActivityFeedDto,
  CandidateOptionDto,
  DecisionResultDto,
  ExceptionCauseDto,
  ExceptionEvidenceDto,
  ExceptionItemDto,
  ExceptionStatus,
  ExceptionType,
  ExceptionsResponseDto,
  HydratedSourceDto,
  OverrideResultDto,
  PaginatedProposalsDto,
  ProposalDetailDto,
  ProposalSourceDto,
  ProposalSummaryDto,
  EvidenceEntryDto,
  RecordParams,
  RecordDetailDto,
  ReviewSummaryDto,
  SettlementLineDto,
  WorklistItemDto,
  WorklistQuery,
} from './dto/review.dto';
import type {
  ApproveProposalInput,
  ListActivityQuery,
  ListProposalsQuery,
  OverrideProposalInput,
  RejectProposalInput,
} from './dto/review.dto';

export type DbExecutor =
  | DatabaseConnection['db']
  | PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export interface PaginatedWorklistDto {
  items: WorklistItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const bankLinkTable = alias(proposalLinks, 'bank_link');

type ProposalRow = typeof reconciliationProposals.$inferSelect;
type EvidenceRow = typeof evidence.$inferSelect;
type ActivityRow = typeof activityLog.$inferSelect;

interface AppendActivityInput {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState: unknown;
  newState: unknown;
  reason: string | null;
  aiUsed?: boolean;
}

@Injectable()
export class ReviewService {
  constructor(@Inject(DATABASE_CONNECTION) private readonly database: DatabaseConnection) {}

  async listProposals(query: ListProposalsQuery): Promise<PaginatedProposalsDto> {
    const offset = (query.page - 1) * query.limit;

    const where = query.status === undefined ? undefined : eq(reconciliationProposals.status, query.status);

    const rows = await this.database.db
      .select()
      .from(reconciliationProposals)
      .where(where)
      .orderBy(desc(reconciliationProposals.createdAt), desc(reconciliationProposals.id))
      .limit(query.limit)
      .offset(offset);

    const [{ total }] = await this.database.db
      .select({ total: sql<number>`count(*)::int` })
      .from(reconciliationProposals)
      .where(where);

    const links = rows.length > 0 ? await loadProposalLinks(this.database.db, rows.map((row) => row.id)) : new Map<string, ProposalSourceDto[]>();

    return {
      items: rows.map((row) => toProposalSummary(row, links.get(row.id) ?? [])),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async getProposal(id: string): Promise<ProposalDetailDto> {
    const [row] = await this.database.db
      .select()
      .from(reconciliationProposals)
      .where(eq(reconciliationProposals.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Proposal ${id} was not found`);
    }

    const links = await loadProposalLinks(this.database.db, [row.id]);
    const evidenceRows = await this.database.db
      .select()
      .from(evidence)
      .where(eq(evidence.proposalId, row.id))
      .orderBy(asc(evidence.sourceType), asc(evidence.evidenceType));

    const hydratedSources = await this.hydrateSources(links.get(row.id) ?? []);

    return {
      ...toProposalSummary(row, links.get(row.id) ?? []),
      evidence: evidenceRows.map(toEvidenceDto),
      hydratedSources,
    };
  }

  async approveProposal(id: string, actor: string, input: ApproveProposalInput): Promise<DecisionResultDto> {
    return this.database.db.transaction(async (tx) => {
      const proposal = await this.lockProposal(tx, id);

      if (proposal.status !== 'pending') {
        throw invalidTransition('approve', proposal.status);
      }

      const [updated] = await tx
        .update(reconciliationProposals)
        .set({ status: 'accepted', decidedAt: new Date(), decidedBy: actor })
        .where(eq(reconciliationProposals.id, id))
        .returning();

      const entry = await appendActivityEntry(tx, {
        actor,
        action: 'proposal.approved',
        entityType: 'proposal',
        entityId: id,
        previousState: { status: proposal.status },
        newState: { status: 'accepted' },
        reason: input.note ?? null,
        aiUsed: input.aiUsed ?? false,
      });

      return { proposal: toProposalSummary(updated, []), activity: [toActivityDto(entry)] };
    });
  }

  async rejectProposal(id: string, actor: string, input: RejectProposalInput): Promise<DecisionResultDto> {
    return this.database.db.transaction(async (tx) => {
      const proposal = await this.lockProposal(tx, id);

      if (proposal.status !== 'pending') {
        throw invalidTransition('reject', proposal.status);
      }

      const [updated] = await tx
        .update(reconciliationProposals)
        .set({ status: 'rejected', decidedAt: new Date(), decidedBy: actor })
        .where(eq(reconciliationProposals.id, id))
        .returning();

      const entry = await appendActivityEntry(tx, {
        actor,
        action: 'proposal.rejected',
        entityType: 'proposal',
        entityId: id,
        previousState: { status: proposal.status },
        newState: { status: 'rejected' },
        reason: input.reason,
        aiUsed: input.aiUsed ?? false,
      });

      return { proposal: toProposalSummary(updated, []), activity: [toActivityDto(entry)] };
    });
  }

  async overrideProposal(id: string, actor: string, input: OverrideProposalInput): Promise<OverrideResultDto> {
    return this.database.db.transaction(async (tx) => {
      const previous = await this.lockProposal(tx, id);

      if (previous.supersededBy !== null) {
        throw new ConflictException(
          `Invalid transition: proposal ${id} has already been overridden by ${previous.supersededBy}`,
        );
      }

      const links = await tx.select().from(proposalLinks).where(eq(proposalLinks.proposalId, id));
      const previousEvidence = await tx.select().from(evidence).where(eq(evidence.proposalId, id));

      const selectingCandidate =
        input.candidateSourceType !== undefined && input.candidateRecordId !== undefined;

      if (selectingCandidate) {
        await this.assertCandidateRecordExists(tx, input.candidateSourceType!, input.candidateRecordId!);
      }

      const carriedLinks = selectingCandidate
        ? links.filter((link) => link.sourceType === 'bank_transaction')
        : links;

      const [created] = await tx
        .insert(reconciliationProposals)
        .values({
          status: 'pending',
          method: 'manual',
          score: previous.score,
          rationaleJson: {
            type: 'manual_override',
            reason: input.reason,
            previousProposalId: previous.id,
            previousStatus: previous.status,
            overriddenBy: actor,
            selectedCandidate: selectingCandidate
              ? { sourceType: input.candidateSourceType, recordId: input.candidateRecordId }
              : null,
          },
        })
        .returning();

      if (carriedLinks.length > 0) {
        await tx.insert(proposalLinks).values(
          carriedLinks.map((link) => ({
            proposalId: created.id,
            sourceType: link.sourceType,
            recordId: link.recordId,
          })),
        );
      }

      if (selectingCandidate) {
        await tx.insert(proposalLinks).values({
          proposalId: created.id,
          sourceType: input.candidateSourceType!,
          recordId: input.candidateRecordId!,
        });
      }

      if (previousEvidence.length > 0) {
        await tx.insert(evidence).values(
          previousEvidence.map((entry) => ({
            proposalId: created.id,
            sourceType: entry.sourceType,
            sourceId: entry.sourceId,
            evidenceType: entry.evidenceType,
            detail: entry.detail,
          })),
        );
      }

      if (selectingCandidate) {
        await tx.insert(evidence).values({
          proposalId: created.id,
          sourceType: input.candidateSourceType!,
          sourceId: input.candidateRecordId!,
          evidenceType: 'manual_override_selection',
          detail: `Reviewer selected this ${input.candidateSourceType} as the matching record during override`,
        });
      }

      await tx
        .update(reconciliationProposals)
        .set({ supersededBy: created.id })
        .where(eq(reconciliationProposals.id, id));

      const supersedeEntry = await appendActivityEntry(tx, {
        actor,
        action: 'proposal.overridden',
        entityType: 'proposal',
        entityId: previous.id,
        previousState: { status: previous.status, supersededBy: null },
        newState: {
          status: previous.status,
          supersededBy: created.id,
          selectedCandidate: selectingCandidate
            ? { sourceType: input.candidateSourceType, recordId: input.candidateRecordId }
            : null,
        },
        reason: input.reason,
        aiUsed: input.aiUsed ?? false,
      });

      const creationEntry = await appendActivityEntry(tx, {
        actor,
        action: 'proposal.created',
        entityType: 'proposal',
        entityId: created.id,
        previousState: null,
        newState: {
          status: 'pending',
          method: 'manual',
          createdFromProposalId: previous.id,
          selectedCandidate: selectingCandidate
            ? { sourceType: input.candidateSourceType, recordId: input.candidateRecordId }
            : null,
        },
        reason: input.reason,
      });

      return {
        proposal: toProposalSummary(created, [
          ...carriedLinks.map((link) => ({ sourceType: link.sourceType, recordId: link.recordId })),
          ...(selectingCandidate
            ? [
                {
                  sourceType: input.candidateSourceType!,
                  recordId: input.candidateRecordId!,
                },
              ]
            : []),
        ]),
        supersededProposalId: previous.id,
        activity: [toActivityDto(supersedeEntry), toActivityDto(creationEntry)],
      };
    });
  }

  private async assertCandidateRecordExists(
    tx: DbExecutor,
    sourceType: 'ledger_entry' | 'invoice' | 'settlement',
    recordId: string,
  ): Promise<void> {
    let exists = false;

    if (sourceType === 'ledger_entry') {
      const rows = await tx.select({ id: ledgerEntries.id }).from(ledgerEntries).where(eq(ledgerEntries.id, recordId)).limit(1);
      exists = rows.length > 0;
    } else if (sourceType === 'invoice') {
      const rows = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, recordId)).limit(1);
      exists = rows.length > 0;
    } else {
      const rows = await tx.select({ id: settlements.id }).from(settlements).where(eq(settlements.id, recordId)).limit(1);
      exists = rows.length > 0;
    }

    if (!exists) {
      throw new BadRequestException(`Selected ${sourceType} candidate was not found`);
    }
  }

  async listExceptions(): Promise<ExceptionsResponseDto> {
    const settlementRows = await this.database.db
      .select({ header: settlements })
      .from(settlements)
      .orderBy(asc(settlements.settlementDate));

    const ids = settlementRows.map((row) => row.header.id);

    const lineRows =
      ids.length > 0
        ? await this.database.db
            .select()
            .from(settlementLines)
            .where(inArray(settlementLines.settlementId, ids))
            .orderBy(asc(settlementLines.sourceRow))
        : [];

    const bankRows = await this.database.db
      .select({
        id: bankTransactions.id,
        externalReference: bankTransactions.externalReference,
        postedAt: bankTransactions.postedAt,
        amountCents: bankTransactions.amountCents,
        currency: bankTransactions.currency,
        description: bankTransactions.description,
        normalizedVendor: bankTransactions.normalizedVendor,
      })
      .from(bankTransactions);

    const [proposalRows, linkRows] = await Promise.all([
      this.database.db.select().from(reconciliationProposals),
      this.database.db.select().from(proposalLinks),
    ]);
    const invoiceRows = await this.database.db.select().from(invoices);

    const proposalById = new Map(proposalRows.map((row) => [row.id, row]));
    const liveProposals = proposalRows.filter((row) => row.supersededBy === null);

    const linksByProposal = new Map<string, Array<typeof proposalLinks.$inferSelect>>();
    for (const link of linkRows) {
      const existing = linksByProposal.get(link.proposalId) ?? [];
      existing.push(link);
      linksByProposal.set(link.proposalId, existing);
    }

    const proposalsByCandidate = new Map<string, string[]>();

    for (const proposal of liveProposals) {
      for (const link of linksByProposal.get(proposal.id) ?? []) {
        if (link.sourceType === 'bank_transaction') {
          continue;
        }

        const key = `${link.sourceType}:${link.recordId}`;
        const existing = proposalsByCandidate.get(key) ?? [];
        existing.push(proposal.id);
        proposalsByCandidate.set(key, existing);
      }
    }

    const banksByProposal = new Map<string, string[]>();
    const proposalsByBank = new Map<string, string[]>();

    for (const proposal of liveProposals) {
      for (const link of linksByProposal.get(proposal.id) ?? []) {
        if (link.sourceType !== 'bank_transaction') {
          continue;
        }

        pushToMapList(banksByProposal, proposal.id, link.recordId);
        pushToMapList(proposalsByBank, link.recordId, proposal.id);
      }
    }

    const linesBySettlement = new Map<string, Array<typeof settlementLines.$inferSelect>>();

    for (const line of lineRows) {
      const existing = linesBySettlement.get(line.settlementId) ?? [];
      existing.push(line);
      linesBySettlement.set(line.settlementId, existing);
    }

    const headersById = new Map(settlementRows.map(({ header }) => [header.id, header]));

    const report = reconcileSettlements({
      settlements: settlementRows.map(({ header }) => ({
        settlement: {
          id: header.id,
          provider: header.provider,
          settlementReference: header.settlementReference,
          settlementDate: header.settlementDate,
          currency: header.currency,
        },
        lines: (linesBySettlement.get(header.id) ?? []).map((line) => ({
          id: line.id,
          type: line.type,
          description: line.description,
          amountCents: line.amountCents,
          reference: line.reference,
        })),
      })),
      bankTransactions: bankRows,
    });

    const items: ExceptionItemDto[] = [];

    for (const result of report.items) {
      if (!result.exceptionRaised) {
        continue;
      }

      items.push(
        buildSettlementExceptionItem(result, {
          headersById,
          linesBySettlement,
          proposalsByCandidate,
          proposalById,
        }),
      );
    }

    for (const bank of bankRows) {
      if ((proposalsByBank.get(bank.id) ?? []).length > 0) {
        continue;
      }

      items.push({
        id: `unmatched:${bank.id}`,
        family: 'proposal',
        exceptionType: 'unmatched',
        title: 'Unmatched bank movement',
        detail: bank.description,
        date: bank.postedAt.toISOString(),
        amountCents: Math.abs(bank.amountCents),
        currency: bank.currency,
        varianceCents: null,
        confidence: null,
        status: 'open',
        outcome: null,
        provider: bank.normalizedVendor,
        settlementReference: bank.externalReference,
        proposalId: null,
        proposalStatus: null,
        relatedRecords: [
          { sourceType: 'bank_transaction', recordId: bank.id, label: shortRecordLabel('bank_transaction', bank.id) },
        ],
        causes: [],
        evidence: [],
        explanation: null,
        settlement: null,
      });
    }

    const duplicateKeys = [...proposalsByCandidate.entries()].filter(([, ids]) => ids.length > 1);

    if (duplicateKeys.length > 0) {
      const duplicateCandidates = await this.loadCandidateSummaries(
        duplicateKeys.map(([key]) => key),
      );

      for (const [key, proposalIds] of duplicateKeys) {
        const summary = duplicateCandidates.get(key);
        const involved = proposalIds
          .map((id) => proposalById.get(id))
          .filter((row): row is ProposalRow => row !== undefined);

        items.push({
          id: `duplicate:${key}`,
          family: 'proposal',
          exceptionType: 'duplicate_candidate',
          title: 'Duplicate candidate',
          detail: `${summary?.label ?? 'The same record'} is proposed for ${involved.length} bank movements`,
          date: involved
            .map((row) => row.createdAt?.toISOString() ?? '')
            .sort()
            .at(-1) ?? new Date(0).toISOString(),
          amountCents: Math.abs(summary?.amountCents ?? 0),
          currency: summary?.currency ?? 'USD',
          varianceCents: null,
          confidence: involved.reduce<number | null>(
            (best, row) => (best === null || row.score > best ? row.score : best),
            null,
          ),
          status: deriveExceptionStatus(involved),
          outcome: null,
          provider: null,
          settlementReference: null,
          proposalId: involved[0]?.id ?? null,
          proposalStatus: involved[0]?.status ?? null,
          relatedRecords: [
            ...(summary
              ? [
                  {
                    sourceType: summary.sourceType,
                    recordId: summary.recordId,
                    label: summary.label,
                  },
                ]
              : []),
            ...involved.map((row) => ({
              sourceType: 'proposal',
              recordId: row.id,
              label: `Proposal #${row.id.slice(0, 4)} (${row.status})`,
            })),
          ],
          causes: [],
          evidence: [],
          explanation: null,
          settlement: null,
        });
      }
    }

    const consumedProposalIds = new Set<string>();

    for (const proposal of liveProposals) {
      const rationale = proposal.rationaleJson as Record<string, unknown> | null;

      if (rationale === null || rationale['type'] !== 'engine_match' || rationale['ambiguous'] !== true) {
        continue;
      }

      const bankId = (banksByProposal.get(proposal.id) ?? [])[0];

      if (!bankId) {
        continue;
      }

      consumedProposalIds.add(proposal.id);

      const bank = bankRows.find((row) => row.id === bankId);
      const candidateLinks = (linksByProposal.get(proposal.id) ?? []).filter(
        (link) => link.sourceType !== 'bank_transaction',
      );

      items.push({
        id: `ambiguous:${proposal.id}`,
        family: 'proposal',
        exceptionType: 'ambiguous_match',
        title: 'Ambiguous match',
        detail:
          typeof rationale['summary'] === 'string'
            ? rationale['summary']
            : 'Two or more candidates tie for this bank movement',
        date: bank?.postedAt.toISOString() ?? proposal.createdAt.toISOString(),
        amountCents: Math.abs(bank?.amountCents ?? 0),
        currency: bank?.currency ?? 'USD',
        varianceCents: null,
        confidence: proposal.score,
        status: deriveExceptionStatus([proposal]),
        outcome: null,
        provider: bank?.normalizedVendor ?? null,
        settlementReference: bank?.externalReference ?? null,
        proposalId: proposal.id,
        proposalStatus: proposal.status,
        relatedRecords: [
          { sourceType: 'proposal', recordId: proposal.id, label: `Proposal #${proposal.id.slice(0, 4)} (${proposal.status})` },
          ...(bank
            ? [
                {
                  sourceType: 'bank_transaction',
                  recordId: bank.id,
                  label: shortRecordLabel('bank_transaction', bank.id),
                },
              ]
            : []),
          ...candidateLinks.map((link) => ({
            sourceType: link.sourceType,
            recordId: link.recordId,
            label: shortRecordLabel(link.sourceType, link.recordId),
          })),
        ],
        causes: [],
        evidence: [],
        explanation: null,
        settlement: null,
      });
    }

    for (const proposal of liveProposals) {
      if (consumedProposalIds.has(proposal.id)) {
        continue;
      }

      const rationale = proposal.rationaleJson as { features?: Array<{ name: string; tier: string; detail: string }> } | null;

      if (rationale === null || !Array.isArray(rationale.features)) {
        continue;
      }

      const dateFeature = rationale.features.find((feature) => feature.name === 'date');

      if (!dateFeature || (dateFeature.tier !== 'within_5_days' && dateFeature.tier !== 'outside_window')) {
        continue;
      }

      const bankId = (banksByProposal.get(proposal.id) ?? [])[0];

      if (!bankId) {
        continue;
      }

      const bank = bankRows.find((row) => row.id === bankId);
      const candidateLinks = (linksByProposal.get(proposal.id) ?? []).filter(
        (link) => link.sourceType !== 'bank_transaction',
      );

      items.push({
        id: `date:${proposal.id}`,
        family: 'proposal',
        exceptionType: 'date_mismatch',
        title: 'Date mismatch',
        detail: dateFeature.detail,
        date: bank?.postedAt.toISOString() ?? proposal.createdAt.toISOString(),
        amountCents: Math.abs(bank?.amountCents ?? 0),
        currency: bank?.currency ?? 'USD',
        varianceCents: null,
        confidence: proposal.score,
        status: deriveExceptionStatus([proposal]),
        outcome: null,
        provider: bank?.normalizedVendor ?? null,
        settlementReference: bank?.externalReference ?? null,
        proposalId: proposal.id,
        proposalStatus: proposal.status,
        relatedRecords: [
          { sourceType: 'proposal', recordId: proposal.id, label: `Proposal #${proposal.id.slice(0, 4)} (${proposal.status})` },
          ...(bank
            ? [
                {
                  sourceType: 'bank_transaction',
                  recordId: bank.id,
                  label: shortRecordLabel('bank_transaction', bank.id),
                },
              ]
            : []),
          ...candidateLinks.map((link) => ({
            sourceType: link.sourceType,
            recordId: link.recordId,
            label: shortRecordLabel(link.sourceType, link.recordId),
          })),
        ],
        causes: [],
        evidence: [],
        explanation: null,
        settlement: null,
      });
    }

    const knownInvoiceRefs = new Set<string>();

    for (const invoice of invoiceRows) {
      knownInvoiceRefs.add(normalizeReference(invoice.invoiceNumber));
      knownInvoiceRefs.add(normalizeReference(invoice.reference ?? ''));
    }

    for (const [settlementId, lines] of linesBySettlement) {
      const header = headersById.get(settlementId);

      for (const line of lines) {
        if (line.type !== 'sale' || line.reference === null || line.reference.trim() === '') {
          continue;
        }

        if (knownInvoiceRefs.has(normalizeReference(line.reference))) {
          continue;
        }

        items.push({
          id: `missing-invoice:${line.id}`,
          family: 'proposal',
          exceptionType: 'missing_invoice',
          title: 'Sale without matching invoice',
          detail: `${line.reference} does not resolve to any imported invoice`,
          date: header ? header.settlementDate.toISOString() : new Date(0).toISOString(),
          amountCents: Math.abs(line.amountCents),
          currency: header?.currency ?? 'USD',
          varianceCents: null,
          confidence: null,
          status: 'open',
          outcome: null,
          provider: header?.provider ?? null,
          settlementReference: header?.settlementReference ?? null,
          proposalId: null,
          proposalStatus: null,
          relatedRecords: [
            { sourceType: 'settlement_line', recordId: line.id, label: `Line #${line.id.slice(0, 4)}` },
            ...(header
              ? [
                  {
                    sourceType: 'settlement',
                    recordId: header.id,
                    label: `Settlement ${header.settlementReference ?? ''}`.trim(),
                  },
                ]
              : []),
          ],
          causes: [],
          evidence: [],
          explanation: null,
          settlement: null,
        });
      }
    }

    items.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));

    const counts = emptyExceptionCounts();

    for (const item of items) {
      counts[item.exceptionType] += 1;
    }

    return {
      items,
      counts,
      exceptionCount: items.length,
      exactMatchCount: report.exactMatchCount,
      missingSettlementCount: report.missingSettlementCount,
      totalSettlements: report.items.length,
    };
  }

  async getRecordDetail(params: RecordParams): Promise<RecordDetailDto> {
    const { sourceType, recordId } = params;

    if (sourceType === 'bank_transaction') {
      const [row] = await this.database.db
        .select({ record: bankTransactions, filename: importsTable.filename })
        .from(bankTransactions)
        .leftJoin(importsTable, eq(importsTable.id, bankTransactions.importId))
        .where(eq(bankTransactions.id, recordId))
        .limit(1);

      if (!row) {
        throw notFoundRecord(recordId);
      }

      return {
        sourceType,
        recordId,
        title: row.record.description,
        subtitle: row.record.externalReference,
        fields: [
          { label: 'Posted at', value: isoDate(row.record.postedAt) },
          { label: 'Amount', value: `${formatMoney(row.record.amountCents)} ${row.record.currency}` },
          { label: 'Description', value: row.record.description },
          { label: 'Vendor', value: row.record.normalizedVendor },
          { label: 'Reference', value: row.record.externalReference ?? '-' },
        ],
        importFilename: row.filename ?? null,
        sourceRow: row.record.sourceRow,
        parent: null,
        relatedProposals: await this.relatedProposalsFor('bank_transaction', recordId),
      };
    }

    if (sourceType === 'ledger_entry') {
      const [row] = await this.database.db
        .select({ record: ledgerEntries, filename: importsTable.filename })
        .from(ledgerEntries)
        .leftJoin(importsTable, eq(importsTable.id, ledgerEntries.importId))
        .where(eq(ledgerEntries.id, recordId))
        .limit(1);

      if (!row) {
        throw notFoundRecord(recordId);
      }

      return {
        sourceType,
        recordId,
        title: `${row.record.accountCode} - ${row.record.accountName}`,
        subtitle: row.record.description,
        fields: [
          { label: 'Posted at', value: isoDate(row.record.postedAt) },
          { label: 'Amount', value: `${formatMoney(row.record.amountCents)} ${row.record.currency}` },
          { label: 'Account', value: `${row.record.accountCode} - ${row.record.accountName}` },
          { label: 'Description', value: row.record.description },
          { label: 'Reference', value: row.record.externalReference ?? '-' },
        ],
        importFilename: row.filename ?? null,
        sourceRow: row.record.sourceRow,
        parent: null,
        relatedProposals: await this.relatedProposalsFor('ledger_entry', recordId),
      };
    }

    if (sourceType === 'invoice') {
      const [row] = await this.database.db
        .select({ record: invoices, filename: importsTable.filename })
        .from(invoices)
        .leftJoin(importsTable, eq(importsTable.id, invoices.importId))
        .where(eq(invoices.id, recordId))
        .limit(1);

      if (!row) {
        throw notFoundRecord(recordId);
      }

      return {
        sourceType,
        recordId,
        title: `Invoice ${row.record.invoiceNumber}`,
        subtitle: row.record.vendor,
        fields: [
          { label: 'Invoice #', value: row.record.invoiceNumber },
          { label: 'Vendor', value: row.record.vendor },
          { label: 'Issued at', value: isoDate(row.record.issuedAt) },
          { label: 'Due at', value: row.record.dueAt === null ? '-' : isoDate(row.record.dueAt) },
          { label: 'Amount', value: `${formatMoney(row.record.amountCents)} ${row.record.currency}` },
          { label: 'Reference', value: row.record.reference ?? '-' },
        ],
        importFilename: row.filename ?? null,
        sourceRow: row.record.sourceRow,
        parent: null,
        relatedProposals: await this.relatedProposalsFor('invoice', recordId),
      };
    }

    if (sourceType === 'settlement') {
      const [row] = await this.database.db
        .select({ record: settlements, filename: importsTable.filename })
        .from(settlements)
        .leftJoin(importsTable, eq(importsTable.id, settlements.importId))
        .where(eq(settlements.id, recordId))
        .limit(1);

      if (!row) {
        throw notFoundRecord(recordId);
      }

      return {
        sourceType,
        recordId,
        title: `Settlement ${row.record.settlementReference ?? row.record.provider}`,
        subtitle: row.record.provider,
        fields: [
          { label: 'Provider', value: row.record.provider },
          { label: 'Reference', value: row.record.settlementReference ?? '-' },
          { label: 'Settlement date', value: isoDate(row.record.settlementDate) },
          { label: 'Gross', value: formatMoney(row.record.grossAmountCents) },
          { label: 'Fees', value: formatMoney(row.record.feesCents) },
          { label: 'Refunds', value: formatMoney(row.record.refundsCents) },
          { label: 'Deductions', value: formatMoney(row.record.deductionsCents) },
          { label: 'Adjustments', value: formatMoney(row.record.adjustmentsCents) },
          { label: 'Expected net', value: `${formatMoney(row.record.expectedNetCents)} ${row.record.currency}` },
        ],
        importFilename: row.filename ?? null,
        sourceRow: row.record.sourceRow,
        parent: null,
        relatedProposals: await this.relatedProposalsFor('settlement', recordId),
      };
    }

    const [line] = await this.database.db
      .select()
      .from(settlementLines)
      .where(eq(settlementLines.id, recordId))
      .limit(1);

    if (!line) {
      throw notFoundRecord(recordId);
    }

    const [parent] = await this.database.db
      .select()
      .from(settlements)
      .where(eq(settlements.id, line.settlementId))
      .limit(1);

    return {
      sourceType,
      recordId,
      title: `${capitalizeWord(line.type)} line`,
      subtitle: line.description,
      fields: [
        { label: 'Type', value: line.type },
        { label: 'Description', value: line.description },
        { label: 'Amount', value: formatMoney(line.amountCents) },
        { label: 'Reference', value: line.reference ?? '-' },
      ],
      importFilename: parent
        ? (
            await this.database.db
              .select({ filename: importsTable.filename })
              .from(settlements)
              .innerJoin(importsTable, eq(importsTable.id, settlements.importId))
              .where(eq(settlements.id, parent.id))
              .limit(1)
          )[0]?.filename ?? null
        : null,
      sourceRow: line.sourceRow,
      parent: parent
        ? {
            sourceType: 'settlement',
            recordId: parent.id,
            label: `Settlement ${parent.settlementReference ?? parent.provider}`,
          }
        : null,
      relatedProposals: parent
        ? await this.relatedProposalsFor('settlement', parent.id)
        : [],
    };
  }

  private async relatedProposalsFor(
    sourceType: 'ledger_entry' | 'invoice' | 'settlement' | 'bank_transaction' | 'settlement_line',
    recordId: string,
  ): Promise<Array<{ id: string; status: string }>> {
    const rows = await this.database.db
      .select({ id: reconciliationProposals.id, status: reconciliationProposals.status })
      .from(proposalLinks)
      .innerJoin(reconciliationProposals, eq(reconciliationProposals.id, proposalLinks.proposalId))
      .where(and(eq(proposalLinks.sourceType, sourceType), eq(proposalLinks.recordId, recordId)));

    return rows;
  }

  private async loadCandidateSummaries(
    keys: string[],
  ): Promise<Map<string, { sourceType: string; recordId: string; label: string; amountCents: number; currency: string }>> {
    const grouped = new Map<string, string[]>();

    for (const key of keys) {
      const [sourceType, recordId] = splitRecordKey(key);
      const existing = grouped.get(sourceType) ?? [];
      existing.push(recordId);
      grouped.set(sourceType, existing);
    }

    const summaries = new Map<string, { sourceType: string; recordId: string; label: string; amountCents: number; currency: string }>();

    const invoiceIds = grouped.get('invoice') ?? [];

    if (invoiceIds.length > 0) {
      const rows = await this.database.db
        .select()
        .from(invoices)
        .where(inArray(invoices.id, invoiceIds));

      for (const row of rows) {
        summaries.set(`invoice:${row.id}`, {
          sourceType: 'invoice',
          recordId: row.id,
          label: `Invoice ${row.invoiceNumber} - ${row.vendor}`,
          amountCents: row.amountCents,
          currency: row.currency,
        });
      }
    }

    const ledgerIds = grouped.get('ledger_entry') ?? [];

    if (ledgerIds.length > 0) {
      const rows = await this.database.db
        .select()
        .from(ledgerEntries)
        .where(inArray(ledgerEntries.id, ledgerIds));

      for (const row of rows) {
        summaries.set(`ledger_entry:${row.id}`, {
          sourceType: 'ledger_entry',
          recordId: row.id,
          label: `Ledger ${row.accountCode} - ${row.accountName}`,
          amountCents: row.amountCents,
          currency: row.currency,
        });
      }
    }

    const settlementIds = grouped.get('settlement') ?? [];

    if (settlementIds.length > 0) {
      const rows = await this.database.db
        .select()
        .from(settlements)
        .where(inArray(settlements.id, settlementIds));

      for (const row of rows) {
        summaries.set(`settlement:${row.id}`, {
          sourceType: 'settlement',
          recordId: row.id,
          label: `Settlement ${row.settlementReference ?? row.provider}`,
          amountCents: row.expectedNetCents,
          currency: row.currency,
        });
      }
    }

    return summaries;
  }

  async getEvidence(proposalId: string): Promise<EvidenceRow[]> {
    const [exists] = await this.database.db
      .select({ id: reconciliationProposals.id })
      .from(reconciliationProposals)
      .where(eq(reconciliationProposals.id, proposalId))
      .limit(1);

    if (!exists) {
      throw new NotFoundException(`Proposal ${proposalId} was not found`);
    }

    return this.database.db
      .select()
      .from(evidence)
      .where(eq(evidence.proposalId, proposalId))
      .orderBy(asc(evidence.sourceType), asc(evidence.evidenceType));
  }

  async listActivity(query: ListActivityQuery): Promise<ActivityFeedDto> {
    const where =
      query.entityId === undefined ? undefined : eq(activityLog.entityId, query.entityId);

    const rows = await this.database.db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(asc(activityLog.timestamp), asc(activityLog.id))
      .limit(query.limit);

    const entries = rows.map(toActivityDto);

    const verification = verifyActivityChain(rows.map(toChainEntry));

    return { entries, verification };
  }

  async generateProposalsForUnmatched(): Promise<{ created: number; scannedBanks: number }> {
    const unmatchedBanks = await this.database.db
      .select()
      .from(bankTransactions)
      .where(
        sql`not exists (select 1 from proposal_links pl where pl.record_id = ${bankTransactions.id} and pl.source_type = 'bank_transaction')`,
      );

    if (unmatchedBanks.length === 0) {
      return { created: 0, scannedBanks: 0 };
    }

    const [ledgerRows, invoiceRows, settlementRows] = await Promise.all([
      this.database.db.select().from(ledgerEntries),
      this.database.db.select().from(invoices),
      this.database.db.select().from(settlements),
    ]);

    const unmatchedIds = new Set(unmatchedBanks.map((bank) => bank.id));

    const result = generateProposals({
      bankTransactions: unmatchedBanks.map((row) => ({
        id: row.id,
        externalReference: row.externalReference,
        postedAt: row.postedAt,
        amountCents: row.amountCents,
        currency: row.currency,
        description: row.description,
        normalizedVendor: row.normalizedVendor,
      })),
      ledgerEntries: ledgerRows.map((row) => ({
        id: row.id,
        externalReference: row.externalReference,
        postedAt: row.postedAt,
        amountCents: row.amountCents,
        currency: row.currency,
        accountCode: row.accountCode,
        accountName: row.accountName,
        description: row.description,
        normalizedVendor: row.normalizedVendor,
      })),
      invoices: invoiceRows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        issuedAt: row.issuedAt,
        dueAt: row.dueAt,
        amountCents: row.amountCents,
        currency: row.currency,
        vendor: row.vendor,
        normalizedVendor: row.normalizedVendor,
        reference: row.reference,
      })),
      settlements: settlementRows.map((row) => ({
        id: row.id,
        provider: row.provider,
        settlementReference: row.settlementReference,
        settlementDate: row.settlementDate,
        currency: row.currency,
        expectedNetCents: row.expectedNetCents,
      })),
    });

    const relevant = result.proposals.filter((proposal) => unmatchedIds.has(proposal.bankTransactionId));

    let created = 0;

    await this.database.db.transaction(async (tx) => {
      for (const proposal of relevant) {
        const [record] = await tx
          .insert(reconciliationProposals)
          .values({
            status: 'pending',
            method: proposal.method,
            score: proposal.score,
            rationaleJson: {
              type: 'engine_match',
              summary: proposal.evidenceSummary,
              matchedFields: proposal.matchedFields,
              mismatchedFields: proposal.mismatchedFields,
              ambiguous: proposal.ambiguous,
              features: proposal.features.map((feature) => ({
                name: feature.name,
                tier: feature.tier,
                score: feature.score,
                detail: feature.detail,
              })),
            },
          })
          .returning({ id: reconciliationProposals.id });

        created += 1;

        await tx.insert(proposalLinks).values([
          { proposalId: record!.id, sourceType: 'bank_transaction', recordId: proposal.bankTransactionId },
          { proposalId: record!.id, sourceType: proposal.sourceType, recordId: proposal.sourceId },
        ]);

        await tx.insert(evidence).values(
          proposal.features.map((feature) => ({
            proposalId: record!.id,
            sourceType: proposal.sourceType,
            sourceId: proposal.sourceId,
            evidenceType: feature.name,
            detail: feature.detail,
          })),
        );
      }
    });

    return { created, scannedBanks: unmatchedBanks.length };
  }

  async getSummary(): Promise<ReviewSummaryDto> {
    const statusRows = await this.database.db
      .select({ status: reconciliationProposals.status, count: sql<number>`count(*)::int` })
      .from(reconciliationProposals)
      .groupBy(reconciliationProposals.status);

    const byStatus = new Map(statusRows.map((row) => [row.status, row.count]));

    const [[bankRow], overrideRow, bankTotalRow] = await Promise.all([
      this.database.db
        .select({
          unmatched: sql<string>`count(*) filter (where ${bankLinkTable.id} is null)::int`,
          unresolvedValue: sql<string>`coalesce(sum(case when ${bankLinkTable.id} is null or ${reconciliationProposals.status} = 'pending' then abs(${bankTransactions.amountCents}) else 0 end), 0)::text`,
        })
        .from(bankTransactions)
        .leftJoin(
          bankLinkTable,
          and(
            eq(bankLinkTable.recordId, bankTransactions.id),
            eq(bankLinkTable.sourceType, 'bank_transaction'),
          ),
        )
        .leftJoin(reconciliationProposals, eq(reconciliationProposals.id, bankLinkTable.proposalId)),
      this.database.db
        .select({ total: sql<number>`count(*)::int` })
        .from(reconciliationProposals)
        .where(sql`${reconciliationProposals.supersededBy} is not null`),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(bankTransactions),
    ]);

    return {
      totalProposals: sumStatusCounts(byStatus),
      pending: byStatus.get('pending') ?? 0,
      accepted: byStatus.get('accepted') ?? 0,
      rejected: byStatus.get('rejected') ?? 0,
      overridden: overrideRow[0]?.total ?? 0,
      unmatchedBankTransactions: Number(bankRow?.unmatched ?? 0),
      unresolvedValueCents: bankRow?.unresolvedValue ?? '0',
      totalBankTransactions: bankTotalRow[0]?.total ?? 0,
    };
  }

  async getWorklist(query: WorklistQuery): Promise<PaginatedWorklistDto> {
    const includeUnmatched = query.status === 'all' || query.status === 'unmatched';
    const includeProposals = query.status !== 'unmatched';
    const statusFilter =
      query.status === 'pending' || query.status === 'accepted' || query.status === 'rejected'
        ? eq(reconciliationProposals.status, query.status)
        : undefined;

    const proposalItems: WorklistItemDto[] = [];

    if (includeProposals) {
      const rows = await this.database.db
        .select({
          proposal: reconciliationProposals,
          bank: bankTransactions,
          evidenceCount: sql<number>`(select count(*) from ${evidence} ev where ev.proposal_id = ${reconciliationProposals.id})::int`,
        })
        .from(reconciliationProposals)
        .innerJoin(bankLinkTable, eq(bankLinkTable.proposalId, reconciliationProposals.id))
        .innerJoin(bankTransactions, eq(bankTransactions.id, bankLinkTable.recordId))
        .where(and(eq(bankLinkTable.sourceType, 'bank_transaction'), statusFilter));

      const links = await loadProposalLinks(
        this.database.db,
        rows.map((row) => row.proposal.id),
      );

      const bestMatchLabels = await this.loadCandidateLabels(
        [...links.values()].flat().filter((source) => source.sourceType !== 'bank_transaction'),
      );

      for (const row of rows) {
        const candidate = (links.get(row.proposal.id) ?? []).find(
          (source) => source.sourceType !== 'bank_transaction',
        );

        proposalItems.push({
          key: row.proposal.id,
          kind: 'proposal',
          proposalId: row.proposal.id,
          bankTransactionId: row.bank.id,
          status: row.proposal.status,
          method: row.proposal.method,
          score: row.proposal.score,
          decidedAt: row.proposal.decidedAt?.toISOString() ?? null,
          decidedBy: row.proposal.decidedBy ?? null,
          rationaleText: rationaleTextOf(row.proposal.rationaleJson),
          date: row.bank.postedAt.toISOString(),
          description: row.bank.description,
          vendor: row.bank.normalizedVendor,
          amountCents: row.bank.amountCents,
          currency: row.bank.currency,
          reference: row.bank.externalReference,
          bestMatch:
            candidate !== undefined
              ? {
                  sourceType: candidate.sourceType,
                  label: bestMatchLabels.get(candidate.recordId) ?? 'Record',
                }
              : null,
          evidenceCount: row.evidenceCount,
          ambiguous: isAmbiguousRationale(row.proposal.rationaleJson),
        });
      }
    }

    let unmatchedItems: WorklistItemDto[] = [];

    if (includeUnmatched) {
      const rows = await this.database.db
        .select({ bank: bankTransactions })
        .from(bankTransactions)
        .where(
          sql`not exists (select 1 from proposal_links pl where pl.record_id = ${bankTransactions.id} and pl.source_type = 'bank_transaction')`,
        );

      unmatchedItems = rows.map(({ bank }) => ({
        key: `unmatched:${bank.id}`,
        kind: 'unmatched' as const,
        proposalId: null,
        bankTransactionId: bank.id,
        status: 'unmatched' as const,
        method: null,
        score: null,
        decidedAt: null,
        decidedBy: null,
        rationaleText: null,
        date: bank.postedAt.toISOString(),
        description: bank.description,
        vendor: bank.normalizedVendor,
        amountCents: bank.amountCents,
        currency: bank.currency,
        reference: bank.externalReference,
        bestMatch: null,
        evidenceCount: 0,
        ambiguous: false,
      }));
    }

    const merged = [...proposalItems, ...unmatchedItems].sort((a, b) =>
      a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? 1 : -1,
    );

    const [proposalTotalRow] = includeProposals
      ? await this.database.db
          .select({ total: sql<number>`count(*)::int` })
          .from(reconciliationProposals)
          .innerJoin(bankLinkTable, eq(bankLinkTable.proposalId, reconciliationProposals.id))
          .where(and(eq(bankLinkTable.sourceType, 'bank_transaction'), statusFilter))
      : [{ total: 0 }];

    const [unmatchedTotalRow] = includeUnmatched
      ? await this.database.db
          .select({ total: sql<number>`count(*)::int` })
          .from(bankTransactions)
          .where(
            sql`not exists (select 1 from proposal_links pl where pl.record_id = ${bankTransactions.id} and pl.source_type = 'bank_transaction')`,
          )
      : [{ total: 0 }];

    const total =
      (includeProposals ? (proposalTotalRow?.total ?? 0) : 0) +
      (includeUnmatched ? (unmatchedTotalRow?.total ?? 0) : 0);

    const offset = (query.page - 1) * query.limit;

    return {
      items: merged.slice(offset, offset + query.limit),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async getCandidates(proposalId: string): Promise<{ candidates: CandidateOptionDto[] }> {
    const [exists] = await this.database.db
      .select({ id: reconciliationProposals.id })
      .from(reconciliationProposals)
      .where(eq(reconciliationProposals.id, proposalId))
      .limit(1);

    if (!exists) {
      throw new NotFoundException(`Proposal ${proposalId} was not found`);
    }

    const bankLinks = await this.database.db
      .select()
      .from(proposalLinks)
      .where(
        and(
          eq(proposalLinks.proposalId, proposalId),
          eq(proposalLinks.sourceType, 'bank_transaction'),
        ),
      )
      .limit(1);

    const [bank] = await this.database.db
      .select()
      .from(bankTransactions)
      .where(eq(bankTransactions.id, bankLinks[0]?.recordId ?? '')) 
      .limit(1);

    if (!bank) {
      return { candidates: [] };
    }

    const [ledgerRows, invoiceRows, settlementRows] = await Promise.all([
      this.database.db.select().from(ledgerEntries),
      this.database.db.select().from(invoices),
      this.database.db.select().from(settlements),
    ]);

    const linkedRecordIds = new Set(
      (
        await this.database.db
          .select({ sourceType: proposalLinks.sourceType, recordId: proposalLinks.recordId })
          .from(proposalLinks)
          .where(eq(proposalLinks.proposalId, proposalId))
      ).map((link) => `${link.sourceType}:${link.recordId}`),
    );

    const result = generateProposals({
      bankTransactions: [
        {
          id: bank.id,
          externalReference: bank.externalReference,
          postedAt: bank.postedAt,
          amountCents: bank.amountCents,
          currency: bank.currency,
          description: bank.description,
          normalizedVendor: bank.normalizedVendor,
        },
      ],
      ledgerEntries: ledgerRows.map((row) => ({
        id: row.id,
        externalReference: row.externalReference,
        postedAt: row.postedAt,
        amountCents: row.amountCents,
        currency: row.currency,
        accountCode: row.accountCode,
        accountName: row.accountName,
        description: row.description,
        normalizedVendor: row.normalizedVendor,
      })),
      invoices: invoiceRows.map((row) => ({
        id: row.id,
        invoiceNumber: row.invoiceNumber,
        issuedAt: row.issuedAt,
        dueAt: row.dueAt,
        amountCents: row.amountCents,
        currency: row.currency,
        vendor: row.vendor,
        normalizedVendor: row.normalizedVendor,
        reference: row.reference,
      })),
      settlements: settlementRows.map((row) => ({
        id: row.id,
        provider: row.provider,
        settlementReference: row.settlementReference,
        settlementDate: row.settlementDate,
        currency: row.currency,
        expectedNetCents: row.expectedNetCents,
      })),
    });

    return {
      candidates: result.proposals
        .filter((proposal) => proposal.bankTransactionId === bank.id)
        .map((proposal) => ({
          sourceType: proposal.sourceType,
          recordId: proposal.sourceId,
          label: candidateLabel(proposal.sourceType, proposal.sourceRecords.candidate),
          amountCents: candidateAmountOf(proposal.sourceRecords.candidate),
          currency: bank.currency,
          score: proposal.score,
          classification: proposal.classification,
          method: proposal.method,
          alreadyLinked: linkedRecordIds.has(`${proposal.sourceType}:${proposal.sourceId}`),
          signals: proposal.features.map((feature) => ({
            name: feature.name,
            tier: feature.tier,
            score: feature.score,
            detail: feature.detail,
          })),
        }))
        .sort((a, b) => b.score - a.score),
    };
  }

  getAiStatus(): AiStatusDto {
    let config;

    try {
      config = getAiProviderConfig();
    } catch {
      return { available: false, model: null };
    }

    return { available: config !== null, model: config?.model ?? null };
  }

  async explainProposalWithAi(id: string): Promise<AiExplanationDto> {
    if (!isAiConfigured()) {
      throw new ServiceUnavailableException('AI assistance is not configured on this deployment');
    }

    const [proposal] = await this.database.db
      .select()
      .from(reconciliationProposals)
      .where(eq(reconciliationProposals.id, id))
      .limit(1);

    if (!proposal) {
      throw new NotFoundException(`Proposal ${id} was not found`);
    }

    const [bankLink] = await this.database.db
      .select({ recordId: proposalLinks.recordId })
      .from(proposalLinks)
      .where(and(eq(proposalLinks.proposalId, id), eq(proposalLinks.sourceType, 'bank_transaction')))
      .limit(1);

    const [bank] = bankLink
      ? await this.database.db.select().from(bankTransactions).where(eq(bankTransactions.id, bankLink.recordId)).limit(1)
      : [];

    const [{ candidates }, evidenceRows] = await Promise.all([
      this.getCandidates(id),
      this.database.db
        .select()
        .from(evidence)
        .where(eq(evidence.proposalId, id))
        .orderBy(asc(evidence.evidenceType)),
    ]);

    const allowedRefs: AllowedAiEvidenceRef[] = [];

    const candidatePayload = candidates.map((candidate, index) => {
      const ref = `candidate:${index}`;
      allowedRefs.push({ ref, label: candidate.label });

      return {
        ref,
        sourceType: candidate.sourceType,
        label: candidate.label,
        amountCents: candidate.amountCents,
        currency: candidate.currency,
        score: candidate.score,
        classification: candidate.classification,
        alreadyLinked: candidate.alreadyLinked,
        signals: candidate.signals,
      };
    });

    const evidencePayload = evidenceRows.map((row, index) => {
      const ref = `evidence:${index}`;
      allowedRefs.push({
        ref,
        label: `${row.evidenceType}: ${row.detail.slice(0, 100)}`,
      });

      return { ref, evidenceType: row.evidenceType, detail: row.detail };
    });

    let bankPayload: Record<string, unknown> | null = null;

    if (bank) {
      allowedRefs.push({
        ref: 'bank',
        label: `Bank transaction "${bank.description}" (${formatMoney(bank.amountCents)} ${bank.currency})`,
      });
      bankPayload = {
        ref: 'bank',
        postedAt: bank.postedAt.toISOString(),
        amountCents: bank.amountCents,
        currency: bank.currency,
        description: bank.description,
        vendor: bank.normalizedVendor,
        reference: bank.externalReference,
      };
    }

    const payload = {
      task: 'explain_match',
      proposal: {
        id: proposal.id,
        method: proposal.method,
        score: proposal.score,
        rationale: proposal.rationaleJson,
      },
      bankTransaction: bankPayload,
      candidates: candidatePayload,
      evidence: evidencePayload,
      instructions:
        'Explain why this match is ambiguous, weigh each candidate against the bank movement using only the supplied signals and evidence, and suggest which evidence items the reviewer should inspect.',
    };

    let dto: AiExplanationDto;

    try {
      const raw = await completeJson(buildAiSystemPrompt(), payload);
      dto = sanitizeAiExplanation(raw, allowedRefs);
    } catch (error) {
      throw new ServiceUnavailableException(
        `AI assistance failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return dto;
  }

  async summarizeExceptionWithAi(exceptionId: string): Promise<AiExplanationDto> {
    if (!isAiConfigured()) {
      throw new ServiceUnavailableException('AI assistance is not configured on this deployment');
    }

    const separatorIndex = exceptionId.indexOf(':');

    if (separatorIndex <= 0 || separatorIndex === exceptionId.length - 1) {
      throw new BadRequestException('exceptionId must have the form "<kind>:<recordId>"');
    }

    const feed = await this.listExceptions();
    const item = feed.items.find((entry) => entry.id === exceptionId);

    if (!item) {
      throw new BadRequestException(`Unknown exception id: ${exceptionId}`);
    }

    const allowedRefs: AllowedAiEvidenceRef[] = [];
    const evidencePayload = item.evidence.map((entry, index) => {
      const ref = `evidence:${index}`;
      allowedRefs.push({ ref, label: `${entry.label}: ${entry.detail.slice(0, 120)}` });

      return { ref, label: entry.label, detail: entry.detail };
    });

    let linesPayload: Array<Record<string, unknown>> | null = null;

    if (item.settlement) {
      linesPayload = item.settlement.lines.map((line, index) => {
        const ref = `line:${index}`;
        allowedRefs.push({
          ref,
          label: `${line.type} line "${line.description}" (${formatMoney(line.amountCents)})`,
        });

        return {
          ref,
          type: line.type,
          description: line.description,
          amountCents: line.amountCents,
          reference: line.reference,
        };
      });
    }

    const payload = {
      task: 'summarize_exception',
      exception: {
        ref: 'exception',
        exceptionType: item.exceptionType,
        family: item.family,
        title: item.title,
        detail: item.detail,
        provider: item.provider,
        settlementReference: item.settlementReference,
        date: item.date,
        amountCents: item.amountCents,
        currency: item.currency,
        varianceCents: item.varianceCents,
        outcome: item.outcome,
        causes: item.causes.map((cause) => ({
          causeType: cause.causeType,
          description: cause.description,
          amountCents: cause.amountCents,
        })),
        breakdown: item.settlement
          ? {
              grossCents: item.settlement.grossCents,
              feesCents: item.settlement.feesCents,
              refundsCents: item.settlement.refundsCents,
              deductionsCents: item.settlement.deductionsCents,
              adjustmentsCents: item.settlement.adjustmentsCents,
              expectedNetCents: item.settlement.expectedNetCents,
            }
          : null,
      },
      lines: linesPayload,
      evidence: evidencePayload,
      instructions:
        'Summarize this reconciliation exception for an accountant: state what differs, which supported cause (if any) explains it, and what the reviewer should do next. Ground every statement in the supplied data only.',
    };

    allowedRefs.push({ ref: 'exception', label: `${item.exceptionType}: ${item.title}` });

    let dto: AiExplanationDto;

    try {
      const raw = await completeJson(buildAiSystemPrompt(), payload);
      dto = sanitizeAiExplanation(raw, allowedRefs);
    } catch (error) {
      throw new ServiceUnavailableException(
        `AI assistance failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return dto;
  }

  private async hydrateSources(sources: ProposalSourceDto[]): Promise<HydratedSourceDto[]> {
    const grouped = new Map<string, ProposalSourceDto[]>();

    for (const source of sources) {
      const existing = grouped.get(source.sourceType) ?? [];
      existing.push(source);
      grouped.set(source.sourceType, existing);
    }

    const hydrated: HydratedSourceDto[] = [];

    const bankIds = idsFor(grouped, 'bank_transaction');
    const ledgerIds = idsFor(grouped, 'ledger_entry');
    const invoiceIds = idsFor(grouped, 'invoice');
    const settlementIds = idsFor(grouped, 'settlement');

    if (bankIds.length > 0) {
      const rows = await this.database.db
        .select({
          record: bankTransactions,
          filename: importsTable.filename,
        })
        .from(bankTransactions)
        .leftJoin(importsTable, eq(importsTable.id, bankTransactions.importId))
        .where(inArray(bankTransactions.id, bankIds));

      for (const { record, filename } of rows) {
        hydrated.push({
          sourceType: 'bank_transaction',
          recordId: record.id,
          date: record.postedAt.toISOString(),
          amountCents: record.amountCents,
          currency: record.currency,
          vendor: record.normalizedVendor,
          description: record.description,
          reference: record.externalReference,
          importFilename: filename ?? null,
          sourceRow: record.sourceRow,
        });
      }
    }

    if (ledgerIds.length > 0) {
      const rows = await this.database.db
        .select({ record: ledgerEntries, filename: importsTable.filename })
        .from(ledgerEntries)
        .leftJoin(importsTable, eq(importsTable.id, ledgerEntries.importId))
        .where(inArray(ledgerEntries.id, ledgerIds));

      for (const { record, filename } of rows) {
        hydrated.push({
          sourceType: 'ledger_entry',
          recordId: record.id,
          date: record.postedAt.toISOString(),
          amountCents: record.amountCents,
          currency: record.currency,
          vendor: record.normalizedVendor,
          description: record.description,
          reference: record.externalReference,
          importFilename: filename ?? null,
          sourceRow: record.sourceRow,
        });
      }
    }

    if (invoiceIds.length > 0) {
      const rows = await this.database.db
        .select({ record: invoices, filename: importsTable.filename })
        .from(invoices)
        .leftJoin(importsTable, eq(importsTable.id, invoices.importId))
        .where(inArray(invoices.id, invoiceIds));

      for (const { record, filename } of rows) {
        hydrated.push({
          sourceType: 'invoice',
          recordId: record.id,
          date: record.issuedAt.toISOString(),
          amountCents: record.amountCents,
          currency: record.currency,
          vendor: record.vendor,
          description: record.invoiceNumber,
          reference: record.reference,
          importFilename: filename ?? null,
          sourceRow: record.sourceRow,
        });
      }
    }

    if (settlementIds.length > 0) {
      const rows = await this.database.db
        .select({ record: settlements, filename: importsTable.filename })
        .from(settlements)
        .leftJoin(importsTable, eq(importsTable.id, settlements.importId))
        .where(inArray(settlements.id, settlementIds));

      for (const { record, filename } of rows) {
        hydrated.push({
          sourceType: 'settlement',
          recordId: record.id,
          date: record.settlementDate.toISOString(),
          amountCents: record.expectedNetCents,
          currency: record.currency,
          vendor: record.provider,
          description: record.settlementReference,
          reference: record.settlementReference,
          importFilename: filename ?? null,
          sourceRow: record.sourceRow,
        });
      }
    }

    const order = new Map(sources.map((source, index) => [`${source.sourceType}:${source.recordId}`, index]));

    return hydrated.sort(
      (a, b) =>
        (order.get(`${a.sourceType}:${a.recordId}`) ?? 0) -
        (order.get(`${b.sourceType}:${b.recordId}`) ?? 0),
    );
  }

  private async loadCandidateLabels(
    sources: ProposalSourceDto[],
  ): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const byType = new Map<string, string[]>();

    for (const source of sources) {
      const ids = byType.get(source.sourceType) ?? [];
      ids.push(source.recordId);
      byType.set(source.sourceType, ids);
    }

    if ((byType.get('invoice') ?? []).length > 0) {
      const rows = await this.database.db
        .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, vendor: invoices.vendor })
        .from(invoices)
        .where(inArray(invoices.id, byType.get('invoice') as string[]));

      for (const row of rows) {
        labels.set(row.id, `Invoice ${row.invoiceNumber} - ${row.vendor}`);
      }
    }

    if ((byType.get('ledger_entry') ?? []).length > 0) {
      const rows = await this.database.db
        .select({
          id: ledgerEntries.id,
          accountName: ledgerEntries.accountName,
          accountCode: ledgerEntries.accountCode,
        })
        .from(ledgerEntries)
        .where(inArray(ledgerEntries.id, byType.get('ledger_entry') as string[]));

      for (const row of rows) {
        labels.set(row.id, `Ledger ${row.accountCode} - ${row.accountName}`);
      }
    }

    if ((byType.get('settlement') ?? []).length > 0) {
      const rows = await this.database.db
        .select({
          id: settlements.id,
          reference: settlements.settlementReference,
          provider: settlements.provider,
        })
        .from(settlements)
        .where(inArray(settlements.id, byType.get('settlement') as string[]));

      for (const row of rows) {
        labels.set(row.id, `Settlement ${row.reference ?? row.provider} - ${row.provider}`);
      }
    }

    return labels;
  }

  private async lockProposal(tx: DbExecutor, id: string): Promise<ProposalRow> {
    const [proposal] = await tx
      .select()
      .from(reconciliationProposals)
      .where(eq(reconciliationProposals.id, id))
      .limit(1)
      .for('update');

    if (!proposal) {
      throw new NotFoundException(`Proposal ${id} was not found`);
    }

    return proposal;
  }
}

function invalidTransition(action: string, currentStatus: string): ConflictException {
  return new ConflictException(`Invalid transition: cannot ${action} a proposal with status '${currentStatus}'`);
}

function notFoundRecord(recordId: string): NotFoundException {
  return new NotFoundException(`Record ${recordId} was not found`);
}

function pushToMapList<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key) ?? [];
  existing.push(value);
  map.set(key, existing);
}

function splitRecordKey(key: string): [string, string] {
  const separatorIndex = key.indexOf(':');
  return [key.slice(0, separatorIndex), key.slice(separatorIndex + 1)];
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function capitalizeWord(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortRecordLabel(sourceType: string, recordId: string): string {
  const names: Record<string, string> = {
    bank_transaction: 'Bank transaction',
    ledger_entry: 'Ledger entry',
    invoice: 'Invoice',
    settlement: 'Settlement',
    settlement_line: 'Settlement line',
  };

  return `${names[sourceType] ?? sourceType} #${recordId.slice(0, 4)}`;
}

const OUTCOME_EXCEPTION_TYPES: Record<string, ExceptionType> = {
  missing_settlement: 'missing_settlement',
  short_pay: 'short_pay',
  deduction: 'deduction',
};

const OUTCOME_DETAILS: Record<string, string> = {
  fee_variance: 'Fee lines differ from the linked deposit',
  refund: 'A refund line accounts for the deposit difference',
  excess_payment: 'The linked deposit exceeds the expected net',
  unexplained_variance: 'No settlement line explains the deposit difference',
};

function exceptionTypeForOutcome(outcome: string, ambiguous: boolean): ExceptionType {
  if (ambiguous) {
    return 'ambiguous_match';
  }

  return OUTCOME_EXCEPTION_TYPES[outcome] ?? 'amount_mismatch';
}

function deriveExceptionStatus(proposals: ProposalRow[]): ExceptionStatus {
  if (proposals.length === 0) {
    return 'open';
  }

  if (proposals.some((row) => row.status === 'accepted')) {
    return 'resolved';
  }

  if (proposals.some((row) => row.status === 'pending')) {
    return 'in_review';
  }

  return 'open';
}

function emptyExceptionCounts(): Record<ExceptionType, number> {
  return {
    unmatched: 0,
    amount_mismatch: 0,
    duplicate_candidate: 0,
    missing_invoice: 0,
    missing_settlement: 0,
    short_pay: 0,
    deduction: 0,
    date_mismatch: 0,
    ambiguous_match: 0,
  };
}

interface SettlementExceptionContext {
  headersById: Map<string, typeof settlements.$inferSelect>;
  linesBySettlement: Map<string, Array<typeof settlementLines.$inferSelect>>;
  proposalsByCandidate: Map<string, string[]>;
  proposalById: Map<string, ProposalRow>;
}

function buildSettlementExceptionItem(
  result: SettlementReconciliationItem,
  context: SettlementExceptionContext,
): ExceptionItemDto {
  const header = context.headersById.get(result.settlementId);
  const currency = result.currency;

  const settlementTarget = {
    sourceType: 'settlement',
    recordId: result.settlementId,
    label: `Settlement ${result.settlementReference ?? result.provider}`,
  };

  const bankTarget = result.relatedBankTransactionId
    ? {
        sourceType: 'bank_transaction',
        recordId: result.relatedBankTransactionId,
        label: shortRecordLabel('bank_transaction', result.relatedBankTransactionId),
      }
    : null;

  const causeLineIds = new Set(
    result.possibleCauses
      .map((cause) => cause.settlementLineId)
      .filter((id): id is string => id !== undefined),
  );

  const lineTargets = new Map<string, { sourceType: string; recordId: string; label: string }>();

  for (const line of result.settlementLines) {
    if (causeLineIds.has(line.id)) {
      lineTargets.set(line.id, {
        sourceType: 'settlement_line',
        recordId: line.id,
        label: `Settlement line #${line.id.slice(0, 4)}`,
      });
    }
  }

  const evidence: ExceptionEvidenceDto[] = result.evidence.map((entry) => ({
    label: entry.label,
    detail: entry.detail,
    target:
      entry.label === 'expected_net_computation'
        ? settlementTarget
        : entry.label === 'bank_link' || entry.label === 'comparison'
          ? bankTarget
          : entry.label === 'variance_attribution'
            ? [...lineTargets.values()][0] ?? null
            : null,
  }));

  const causes: ExceptionCauseDto[] = result.possibleCauses.map((cause) => ({
    causeType: cause.causeType,
    description: cause.description,
    amountCents: cause.amountCents ?? null,
    target: cause.settlementLineId
      ? lineTargets.get(cause.settlementLineId) ?? null
      : bankTarget ?? settlementTarget,
  }));

  const relatedProposalIds = context.proposalsByCandidate.get(`settlement:${result.settlementId}`) ?? [];
  const relatedProposals = relatedProposalIds
    .map((id) => context.proposalById.get(id))
    .filter((row): row is ProposalRow => row !== undefined);

  const confidence =
    relatedProposals.length > 0 ? Math.max(...relatedProposals.map((row) => row.score)) : null;

  const lines: SettlementLineDto[] = result.settlementLines.map((line) => ({
    id: line.id,
    type: line.type,
    description: line.description,
    amountCents: line.amountCents,
    reference: line.reference,
  }));

  return {
    id: `settlement:${result.settlementId}`,
    family: 'settlement',
    exceptionType: exceptionTypeForOutcome(result.outcome, result.ambiguous),
    title: `${result.provider} payout${result.settlementReference ? ` ${result.settlementReference}` : ''}`,
    detail: result.ambiguous
      ? 'Multiple bank deposits tie for this settlement'
      : (OUTCOME_DETAILS[result.outcome] ?? null),
    date: header ? header.settlementDate.toISOString() : new Date(0).toISOString(),
    amountCents: Math.abs(result.expectedAmountCents),
    currency,
    varianceCents: result.varianceCents,
    confidence,
    status: deriveExceptionStatus(relatedProposals),
    outcome: result.outcome,
    provider: result.provider,
    settlementReference: result.settlementReference,
    proposalId: relatedProposals[0]?.id ?? null,
    proposalStatus: relatedProposals[0]?.status ?? null,
    relatedRecords: [
      settlementTarget,
      ...(bankTarget ? [bankTarget] : []),
      ...[...lineTargets.values()],
    ],
    causes,
    evidence,
    explanation: result.explanation,
    settlement: {
      grossCents: result.expectation.grossCents,
      feesCents: result.expectation.feesCents,
      refundsCents: result.expectation.refundsCents,
      deductionsCents: result.expectation.deductionsCents,
      adjustmentsCents: result.expectation.adjustmentsCents,
      expectedNetCents: result.expectation.expectedNetCents,
      lines,
    },
  };
}

function sumStatusCounts(byStatus: Map<string, number>): number {
  let total = 0;

  for (const count of byStatus.values()) {
    total += count;
  }

  return total;
}

function rationaleTextOf(rationale: unknown): string | null {
  if (rationale === null || typeof rationale !== 'object') {
    return null;
  }

  const record = rationale as Record<string, unknown>;

  if (typeof record['summary'] === 'string') {
    return record['summary'];
  }

  if (typeof record['reason'] === 'string') {
    return record['reason'];
  }

  return null;
}

function isAmbiguousRationale(rationale: unknown): boolean {
  if (rationale === null || typeof rationale !== 'object') {
    return false;
  }

  return (rationale as Record<string, unknown>)['ambiguous'] === true;
}

function idsFor(
  grouped: Map<string, ProposalSourceDto[]>,
  sourceType: string,
): string[] {
  return (grouped.get(sourceType) ?? []).map((source) => source.recordId);
}

type CandidateRecordUnion = import('../domain/types').CandidateRecord['record'];

function candidateLabel(sourceType: string, record: CandidateRecordUnion): string {
  if (sourceType === 'invoice') {
    const invoice = record as { invoiceNumber: string; vendor: string };
    return `Invoice ${invoice.invoiceNumber} - ${invoice.vendor}`;
  }

  if (sourceType === 'ledger_entry') {
    const ledger = record as { accountCode: string; accountName: string };
    return `Ledger ${ledger.accountCode} - ${ledger.accountName}`;
  }

  const settlement = record as { settlementReference: string | null; provider: string };
  return `Settlement ${settlement.settlementReference ?? settlement.provider}`;
}

function candidateAmountOf(record: CandidateRecordUnion): number {
  if ('expectedNetCents' in record) {
    return record.expectedNetCents;
  }

  return record.amountCents;
}

async function loadProposalLinks(
  db: Database,
  proposalIds: string[],
): Promise<Map<string, ProposalSourceDto[]>> {
  const rows = await db
    .select()
    .from(proposalLinks)
    .where(inArray(proposalLinks.proposalId, proposalIds));

  const grouped = new Map<string, ProposalSourceDto[]>();

  for (const row of rows) {
    const existing = grouped.get(row.proposalId) ?? [];
    existing.push({ sourceType: row.sourceType, recordId: row.recordId });
    grouped.set(row.proposalId, existing);
  }

  return grouped;
}

async function appendActivityEntry(
  tx: DbExecutor,
  input: AppendActivityInput,
): Promise<ActivityRow> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('reconcile:activity_log'))`);

  const [last] = await tx
    .select({ hash: activityLog.hash })
    .from(activityLog)
    .orderBy(desc(activityLog.timestamp), desc(activityLog.id))
    .limit(1);

  const previousHash = last?.hash ?? GENESIS_HASH;
  const timestamp = new Date();

  const payload = {
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    previousState: input.previousState,
    newState: input.newState,
    reason: input.reason,
    aiUsed: input.aiUsed ?? false,
    timestamp: timestamp.toISOString(),
  };

  const hash = computeActivityHash(previousHash, payload);

  const [row] = await tx
    .insert(activityLog)
    .values({
      timestamp,
      actor: input.actor,
      action: input.action.slice(0, 64),
      entityType: input.entityType,
      entityId: input.entityId,
      payloadJson: payload,
      previousHash,
      hash,
    })
    .returning();

  return row;
}

function toChainEntry(row: ActivityRow): ActivityChainEntry {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    payloadJson: row.payloadJson,
    previousHash: row.previousHash,
    hash: row.hash,
  };
}

function toProposalSummary(row: ProposalRow, sources: ProposalSourceDto[]): ProposalSummaryDto {
  return {
    id: row.id,
    status: row.status,
    method: row.method,
    score: row.score,
    rationale: row.rationaleJson,
    sources,
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
    decidedBy: row.decidedBy ?? null,
    supersededBy: row.supersededBy ?? null,
  };
}

function toActivityDto(row: ActivityRow): ActivityEntryDto {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    actor: row.actor,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: row.payloadJson,
    previousHash: row.previousHash,
    hash: row.hash,
  };
}

function toEvidenceDto(row: EvidenceRow): EvidenceEntryDto {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    evidenceType: row.evidenceType,
    detail: row.detail,
  };
}
