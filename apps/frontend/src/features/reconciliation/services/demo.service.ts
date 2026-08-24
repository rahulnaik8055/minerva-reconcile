import { apiClient } from '@/lib/api';
import type { DemoLoadResult, DemoStatus } from '../types';

export const demoService = {
  getStatus(): Promise<DemoStatus> {
    return apiClient<DemoStatus>('/demo/status');
  },

  loadDemoData(): Promise<DemoLoadResult> {
    return apiClient<DemoLoadResult>('/demo/load', { method: 'POST' });
  },

  resetDemoData(): Promise<{ cleared: boolean }> {
    return apiClient<{ cleared: boolean }>('/demo/data', { method: 'DELETE' });
  },
};
