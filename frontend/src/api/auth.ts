import { apiClient } from './client';
import type { PublicUser, UserRole } from '../types';

export type AuthUser = PublicUser & {
  role: UserRole;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role?: 'USER' | 'OWNER';
  phone?: string;
};

export async function login(payload: LoginPayload) {
  return apiClient.post<AuthResponse>('/api/auth/login', payload);
}

export async function register(payload: RegisterPayload) {
  return apiClient.post<AuthResponse>('/api/auth/register', payload);
}

export async function getCurrentUser(token: string) {
  return apiClient.get<{ user: AuthUser }>('/api/auth/me', {
    token
  });
}