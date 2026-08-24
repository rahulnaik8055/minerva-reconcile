import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes';
import type { AiExplanationDto } from '../ai/ai-sanitize';
import {
  approveProposalSchema,
  listActivityQuerySchema,
  listProposalsQuerySchema,
  overrideProposalSchema,
  proposalIdParamSchema,
  recordParamsSchema,
  rejectProposalSchema,
  worklistQuerySchema,
} from './dto/review.dto';
import type {
  ActivityFeedDto,
  CandidateOptionDto,
  DecisionResultDto,
  ExceptionsResponseDto,
  ListActivityQuery,
  ListProposalsQuery,
  OverrideResultDto,
  PaginatedProposalsDto,
  ProposalDetailDto,
  RecordDetailDto,
  RecordParams,
  ReviewSummaryDto,
} from './dto/review.dto';
import type { ApproveProposalInput, OverrideProposalInput, RejectProposalInput } from './dto/review.dto';
import type { WorklistQuery } from './dto/review.dto';
import { ReviewService, type PaginatedWorklistDto } from './review.service';

@ApiTags('review')
@ApiBearerAuth()
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('proposals/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run the deterministic matching engine over bank transactions without proposals',
  })
  @ApiOkResponse({ description: 'Number of proposals created' })
  generateProposals(): Promise<{ created: number; scannedBanks: number }> {
    return this.reviewService.generateProposalsForUnmatched();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Headline reconciliation counters for the overview and worklist' })
  @ApiOkResponse({ description: 'Proposal status counts, unmatched bank transactions, unresolved value' })
  getSummary(): Promise<ReviewSummaryDto> {
    return this.reviewService.getSummary();
  }

  @Get('worklist')
  @ApiOperation({
    summary:
      'Unified worklist of proposal-backed and unmatched bank transactions for the main table',
  })
  @ApiOkResponse({ description: 'Merged, date-sorted rows with status filter support' })
  getWorklist(
    @Query(new ZodValidationPipe(worklistQuerySchema)) query: WorklistQuery,
  ): Promise<PaginatedWorklistDto> {
    return this.reviewService.getWorklist(query);
  }

  @Get('proposals/:id/candidates')
  @ApiOperation({ summary: 'Scored alternative candidates for a proposal (used by override)' })
  @ApiOkResponse({ description: 'Ranked candidate records with signal details' })
  getCandidates(
    @Param('id', new ZodValidationPipe(proposalIdParamSchema)) id: string,
  ): Promise<{ candidates: CandidateOptionDto[] }> {
    return this.reviewService.getCandidates(id);
  }

  @Get('proposals')
  @ApiOperation({ summary: 'List reconciliation proposals with optional status filter' })
  @ApiOkResponse({ description: 'Paginated proposals' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  listProposals(
    @Query(new ZodValidationPipe(listProposalsQuerySchema)) query: ListProposalsQuery,
  ): Promise<PaginatedProposalsDto> {
    return this.reviewService.listProposals(query);
  }

  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get a proposal with its sources and evidence' })
  @ApiOkResponse({ description: 'Proposal detail' })
  @ApiNotFoundResponse({ description: 'Proposal not found' })
  getProposal(
    @Param('id', new ZodValidationPipe(proposalIdParamSchema)) id: string,
  ): Promise<ProposalDetailDto> {
    return this.reviewService.getProposal(id);
  }

  @Post('proposals/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending proposal' })
  @ApiOkResponse({ description: 'Proposal approved; decision recorded in the activity log' })
  @ApiNotFoundResponse({ description: 'Proposal not found' })
  @ApiConflictResponse({ description: 'Invalid transition: proposal is not pending' })
  approveProposal(
    @Param('id', new ZodValidationPipe(proposalIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(approveProposalSchema)) input: ApproveProposalInput,
    @CurrentUser('email') actor: string,
  ): Promise<DecisionResultDto> {
    return this.reviewService.approveProposal(id, actor, input);
  }

  @Post('proposals/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending proposal with a reason' })
  @ApiOkResponse({ description: 'Proposal rejected; reason recorded in the activity log' })
  @ApiNotFoundResponse({ description: 'Proposal not found' })
  @ApiConflictResponse({ description: 'Invalid transition: proposal is not pending' })
  rejectProposal(
    @Param('id', new ZodValidationPipe(proposalIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(rejectProposalSchema)) input: RejectProposalInput,
    @CurrentUser('email') actor: string,
  ): Promise<DecisionResultDto> {
    return this.reviewService.rejectProposal(id, actor, input);
  }

  @Post('proposals/:id/override')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Override an existing proposal: the original is preserved and superseded by a new manual proposal',
  })
  @ApiOkResponse({ description: 'Override applied; both proposals recorded in the activity log' })
  @ApiNotFoundResponse({ description: 'Proposal not found' })
  @ApiConflictResponse({ description: 'Proposal has already been overridden' })
  overrideProposal(
    @Param('id', new ZodValidationPipe(proposalIdParamSchema)) id: string,
    @Body(new ZodValidationPipe(overrideProposalSchema)) input: OverrideProposalInput,
    @CurrentUser('email') actor: string,
  ): Promise<OverrideResultDto> {
    return this.reviewService.overrideProposal(id, actor, input);
  }

  @Get('ai/status')
  @ApiOperation({ summary: 'Whether optional AI assistance is configured on this deployment' })
  @ApiOkResponse({ description: 'Availability flag and model name' })
  getAiStatus(): { available: boolean; model: string | null } {
    return this.reviewService.getAiStatus();
  }

  @Post('proposals/:id/ai-explanation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Advisory-only AI explanation for an ambiguous proposal (confidence 0.60-0.89). Never mutates data.',
  })
  @ApiOkResponse({ description: 'Structured AI suggestion for human review' })
  @ApiBadRequestResponse({ description: 'Proposal is outside the ambiguous confidence band' })
  explainProposal(
    @Param('id', new ZodValidationPipe(proposalIdParamSchema)) id: string,
  ): Promise<AiExplanationDto> {
    return this.reviewService.explainProposalWithAi(id);
  }

  @Post('exceptions/:exceptionId/ai-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Advisory-only AI summary of a computed exception. Never mutates data.',
  })
  @ApiOkResponse({ description: 'Structured AI summary for human review' })
  summarizeException(@Param('exceptionId') exceptionId: string): Promise<AiExplanationDto> {
    return this.reviewService.summarizeExceptionWithAi(exceptionId);
  }

  @Get('exceptions')
  @ApiOperation({
    summary:
      'Unified exception feed: settlement variances, unmatched movements, duplicates, ambiguity and date mismatches',
  })
  @ApiOkResponse({ description: 'Exception items grouped by type with evidence and explanations' })
  listExceptions(): Promise<ExceptionsResponseDto> {
    return this.reviewService.listExceptions();
  }

  @Get('records/:sourceType/:recordId')
  @ApiOperation({ summary: 'Detail view for any source record (backs clickable evidence)' })
  @ApiOkResponse({ description: 'Record fields, provenance and related proposals' })
  @ApiNotFoundResponse({ description: 'Record not found' })
  getRecord(
    @Param(new ZodValidationPipe(recordParamsSchema)) params: RecordParams,
  ): Promise<RecordDetailDto> {
    return this.reviewService.getRecordDetail(params);
  }

  @Get('evidence/:proposalId')
  @ApiOperation({ summary: 'Get all evidence rows attached to a proposal' })
  @ApiOkResponse({ description: 'Evidence entries for the proposal' })
  @ApiNotFoundResponse({ description: 'Proposal not found' })
  async getEvidence(
    @Param('proposalId', new ZodValidationPipe(proposalIdParamSchema)) proposalId: string,
  ): Promise<{ items: Awaited<ReturnType<ReviewService['getEvidence']>> }> {
    const items = await this.reviewService.getEvidence(proposalId);

    return { items };
  }

  @Get('activity')
  @ApiOperation({
    summary: 'Get the append-only activity history with hash-chain verification',
  })
  @ApiOkResponse({ description: 'Activity entries in chronological order plus chain verification' })
  listActivity(
    @Query(new ZodValidationPipe(listActivityQuerySchema)) query: ListActivityQuery,
  ): Promise<ActivityFeedDto> {
    return this.reviewService.listActivity(query);
  }
}
