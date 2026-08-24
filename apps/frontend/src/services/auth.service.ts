import { apiClient } from '@/lib/api';
import type { AuthResponse, LoginInput, RegisterInput, User } from '@/types';

export const authService = {
  register(input: RegisterInput): Promise<AuthResponse> {
    return apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: LoginInput): Promise<AuthResponse> {
    return apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  logout(): Promise<{ message: string }> {
    return apiClient<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  getMe(): Promise<User> {
    return apiClient<User>('/auth/me');
  },
};
