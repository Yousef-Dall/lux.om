import { apiClient } from './client';
import type { PublicUser, UserRole } from '../types';

export type AuthUser = PublicUser & {
  role: UserRole;
  companyName?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  googleConnected?: boolean;
  passwordLoginEnabled?: boolean;
  emailBookingUpdates?: boolean;
  emailSavedSearchUpdates?: boolean;
  emailMarketingUpdates?: boolean;
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
  emailBookingUpdates?: boolean;
  emailSavedSearchUpdates?: boolean;
  emailMarketingUpdates?: boolean;
};

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
  companyName?: string;
  emailBookingUpdates?: boolean;
  emailSavedSearchUpdates?: boolean;
  emailMarketingUpdates?: boolean;
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

function getApiBaseUrl() {
  const env = import.meta.env as ImportMetaEnv & {
    VITE_API_URL?: string;
    VITE_API_BASE_URL?: string;
  };

  return env.VITE_API_URL || env.VITE_API_BASE_URL || 'http://localhost:4000';
}

export function getGoogleOAuthStartUrl(input: {
  role?: 'USER' | 'OWNER';
  returnTo?: string;
} = {}) {
  const url = new URL('/api/auth/google/start', getApiBaseUrl());

  if (input.role) {
    url.searchParams.set('role', input.role);
  }

  if (input.returnTo) {
    url.searchParams.set('returnTo', input.returnTo);
  }

  return url.toString();
}

export async function exchangeGoogleOAuthCode(code: string) {
  return apiClient.post<AuthResponse & { returnTo: string }>('/api/auth/google/exchange', {
    code
  });
}

export type PasswordResetRequestResponse = {
  ok: true;
  reset: {
    devPasswordResetUrl?: string | null;
  };
};

export async function requestPasswordReset(email: string) {
  return apiClient.post<PasswordResetRequestResponse>('/api/auth/request-password-reset', {
    email
  });
}

export async function resetPassword(payload: { token: string; password: string }) {
  return apiClient.post<{ ok: true; user: AuthUser }>('/api/auth/reset-password', payload);
}

export type ChangePasswordPayload = {
  currentPassword?: string;
  newPassword: string;
};

export async function changePassword(payload: ChangePasswordPayload, token: string) {
  return apiClient.post<{ ok: true; user: AuthUser; token: string }>('/api/auth/change-password', payload, {
    token
  });
}

export async function logoutAllSessions(token: string) {
  return apiClient.post<{ ok: true; user: AuthUser; token: string }>(
    '/api/auth/logout-all-sessions',
    {},
    {
      token
    }
  );
}

export type RequestEmailChangeResponse = {
  ok: true;
  emailChange: {
    pendingEmail: string;
    emailSent: boolean;
    devEmailChangeVerificationUrl?: string | null;
  };
};

export async function requestEmailChange(
  payload: { email: string; currentPassword?: string },
  token: string
) {
  return apiClient.post<RequestEmailChangeResponse>(
    '/api/auth/request-email-change',
    payload,
    {
      token
    }
  );
}

export async function confirmEmailChange(token: string) {
  return apiClient.post<{ ok: true; user: AuthUser; token: string }>(
    '/api/auth/confirm-email-change',
    {
      token
    }
  );
}

export type AdminUserAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  companyName?: string | null;
  googleConnected: boolean;
  passwordLoginEnabled: boolean;
  emailVerified: boolean;
  emailVerifiedAt?: string | null;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  suspendedById?: string | null;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  authTokenVersion: number;
  createdAt?: string;
  updatedAt?: string;
  counts?: {
    listings: number;
    activities: number;
    bookings: number;
    notifications: number;
    accountSecurityEvents: number;
  };
};

export type AdminUserSecurityEvent = {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata?: unknown;
  actorId?: string | null;
  createdAt: string;
};

export type AdminUsersQuery = {
  query?: string;
  role?: UserRole;
  status?: 'all' | 'active' | 'suspended' | 'verified' | 'unverified';
  page?: number;
  pageSize?: number;
};

export async function listAdminUsers(params: AdminUsersQuery, token: string) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();

  return apiClient.get<{
    records: AdminUserAccount[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      pageCount: number;
    };
  }>(`/api/auth/admin/users${queryString ? `?${queryString}` : ''}`, {
    token
  });
}

export async function getAdminUserSecurity(userId: string, token: string) {
  return apiClient.get<{
    user: AdminUserAccount;
    securityEvents: AdminUserSecurityEvent[];
  }>(`/api/auth/admin/users/${userId}/security`, {
    token
  });
}

export async function updateAdminUserSuspension(
  userId: string,
  payload: { suspended: boolean; reason?: string },
  token: string
) {
  return apiClient.patch<{ user: AdminUserAccount }>(
    `/api/auth/admin/users/${userId}/suspension`,
    payload,
    {
      token
    }
  );
}

export async function updateAdminUserEmailVerification(
  userId: string,
  payload: { emailVerified: boolean; reason: string },
  token: string
) {
  return apiClient.patch<{ user: AdminUserAccount }>(
    `/api/auth/admin/users/${userId}/email-verification`,
    payload,
    {
      token
    }
  );
}

export type EmailDeliveryStatus = 'LOGGED' | 'SENT' | 'SKIPPED' | 'FAILED';

export type AdminEmailDeliveryEvent = {
  id: string;
  status: EmailDeliveryStatus;
  deliveryMode: string;
  notificationType: string;
  title: string;
  recipientUserId?: string | null;
  recipientEmail?: string | null;
  actionUrl?: string | null;
  preferencesUrl?: string | null;
  messageId?: string | null;
  reason?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

export type AdminEmailDeliveriesQuery = {
  query?: string;
  status?: 'all' | EmailDeliveryStatus;
  type?: string;
  page?: number;
  pageSize?: number;
};

export async function listAdminEmailDeliveries(
  params: AdminEmailDeliveriesQuery,
  token: string
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();

  return apiClient.get<{
    records: AdminEmailDeliveryEvent[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      pageCount: number;
    };
  }>(`/api/auth/admin/email-deliveries${queryString ? `?${queryString}` : ''}`, {
    token
  });
}

export type AdminEmailDeliveryHealthSummary = {
  windowDays: number;
  since: string;
  total: number;
  statusCounts: Record<EmailDeliveryStatus, number>;
  recentFailures: AdminEmailDeliveryEvent[];
};

export async function getAdminEmailDeliveryHealthSummary(token: string) {
  return apiClient.get<AdminEmailDeliveryHealthSummary>(
    '/api/auth/admin/email-deliveries/summary',
    {
      token
    }
  );
}

export type AdminSystemHealthStatus = 'healthy' | 'warning' | 'critical';

export type AdminSystemHealthCheck = {
  key: string;
  label: string;
  status: AdminSystemHealthStatus;
  message: string;
};

export type AdminSystemHealth = {
  checkedAt: string;
  overallStatus: AdminSystemHealthStatus;
  environment: {
    nodeEnv: string;
    isProduction: boolean;
  };
  database: {
    status: AdminSystemHealthStatus;
    latencyMs: number;
  };
  email: {
    deliveryMode: string;
    smtpConfigured: boolean;
    smtpHostConfigured: boolean;
    smtpPortConfigured: boolean;
    smtpUserConfigured: boolean;
    smtpPasswordConfigured: boolean;
    mailFromConfigured: boolean;
  };
  urls: {
    frontendUrlConfigured: boolean;
    frontendUrlUsesHttps: boolean;
    frontendUrlHasLocalhost: boolean;
    corsOriginsCount: number;
    corsUsesWildcard: boolean;
    corsHasLocalhost: boolean;
  };
  rateLimiting: {
    trustProxyHops: number;
  };
  retention: {
    retentionDays: number | null;
    minimumDays: number;
  };
  checks: AdminSystemHealthCheck[];
};

export async function getAdminSystemHealth(token: string) {
  return apiClient.get<AdminSystemHealth>('/api/auth/admin/system-health', {
    token
  });
}
