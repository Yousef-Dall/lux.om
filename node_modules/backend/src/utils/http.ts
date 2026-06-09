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
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null
  };
}