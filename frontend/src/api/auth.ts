import { apiClient } from './client';
import type { PublicUser, UserRole } from '../types';

export type AuthUser = PublicUser & {
  role: UserRole;
  companyName?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
};

export type AuthVerificationResponse = {
  required: boolean;
  emailSent: boolean;
  devVerificationUrl?: string | null;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
  verification?: AuthVerificationResponse;
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
  companyName?: string;
};

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
  companyName?: string;
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

export async function updateCurrentUser(payload: UpdateProfilePayload, token: string) {
  return apiClient.patch<{ user: AuthUser }>('/api/auth/me', payload, {
    token
  });
}

export async function resendEmailVerification(token: string) {
  return apiClient.post<{ ok: true; verification: AuthVerificationResponse }>(
    '/api/auth/resend-verification',
    {},
    {
      token
    }
  );
}

export async function verifyEmail(token: string) {
  return apiClient.post<{ user: AuthUser }>('/api/auth/verify-email', {
    token
  });
}
