import type { LoanReview, RiskBand, RiskTrend } from "./types";

export function classifyRisk(pd: number): RiskBand {
  if (pd >= 0.5) return "critical";
  if (pd >= 0.3) return "high";
  if (pd >= 0.12) return "moderate";
  return "low";
}

export function calculateRiskVelocity(currentPd: number, previousPd: number) {
  return currentPd - previousPd;
}

export function classifyRiskVelocity(velocity: number): RiskTrend {
  if (velocity <= -0.025) return "improving";
  if (velocity < 0.025) return "stable";
  if (velocity < 0.08) return "slowly deteriorating";
  return "rapidly deteriorating";
}

export function expectedLoss(pd: number, lgd: number, ead: number) {
  return pd * lgd * ead;
}

export function calculatePriorityScore(loan: Pick<LoanReview,
  "calibratedPd" | "previousPd" | "anomalyPercentile" | "exposure" | "confidence" | "modelAgreement"
>) {
  const pdComponent = loan.calibratedPd * 42;
  const velocityComponent = Math.max(0, loan.calibratedPd - loan.previousPd) * 190;
  const anomalyComponent = (loan.anomalyPercentile / 100) * 18;
  const exposureComponent = Math.min(loan.exposure / 2_500_000, 1) * 12;
  const confidencePenalty = loan.confidence === "low" ? 8 : loan.confidence === "medium" ? 3 : 0;
  const disagreementPenalty = loan.modelAgreement ? 0 : 7;

  return Math.min(
    100,
    Math.round(
      pdComponent + velocityComponent + anomalyComponent + exposureComponent +
        confidencePenalty + disagreementPenalty,
    ),
  );
}
