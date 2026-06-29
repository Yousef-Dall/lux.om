export class AppError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  companyName?: string | null;
  emailBookingUpdates?: boolean | null;
  emailSavedSearchUpdates?: boolean | null;
  emailMarketingUpdates?: boolean | null;
  emailVerified?: boolean;
  emailVerifiedAt?: Date | string | null;
  googleId?: string | null;
  passwordLoginEnabled?: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    companyName: user.companyName ?? null,
    emailBookingUpdates: user.emailBookingUpdates ?? true,
    emailSavedSearchUpdates: user.emailSavedSearchUpdates ?? true,
    emailMarketingUpdates: user.emailMarketingUpdates ?? false,
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    googleConnected: Boolean(user.googleId),
    passwordLoginEnabled: user.passwordLoginEnabled ?? true
  };
}
