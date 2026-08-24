import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reviewService } from '../services/review.service';
import type { WorklistFilter } from '../types';

export function useSummary() {
  return useQuery({ queryKey: ['review', 'summary'], queryFn: () => reviewService.getSummary() });
}

export function useWorklist(status: WorklistFilter, page = 1, limit = 25) {
  return useQuery({
    queryKey: ['review', 'worklist', status, page, limit],
    queryFn: () => reviewService.getWorklist({ status, page, limit }),
  });
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: ['review', 'proposal', id],
    queryFn: () => reviewService.getProposal(id),
    enabled: id.length > 0,
  });
}

export function useCandidates(id: string, enabled = false) {
  return useQuery({
    queryKey: ['review', 'proposal', id, 'candidates'],
    queryFn: () => reviewService.getCandidates(id),
    enabled,
  });
}

export function useExceptions() {
  return useQuery({ queryKey: ['review', 'exceptions'], queryFn: () => reviewService.getExceptions() });
}

export function useRecord(sourceType: string, recordId: string, enabled = true) {
  return useQuery({
    queryKey: ['review', 'record', sourceType, recordId],
    queryFn: () => reviewService.getRecord(sourceType, recordId),
    enabled: enabled && recordId.length > 0,
  });
}

export function useActivity(entityId?: string, limit = 100) {
  return useQuery({
    queryKey: ['review', 'activity', entityId ?? 'all', limit],
    queryFn: () => reviewService.getActivity(entityId, limit),
  });
}

function useInvalidateReview() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['review'] });
  };
}

export function useGenerateProposals() {
  const invalidate = useInvalidateReview();

  return useMutation({
    mutationFn: () => reviewService.generate(),
    onSuccess: (result) => {
      toast.success(
        result.created > 0
          ? `Created ${result.created} proposal${result.created === 1 ? '' : 's'} from ${result.scannedBanks} bank transactions`
          : 'No new proposals — every bank transaction already has one or no data imported',
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useApproveProposal(id: string) {
  const invalidate = useInvalidateReview();

  return useMutation({
    mutationFn: (note?: string) => reviewService.approve(id, note),
    onSuccess: () => {
      toast.success('Proposal approved');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRejectProposal(id: string) {
  const invalidate = useInvalidateReview();

  return useMutation({
    mutationFn: (reason: string) => reviewService.reject(id, reason),
    onSuccess: () => {
      toast.success('Proposal rejected');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useOverrideProposal(id: string) {
  const invalidate = useInvalidateReview();

  return useMutation({
    mutationFn: (input: { reason: string; candidateSourceType?: string; candidateRecordId?: string }) =>
      reviewService.override(id, input),
    onSuccess: () => {
      toast.success('Override recorded — new manual proposal created');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
