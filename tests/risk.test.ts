import { describe, expect, it } from "vitest";
import {
  calculatePriorityScore,
  calculateRiskVelocity,
  classifyRisk,
  classifyRiskVelocity,
  expectedLoss,
} from "../lib/risk";

describe("risk utilities", () => {
  it("uses explicit PD band boundaries", () => {
    expect(classifyRisk(0.119)).toBe("low");
    expect(classifyRisk(0.12)).toBe("moderate");
    expect(classifyRisk(0.3)).toBe("high");
    expect(classifyRisk(0.5)).toBe("critical");
  });

  it("classifies deterioration using percentage-point velocity", () => {
    expect(calculateRiskVelocity(0.31, 0.18)).toBeCloseTo(0.13);
    expect(classifyRiskVelocity(0.13)).toBe("rapidly deteriorating");
    expect(classifyRiskVelocity(-0.03)).toBe("improving");
  });

  it("computes expected loss only from supplied PD, LGD, and EAD", () => {
    expect(expectedLoss(0.2, 0.45, 1_000_000)).toBeCloseTo(90_000);
  });

  it("raises review priority for acceleration, anomalies, and disagreement", () => {
    const base = calculatePriorityScore({
      calibratedPd: 0.3,
      previousPd: 0.28,
      anomalyPercentile: 60,
      exposure: 1_000_000,
      confidence: "high",
      modelAgreement: true,
    });
    const stressed = calculatePriorityScore({
      calibratedPd: 0.45,
      previousPd: 0.31,
      anomalyPercentile: 96,
      exposure: 2_000_000,
      confidence: "low",
      modelAgreement: false,
    });

    expect(stressed).toBeGreaterThan(base);
  });
});
