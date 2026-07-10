export type PmsCommandPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type PmsHealthStatus = "HEALTHY" | "WATCH" | "AT_RISK" | "NO_DATA";

export type PmsHealthSignal = {
  score: number | null;
  status: PmsHealthStatus;
  label: string;
  detail: string;
};

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function priorityFromScore(score: number): PmsCommandPriority {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

export function priorityRank(priority: PmsCommandPriority) {
  return ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const)[priority];
}

export function buildHealthSignal(input: {
  score: number | null;
  label: string;
  detail: string;
}): PmsHealthSignal {
  if (input.score === null) {
    return {
      score: null,
      status: "NO_DATA",
      label: input.label,
      detail: input.detail,
    };
  }

  const score = clampScore(input.score);
  return {
    score,
    status: score >= 80 ? "HEALTHY" : score >= 60 ? "WATCH" : "AT_RISK",
    label: input.label,
    detail: input.detail,
  };
}

export function averageHealthScore(scores: Array<number | null>) {
  const values = scores.filter((score): score is number => score !== null);
  if (!values.length) return null;
  return values.reduce((sum, score) => sum + score, 0) / values.length;
}

export function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function rentRiskScore(input: {
  dueDate: Date;
  now: Date;
  outstandingAmount: number;
  originalAmount: number;
  overdueItemCount?: number;
}) {
  const daysOverdue = Math.max(0, -daysBetween(input.now, input.dueDate));
  const ageScore = Math.min(daysOverdue * 1.7, 55);
  const amountRatio = input.originalAmount > 0
    ? Math.min(input.outstandingAmount / input.originalAmount, 1)
    : 0;
  const balanceScore = amountRatio * 25;
  const repeatedScore = Math.min(Math.max((input.overdueItemCount ?? 1) - 1, 0) * 10, 20);
  return clampScore(ageScore + balanceScore + repeatedScore);
}

export function maintenanceRiskScore(input: {
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  targetDate: Date | null;
  now: Date;
}) {
  const priorityScore = ({ LOW: 10, MEDIUM: 25, HIGH: 45, URGENT: 65 } as const)[input.priority];
  const daysOverdue = input.targetDate
    ? Math.max(0, -daysBetween(input.now, input.targetDate))
    : 0;
  return clampScore(priorityScore + Math.min(daysOverdue * 2.5, 35));
}

export function leaseExpiryRiskScore(input: {
  endDate: Date;
  now: Date;
  missingLeaseDocument: boolean;
}) {
  const daysRemaining = Math.max(0, daysBetween(input.now, input.endDate));
  const urgencyScore = Math.max(0, 70 - daysRemaining);
  return clampScore(urgencyScore + (input.missingLeaseDocument ? 25 : 0));
}

export function documentRiskScore(input: {
  expiryDate: Date | null;
  now: Date;
  missing: boolean;
}) {
  if (input.missing) return 75;
  if (!input.expiryDate) return 20;
  const daysRemaining = daysBetween(input.now, input.expiryDate);
  if (daysRemaining < 0) return 95;
  return clampScore(70 - Math.min(daysRemaining, 70));
}
