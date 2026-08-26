export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  clerkId: string;
  email: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}
