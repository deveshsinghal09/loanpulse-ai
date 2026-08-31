import type { LoanReview, PortfolioPoint, PortfolioSummary } from "./types";
import { calculatePriorityScore, expectedLoss } from "./risk";

export const portfolioSummary: PortfolioSummary = {
  name: "Northstar 2026 — Mid-market",
  asOf: "2026-08-25",
  modelVersion: "PD v3.4 · isotonic",
  dataFreshness: "Updated 42 min ago",
  loanCount: 2_418,
  totalExposure: 286_400_000,
  expectedLoss: 9_840_000,
  highRiskExposure: 42_600_000,
  newAlerts: 37,
  averageCalibratedPd: 0.086,
  dataHealth: 0.94,
};

export const portfolioTrend: PortfolioPoint[] = [
  { period: "2026-06-10", label: "Jun 10", calibratedPd: 0.061, expectedLoss: 7.1, highRiskExposure: 31.2, alerts: 18 },
  { period: "2026-06-17", label: "Jun 17", calibratedPd: 0.063, expectedLoss: 7.3, highRiskExposure: 31.8, alerts: 20 },
  { period: "2026-06-24", label: "Jun 24", calibratedPd: 0.064, expectedLoss: 7.5, highRiskExposure: 32.6, alerts: 19 },
  { period: "2026-07-01", label: "Jul 01", calibratedPd: 0.067, expectedLoss: 7.7, highRiskExposure: 34.1, alerts: 23 },
  { period: "2026-07-08", label: "Jul 08", calibratedPd: 0.069, expectedLoss: 8.0, highRiskExposure: 35.4, alerts: 24 },
  { period: "2026-07-15", label: "Jul 15", calibratedPd: 0.071, expectedLoss: 8.2, highRiskExposure: 36.7, alerts: 26 },
  { period: "2026-07-22", label: "Jul 22", calibratedPd: 0.074, expectedLoss: 8.5, highRiskExposure: 37.6, alerts: 28 },
  { period: "2026-07-29", label: "Jul 29", calibratedPd: 0.076, expectedLoss: 8.8, highRiskExposure: 39.1, alerts: 31 },
  { period: "2026-08-05", label: "Aug 05", calibratedPd: 0.079, expectedLoss: 9.0, highRiskExposure: 39.8, alerts: 29 },
  { period: "2026-08-12", label: "Aug 12", calibratedPd: 0.081, expectedLoss: 9.3, highRiskExposure: 40.5, alerts: 33 },
  { period: "2026-08-19", label: "Aug 19", calibratedPd: 0.083, expectedLoss: 9.5, highRiskExposure: 41.7, alerts: 35 },
  { period: "2026-08-25", label: "Aug 25", calibratedPd: 0.086, expectedLoss: 9.84, highRiskExposure: 42.6, alerts: 37 },
];

const rawLoans: Omit<LoanReview, "priority" | "expectedLoss">[] = [
  { id: "LP-10482", borrower: "Aster Components", segment: "Industrial", region: "Midwest", exposure: 2_460_000, calibratedPd: 0.612, previousPd: 0.481, anomalyPercentile: 98, confidence: "high", lastSignal: "Payment coverage fell 22%", lastSignalAt: "2h ago", topDriver: "Debt service coverage 0.91×", modelAgreement: true, daysPastDue: 19, officer: "M. Chen" },
  { id: "LP-10317", borrower: "Juniper Health Group", segment: "Healthcare", region: "Southeast", exposure: 1_920_000, calibratedPd: 0.447, previousPd: 0.348, anomalyPercentile: 91, confidence: "medium", lastSignal: "Two moderate signals combined", lastSignalAt: "5h ago", topDriver: "DTI rose from 44% to 53%", modelAgreement: false, daysPastDue: 8, officer: "R. Patel" },
  { id: "LP-10901", borrower: "Cobalt Freight", segment: "Transport", region: "Southwest", exposure: 1_480_000, calibratedPd: 0.391, previousPd: 0.298, anomalyPercentile: 96, confidence: "high", lastSignal: "Utilization breached 85%", lastSignalAt: "7h ago", topDriver: "Revolver utilization 88%", modelAgreement: true, daysPastDue: 12, officer: "S. Lewis" },
  { id: "LP-10144", borrower: "Harborline Foods", segment: "Consumer", region: "Northeast", exposure: 2_210_000, calibratedPd: 0.338, previousPd: 0.322, anomalyPercentile: 72, confidence: "low", lastSignal: "Outside training distribution", lastSignalAt: "11h ago", topDriver: "Unusual balance expansion", modelAgreement: false, daysPastDue: 0, officer: "A. Gomez" },
  { id: "LP-10856", borrower: "Meridian Field Services", segment: "Business services", region: "Mountain", exposure: 1_130_000, calibratedPd: 0.284, previousPd: 0.191, anomalyPercentile: 88, confidence: "medium", lastSignal: "Risk velocity accelerated", lastSignalAt: "1d ago", topDriver: "Payment variance +31%", modelAgreement: true, daysPastDue: 6, officer: "T. Brooks" },
  { id: "LP-10072", borrower: "Blue Oak Hospitality", segment: "Hospitality", region: "West", exposure: 2_730_000, calibratedPd: 0.263, previousPd: 0.241, anomalyPercentile: 84, confidence: "high", lastSignal: "Revenue trend weakened", lastSignalAt: "1d ago", topDriver: "Income trend −14%", modelAgreement: true, daysPastDue: 3, officer: "M. Chen" },
  { id: "LP-10663", borrower: "Northwind Packaging", segment: "Industrial", region: "Midwest", exposure: 960_000, calibratedPd: 0.218, previousPd: 0.137, anomalyPercentile: 79, confidence: "high", lastSignal: "DPD crossed watch threshold", lastSignalAt: "2d ago", topDriver: "Recent DPD reached 11", modelAgreement: true, daysPastDue: 11, officer: "R. Patel" },
  { id: "LP-10528", borrower: "Solis Dental Partners", segment: "Healthcare", region: "Southwest", exposure: 1_650_000, calibratedPd: 0.174, previousPd: 0.192, anomalyPercentile: 43, confidence: "high", lastSignal: "Payment momentum improved", lastSignalAt: "2d ago", topDriver: "Three on-time payments", modelAgreement: true, daysPastDue: 0, officer: "A. Gomez" },
  { id: "LP-10206", borrower: "Redwood Learning", segment: "Education", region: "West", exposure: 740_000, calibratedPd: 0.143, previousPd: 0.109, anomalyPercentile: 67, confidence: "medium", lastSignal: "Coverage ratio declined", lastSignalAt: "3d ago", topDriver: "Payment-to-income 28%", modelAgreement: true, daysPastDue: 0, officer: "S. Lewis" },
  { id: "LP-10739", borrower: "Verdant Home Supply", segment: "Retail", region: "Southeast", exposure: 1_340_000, calibratedPd: 0.087, previousPd: 0.096, anomalyPercentile: 52, confidence: "high", lastSignal: "Risk returned to baseline", lastSignalAt: "4d ago", topDriver: "Balance decay normalized", modelAgreement: true, daysPastDue: 0, officer: "T. Brooks" },
];

export const reviewLoans: LoanReview[] = rawLoans.map((loan) => {
  const withExpectedLoss = {
    ...loan,
    expectedLoss: expectedLoss(loan.calibratedPd, 0.45, loan.exposure),
  };

  return {
    ...withExpectedLoss,
    priority: calculatePriorityScore(withExpectedLoss),
  };
});

export const riskDistribution = [
  { band: "Low", loans: 1_126, exposure: 118.4, color: "var(--risk-low)" },
  { band: "Moderate", loans: 823, exposure: 125.4, color: "var(--risk-moderate)" },
  { band: "High", loans: 348, exposure: 34.2, color: "var(--risk-high)" },
  { band: "Critical", loans: 121, exposure: 8.4, color: "var(--risk-critical)" },
];
