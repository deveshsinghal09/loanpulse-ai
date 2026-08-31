export interface LoanTrajectoryPoint {
  period: string;
  pd: number;
  lower: number;
  upper: number;
  event?: string;
}

export interface LoanChangeEvent {
  label: string;
  before: string;
  after: string;
  contribution: string;
  source: string;
  freshness: string;
  tone: "critical" | "warning" | "neutral";
}

export interface RiskDriver {
  label: string;
  contribution: number;
  direction: "adverse" | "protective";
  detail: string;
}

export interface LoanScenario {
  name: string;
  pd: number;
  expectedLoss: number;
  headroom: number;
  assumption: string;
}

export interface LoanDigitalTwinData {
  id: string;
  borrower: string;
  facility: string;
  segment: string;
  region: string;
  exposure: number;
  calibratedPd: number;
  previousPd: number;
  expectedLoss: number;
  anomalyPercentile: number;
  confidence: number;
  priority: number;
  owner: string;
  reviewer: string;
  sla: string;
  asOf: string;
  changes: LoanChangeEvent[];
  trajectory: LoanTrajectoryPoint[];
  drivers: RiskDriver[];
  scenarios: LoanScenario[];
}

export const asterDigitalTwin: LoanDigitalTwinData = {
  id: "LP-10482",
  borrower: "Aster Components",
  facility: "Senior secured revolver · ₹32L limit",
  segment: "Industrial components",
  region: "Midwest",
  exposure: 2_460_000,
  calibratedPd: 0.612,
  previousPd: 0.481,
  expectedLoss: 677_484,
  anomalyPercentile: 98,
  confidence: 0.87,
  priority: 92,
  owner: "M. Chen",
  reviewer: "A. Rivera",
  sla: "Due in 6h",
  asOf: "Aug 25, 2026 · 09:42 UTC",
  changes: [
    {
      label: "Debt-service coverage",
      before: "1.18×",
      after: "0.91×",
      contribution: "+6.4 pp PD",
      source: "Servicing ledger",
      freshness: "2h ago",
      tone: "critical",
    },
    {
      label: "Revolver utilization",
      before: "71%",
      after: "89%",
      contribution: "+3.8 pp PD",
      source: "Core banking feed",
      freshness: "42m ago",
      tone: "warning",
    },
    {
      label: "Invoice concentration",
      before: "34%",
      after: "46%",
      contribution: "+2.1 pp PD",
      source: "Borrower ERP",
      freshness: "1d ago",
      tone: "warning",
    },
    {
      label: "Payment recency",
      before: "18 days",
      after: "9 days",
      contribution: "−0.7 pp PD",
      source: "Servicing ledger",
      freshness: "2h ago",
      tone: "neutral",
    },
  ],
  trajectory: [
    { period: "Sep 25", pd: 0.112, lower: 0.087, upper: 0.141 },
    { period: "Oct 25", pd: 0.128, lower: 0.098, upper: 0.159 },
    { period: "Nov 25", pd: 0.119, lower: 0.091, upper: 0.151 },
    { period: "Dec 25", pd: 0.146, lower: 0.112, upper: 0.184 },
    { period: "Jan 26", pd: 0.172, lower: 0.133, upper: 0.215 },
    { period: "Feb 26", pd: 0.198, lower: 0.154, upper: 0.246, event: "Watch opened" },
    { period: "Mar 26", pd: 0.224, lower: 0.176, upper: 0.278 },
    { period: "Apr 26", pd: 0.271, lower: 0.216, upper: 0.331 },
    { period: "May 26", pd: 0.298, lower: 0.237, upper: 0.365 },
    { period: "Jun 26", pd: 0.354, lower: 0.284, upper: 0.429, event: "Covenant warning" },
    { period: "Jul 26", pd: 0.481, lower: 0.397, upper: 0.565 },
    { period: "Aug 26", pd: 0.612, lower: 0.524, upper: 0.694, event: "Review escalated" },
  ],
  drivers: [
    { label: "Debt-service coverage", contribution: 6.4, direction: "adverse", detail: "0.91× is below the 1.05× watch threshold" },
    { label: "Revolver utilization", contribution: 3.8, direction: "adverse", detail: "89% utilization; peer median is 58%" },
    { label: "Invoice concentration", contribution: 2.1, direction: "adverse", detail: "Top customer now represents 46% of receivables" },
    { label: "Days past due", contribution: 1.5, direction: "adverse", detail: "19 DPD on the current installment" },
    { label: "Payment recency", contribution: 0.7, direction: "protective", detail: "A partial payment posted nine days ago" },
  ],
  scenarios: [
    { name: "Base", pd: 0.612, expectedLoss: 677_484, headroom: -0.14, assumption: "Current observed borrower state" },
    { name: "Mild downside", pd: 0.681, expectedLoss: 753_867, headroom: -0.22, assumption: "Revenue −8%; rates +75 bp" },
    { name: "Severe downside", pd: 0.793, expectedLoss: 877_851, headroom: -0.39, assumption: "Revenue −18%; top customer churn" },
    { name: "Remediation", pd: 0.438, expectedLoss: 484_866, headroom: 0.08, assumption: "₹6L paydown; utilization below 70%" },
  ],
};

export function demoLoanTwin(id: string): LoanDigitalTwinData | undefined {
  if (id === asterDigitalTwin.id) return asterDigitalTwin;
  const source = reviewLoans.find((loan) => loan.id === id);
  if (!source) return undefined;
  const currentPd = source.calibratedPd;
  const previousPd = source.previousPd;
  const expectedLoss = source.expectedLoss;
  const months = ["Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26", "Mar 26", "Apr 26", "May 26", "Jun 26", "Jul 26", "Aug 26"];
  const trajectory = months.map((period, index) => {
    const progress = (index + 1) / months.length;
    const pd = Math.max(0.01, previousPd + (currentPd - previousPd) * progress);
    return { period, pd, lower: Math.max(0.005, pd - 0.05), upper: Math.min(0.96, pd + 0.06), event: index === 11 ? source.lastSignal : undefined };
  });
  return {
    id: source.id,
    borrower: source.borrower,
    facility: `Term facility · ${formatCurrency(source.exposure)} current exposure`,
    segment: source.segment,
    region: source.region,
    exposure: source.exposure,
    calibratedPd: currentPd,
    previousPd,
    expectedLoss,
    anomalyPercentile: source.anomalyPercentile,
    confidence: source.confidence === "high" ? 0.88 : source.confidence === "medium" ? 0.72 : 0.56,
    priority: source.priority,
    owner: source.officer,
    reviewer: "Unassigned",
    sla: "Review in 1d",
    asOf: "Aug 25, 2026 · 09:42 UTC",
    changes: [{ label: source.lastSignal, before: percentValue(previousPd), after: percentValue(currentPd), contribution: `${currentPd >= previousPd ? "+" : ""}${((currentPd - previousPd) * 100).toFixed(1)} pp PD`, source: "Portfolio surveillance", freshness: source.lastSignalAt, tone: currentPd >= previousPd ? "warning" : "neutral" }],
    trajectory,
    drivers: [{ label: source.topDriver, contribution: Math.max(0.7, Math.abs(currentPd - previousPd) * 100), direction: currentPd >= previousPd ? "adverse" : "protective", detail: "Portfolio surveillance signal; validate against source evidence before acting." }],
    scenarios: [{ name: "Base", pd: currentPd, expectedLoss, headroom: 0, assumption: "Current observed borrower state" }, { name: "Mild downside", pd: Math.min(.95, currentPd + .08), expectedLoss: Math.min(.95, currentPd + .08) * source.exposure * .45, headroom: -.1, assumption: "Illustrative stress; reviewer validation required" }, { name: "Remediation", pd: Math.max(.01, currentPd - .09), expectedLoss: Math.max(.01, currentPd - .09) * source.exposure * .45, headroom: .08, assumption: "Illustrative remediation; not a lending decision" }],
  };
}

function percentValue(value: number) { return `${(value * 100).toFixed(1)}%`; }
function formatCurrency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }
import { reviewLoans } from "./demo-data";
