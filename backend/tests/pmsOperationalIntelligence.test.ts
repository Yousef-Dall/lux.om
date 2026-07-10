import { describe, expect, it } from "vitest";

import {
  averageHealthScore,
  buildHealthSignal,
  documentRiskScore,
  leaseExpiryRiskScore,
  maintenanceRiskScore,
  priorityFromScore,
  rentRiskScore,
} from "../src/lib/pmsOperationalIntelligence";

describe("PMS operational intelligence", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");

  it("maps risk scores to stable operational priorities", () => {
    expect(priorityFromScore(20)).toBe("LOW");
    expect(priorityFromScore(35)).toBe("MEDIUM");
    expect(priorityFromScore(65)).toBe("HIGH");
    expect(priorityFromScore(85)).toBe("CRITICAL");
  });

  it("increases rent risk for older, larger, repeated arrears", () => {
    const recent = rentRiskScore({
      dueDate: new Date("2026-07-05T12:00:00.000Z"),
      now,
      outstandingAmount: 100,
      originalAmount: 500,
      overdueItemCount: 1,
    });
    const severe = rentRiskScore({
      dueDate: new Date("2026-05-01T12:00:00.000Z"),
      now,
      outstandingAmount: 500,
      originalAmount: 500,
      overdueItemCount: 3,
    });

    expect(severe).toBeGreaterThan(recent);
    expect(priorityFromScore(severe)).toBe("CRITICAL");
  });

  it("scores urgent SLA breaches above routine upcoming work", () => {
    const routine = maintenanceRiskScore({
      priority: "LOW",
      targetDate: new Date("2026-07-20T12:00:00.000Z"),
      now,
    });
    const urgentOverdue = maintenanceRiskScore({
      priority: "URGENT",
      targetDate: new Date("2026-06-30T12:00:00.000Z"),
      now,
    });

    expect(urgentOverdue).toBeGreaterThan(routine);
    expect(priorityFromScore(urgentOverdue)).toBe("CRITICAL");
  });

  it("accounts for missing lease documents and expired compliance records", () => {
    const completeLease = leaseExpiryRiskScore({
      endDate: new Date("2026-08-09T12:00:00.000Z"),
      now,
      missingLeaseDocument: false,
    });
    const incompleteLease = leaseExpiryRiskScore({
      endDate: new Date("2026-08-09T12:00:00.000Z"),
      now,
      missingLeaseDocument: true,
    });

    expect(incompleteLease).toBeGreaterThan(completeLease);
    expect(documentRiskScore({ expiryDate: new Date("2026-07-01T12:00:00.000Z"), now, missing: false })).toBe(95);
    expect(documentRiskScore({ expiryDate: null, now, missing: true })).toBe(75);
  });

  it("produces no-data health states without inventing scores", () => {
    expect(averageHealthScore([null, null])).toBeNull();
    expect(averageHealthScore([80, null, 60])).toBe(70);
    expect(buildHealthSignal({ score: null, label: "Collection", detail: "No obligations" })).toEqual({
      score: null,
      status: "NO_DATA",
      label: "Collection",
      detail: "No obligations",
    });
  });
});
