import type { UserRole } from '../types/user-role.type.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
}
