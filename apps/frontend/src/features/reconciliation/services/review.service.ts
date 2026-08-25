import { apiClient } from '@/lib/api';
import type {
  ActivityFeed,
  AiExplanation,
  AiStatus,
  CandidateOption,
  DecisionResult,
  ExceptionsResponse,
  ImportSummary,
  OverrideResult,
  ProposalDetail,
  RecordDetail,
  ReviewSummary,
  WorklistFilter,
  WorklistPage,
} from '../types';

export interface WorklistParams {
  status?: WorklistFilter;
  page?: number;
  limit?: number;
}

export const reviewService = {
  generate(): Promise<{ created: number; scannedBanks: number }> {
    return apiClient<{ created: number; scannedBanks: number }>('/review/proposals/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  getSummary(): Promise<ReviewSummary> {
    return apiClient<ReviewSummary>('/review/summary');
  },

  getWorklist(params: WorklistParams = {}): Promise<WorklistPage> {
    const search = new URLSearchParams();

    if (params.status) {
      search.set('status', params.status);
    }

    search.set('page', String(params.page ?? 1));
    search.set('limit', String(params.limit ?? 25));

    return apiClient<WorklistPage>(`/review/worklist?${search.toString()}`);
  },

  listProposals(status?: string, page = 1, limit = 25): Promise<WorklistPage> {
    const search = new URLSearchParams({ page: String(page), limit: String(limit) });

    if (status) {
      search.set('status', status);
    }

    return apiClient<WorklistPage>(`/review/proposals?${search.toString()}`);
  },

  getProposal(id: string): Promise<ProposalDetail> {
    return apiClient<ProposalDetail>(`/review/proposals/${id}`);
  },

  getCandidates(id: string): Promise<{ candidates: CandidateOption[] }> {
    return apiClient<{ candidates: CandidateOption[] }>(`/review/proposals/${id}/candidates`);
  },

  approve(id: string, note?: string): Promise<DecisionResult> {
    return apiClient<DecisionResult>(`/review/proposals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {}),
    });
  },

  reject(id: string, reason: string): Promise<DecisionResult> {
    return apiClient<DecisionResult>(`/review/proposals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  override(
    id: string,
    input: { reason: string; candidateSourceType?: string; candidateRecordId?: string },
  ): Promise<OverrideResult> {
    return apiClient<OverrideResult>(`/review/proposals/${id}/override`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getExceptions(): Promise<ExceptionsResponse> {
    return apiClient<ExceptionsResponse>('/review/exceptions');
  },

  getRecord(sourceType: string, recordId: string): Promise<RecordDetail> {
    return apiClient<RecordDetail>(`/review/records/${sourceType}/${recordId}`);
  },

  getAiStatus(): Promise<AiStatus> {
    return apiClient<AiStatus>('/review/ai/status');
  },

  explainProposal(id: string): Promise<AiExplanation> {
    return apiClient<AiExplanation>(`/review/proposals/${id}/ai-explanation`, { method: 'POST' });
  },

  summarizeException(exceptionId: string): Promise<AiExplanation> {
    return apiClient<AiExplanation>(`/review/exceptions/${exceptionId}/ai-summary`, { method: 'POST' });
  },

  getActivity(entityId?: string, limit = 100): Promise<ActivityFeed> {
    const search = new URLSearchParams({ limit: String(limit) });

    if (entityId) {
      search.set('entityId', entityId);
    }

    return apiClient<ActivityFeed>(`/review/activity?${search.toString()}`);
  },
};

const IMPORT_ENDPOINTS: Record<string, string> = {
  bank: '/imports/bank',
  ledger: '/imports/ledger',
  invoice: '/imports/invoices',
  settlement: '/imports/settlements',
};

export async function importCsv(type: string, file: File): Promise<ImportSummary> {
  const endpoint = IMPORT_ENDPOINTS[type];

  if (!endpoint) {
    throw new Error(`Unknown import type: ${type}`);
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api/v1'}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const body = (await response.json().catch(() => null)) as
    | { success: boolean; data?: ImportSummary; error?: string }
    | null;

  if (!response.ok || !body?.data) {
    throw new Error(body?.error ?? `Import failed with status ${response.status}`);
  }

  return body.data;
}
