export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  fullName: string;
}

export interface JwtPayload extends JwtTokenPayload {
  iat: number;
  exp: number;
}
