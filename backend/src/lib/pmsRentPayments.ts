import { randomUUID } from "crypto";

import {
  PmsRentDueStatus,
  PmsRentPaymentStatus,
  type Prisma,
} from "@prisma/client";

import { AppError } from "../utils/http";

export const RENT_PAYMENT_PROVIDER = "THAWANI";
export const DEFAULT_THAWANI_API_BASE_URL = "https://uatcheckout.thawani.om/api/v1";
export const DEFAULT_THAWANI_CHECKOUT_BASE_URL = "https://uatcheckout.thawani.om";

export type RentDuePaymentSnapshot = {
  id: string;
  amount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  dueDate: Date;
  status: PmsRentDueStatus;
};

export type ThawaniApiResponse<T> = {
  success?: boolean;
  code?: number;
  description?: string;
  data?: T;
};

export type ThawaniCreateSessionData = {
  session_id: string;
  payment_status?: "paid" | "unpaid" | "cancelled";
};

export type ThawaniRetrieveSessionData = {
  session_id: string;
  payment_status: "paid" | "unpaid" | "cancelled";
  client_reference_id?: string;
  metadata?: {
    pms_rent_payment_id?: string;
    pms_rent_due_item_id?: string;
  };
};

export function decimalToNumber(value: unknown) {
  if (!value) return 0;

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : value.toString();
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function toBaisa(amount: number) {
  return Math.round(amount * 1000);
}

export function createPmsRentPaymentReference() {
  return `lux_rent_${randomUUID().replace(/-/g, "")}`;
}

export function createPmsRentReceiptNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `PMS-RCPT-${datePart}-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

export function getFrontendBaseUrl() {
  const frontendUrl = process.env.FRONTEND_URL?.trim();

  if (!frontendUrl && process.env.NODE_ENV === "production") {
    throw new AppError(500, "FRONTEND_URL must be configured in production");
  }

  const resolvedUrl = frontendUrl ?? "http://localhost:5173";

  if (
    process.env.NODE_ENV === "production" &&
    (resolvedUrl.includes("localhost") || resolvedUrl.includes("127.0.0.1"))
  ) {
    throw new AppError(500, "FRONTEND_URL must not use localhost in production");
  }

  return resolvedUrl.replace(/\/+$/, "");
}

export function getThawaniApiBaseUrl() {
  return (process.env.THAWANI_API_BASE_URL ?? DEFAULT_THAWANI_API_BASE_URL).replace(/\/+$/, "");
}

export function getThawaniCheckoutBaseUrl() {
  return (process.env.THAWANI_CHECKOUT_BASE_URL ?? DEFAULT_THAWANI_CHECKOUT_BASE_URL).replace(/\/+$/, "");
}

export function getThawaniConfig() {
  const secretKey = process.env.THAWANI_SECRET_KEY?.trim();
  const publishableKey = process.env.THAWANI_PUBLISHABLE_KEY?.trim();

  if (!secretKey || !publishableKey) {
    throw new AppError(
      503,
      "Thawani payment gateway is not configured. Manual rent payment recording remains available.",
    );
  }

  return {
    secretKey,
    publishableKey,
    apiBaseUrl: getThawaniApiBaseUrl(),
    checkoutBaseUrl: getThawaniCheckoutBaseUrl(),
  };
}

export function createCheckoutUrl(sessionId: string) {
  const { publishableKey, checkoutBaseUrl } = getThawaniConfig();

  return `${checkoutBaseUrl}/pay/${sessionId}?key=${encodeURIComponent(publishableKey)}`;
}

export function createTenantRentReturnUrl(input: {
  accessId: string;
  rentDueItemId: string;
  paymentReference: string;
  result: "success" | "cancel";
}) {
  const url = new URL("/tenant/rent", getFrontendBaseUrl());
  url.searchParams.set("accessId", input.accessId);
  url.searchParams.set("rentDueItem", input.rentDueItemId);
  url.searchParams.set("payment", input.paymentReference);
  url.searchParams.set("paymentResult", input.result);

  return url.toString();
}

export function getPaidRentStatus(input: {
  rentDueItem: RentDuePaymentSnapshot;
  paidAmount: number;
  now?: Date;
}) {
  const amount = decimalToNumber(input.rentDueItem.amount);
  const paid = roundMoney(input.paidAmount);
  const now = input.now ?? new Date();

  if (input.rentDueItem.status === PmsRentDueStatus.CANCELLED) {
    return PmsRentDueStatus.CANCELLED;
  }

  if (paid >= amount && amount > 0) {
    return PmsRentDueStatus.PAID;
  }

  if (paid > 0) {
    return PmsRentDueStatus.PARTIALLY_PAID;
  }

  if (input.rentDueItem.dueDate < now) {
    return PmsRentDueStatus.OVERDUE;
  }

  const dueSoon = new Date(now);
  dueSoon.setUTCDate(dueSoon.getUTCDate() + 14);

  if (input.rentDueItem.dueDate <= dueSoon) {
    return PmsRentDueStatus.DUE_SOON;
  }

  return PmsRentDueStatus.UNPAID;
}

export function assertCanApplyRentPayment(input: {
  rentDueItem: RentDuePaymentSnapshot;
  paymentAmount: number;
  existingConfirmedAmount: number;
}) {
  if (input.rentDueItem.status === PmsRentDueStatus.CANCELLED) {
    throw new AppError(400, "Cancelled rent due items cannot receive payments.");
  }

  if (input.paymentAmount <= 0) {
    throw new AppError(400, "Rent payment amount must be greater than zero.");
  }

  const totalDue = decimalToNumber(input.rentDueItem.amount);
  const remaining = roundMoney(totalDue - input.existingConfirmedAmount);

  if (remaining <= 0 || input.rentDueItem.status === PmsRentDueStatus.PAID) {
    throw new AppError(400, "This rent due item is already fully paid.");
  }

  if (roundMoney(input.paymentAmount - remaining) > 0) {
    throw new AppError(400, "Rent payment amount cannot exceed the remaining balance.");
  }
}

export function mapThawaniPaymentStatus(status: string) {
  if (status === "paid") return PmsRentPaymentStatus.CONFIRMED;
  if (status === "cancelled") return PmsRentPaymentStatus.FAILED;

  return PmsRentPaymentStatus.PENDING;
}

export async function callThawani<T>(path: string, init?: RequestInit) {
  const { secretKey, apiBaseUrl } = getThawaniConfig();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "thawani-api-key": secretKey,
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => null)) as ThawaniApiResponse<T> | null;

  if (!response.ok || !body?.success || !body.data) {
    throw new AppError(502, body?.description || "Thawani payment gateway request failed");
  }

  return body.data;
}
