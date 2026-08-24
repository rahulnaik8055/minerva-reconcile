import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DemoLoadResult } from '../types';
import { demoService } from '../services/demo.service';

export function useDemoStatus() {
  return useQuery({
    queryKey: ['demo', 'status'],
    queryFn: () => demoService.getStatus(),
  });
}

export function useLoadDemoData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (): Promise<DemoLoadResult> => demoService.loadDemoData(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

export function useResetDemoData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => demoService.resetDemoData(),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
