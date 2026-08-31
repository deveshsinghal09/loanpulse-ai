export type RiskBand = "low" | "moderate" | "high" | "critical";
export type RiskTrend =
  | "improving"
  | "stable"
  | "slowly deteriorating"
  | "rapidly deteriorating";
export type ModelConfidence = "high" | "medium" | "low";
export type QueueFilter = "all" | "high-risk" | "emerging" | "anomalous";

export interface PortfolioPoint {
  period: string;
  label: string;
  calibratedPd: number;
  expectedLoss: number;
  highRiskExposure: number;
  alerts: number;
}

export interface LoanReview {
  id: string;
  borrower: string;
  segment: string;
  region: string;
  exposure: number;
  calibratedPd: number;
  previousPd: number;
  expectedLoss: number;
  anomalyPercentile: number;
  confidence: ModelConfidence;
  lastSignal: string;
  lastSignalAt: string;
  priority: number;
  topDriver: string;
  modelAgreement: boolean;
  daysPastDue: number;
  officer: string;
}

export interface PortfolioSummary {
  name: string;
  asOf: string;
  modelVersion: string;
  dataFreshness: string;
  loanCount: number;
  totalExposure: number;
  expectedLoss: number;
  highRiskExposure: number;
  newAlerts: number;
  averageCalibratedPd: number;
  dataHealth: number;
}
