export type RiskBand = "Low" | "Moderate" | "High" | "Critical";

export type RiskTimePoint = {
  period: string;
  pd: number;
  rawPd: number;
  anomaly: number;
  warning: string;
  featureValues: Array<{ label: string; value: string }>;
  drivers: Array<{ label: string; value: number; direction: "adverse" | "protective" }>;
};

export type ScenarioInputs = {
  incomeDecline: number;
  dtiIncrease: number;
  rateShock: number;
  paymentBurden: number;
};

export type ScenarioResult = {
  pd: number;
  rawPd: number;
  expectedLoss: number;
  band: RiskBand;
  delta: number;
  drivers: Array<{ label: string; value: number }>;
};

export const riskTimeMachineLoan = {
  id: "LP-10482",
  borrower: "Aster Components",
  exposure: 2_460_000,
  lgd: 0.45,
  calibratedPd: 0.612,
  rawPd: 0.634,
  anomalyPercentile: 98,
  confidence: 0.87,
  modelDisagreement: 0.041,
  timeline: [
    {
      period: "Jan 26", pd: 0.172, rawPd: 0.181, anomaly: 63, warning: "No immediate policy action.",
      featureValues: [{ label: "Debt-service coverage", value: "1.18×" }, { label: "Utilization", value: "71%" }, { label: "Days past due", value: "0" }],
      drivers: [{ label: "Utilization", value: 1.1, direction: "adverse" }, { label: "Payment recency", value: 0.4, direction: "protective" }],
    },
    {
      period: "Feb 26", pd: 0.198, rawPd: 0.212, anomaly: 69, warning: "Watch opened after two late remittances.",
      featureValues: [{ label: "Debt-service coverage", value: "1.15×" }, { label: "Utilization", value: "74%" }, { label: "Days past due", value: "7" }],
      drivers: [{ label: "Days past due", value: 1.4, direction: "adverse" }, { label: "Utilization", value: 1.1, direction: "adverse" }],
    },
    {
      period: "Mar 26", pd: 0.224, rawPd: 0.239, anomaly: 72, warning: "Receivable concentration is increasing.",
      featureValues: [{ label: "Debt-service coverage", value: "1.12×" }, { label: "Utilization", value: "77%" }, { label: "Top customer", value: "38%" }],
      drivers: [{ label: "Invoice concentration", value: 1.6, direction: "adverse" }, { label: "Utilization", value: 1.2, direction: "adverse" }],
    },
    {
      period: "Apr 26", pd: 0.271, rawPd: 0.283, anomaly: 78, warning: "Covenant cushion narrowed to the review range.",
      featureValues: [{ label: "Debt-service coverage", value: "1.08×" }, { label: "Utilization", value: "81%" }, { label: "Top customer", value: "41%" }],
      drivers: [{ label: "Debt-service coverage", value: 2.4, direction: "adverse" }, { label: "Invoice concentration", value: 1.5, direction: "adverse" }],
    },
    {
      period: "May 26", pd: 0.298, rawPd: 0.317, anomaly: 82, warning: "One percentage point below the review threshold.",
      featureValues: [{ label: "Debt-service coverage", value: "1.05×" }, { label: "Utilization", value: "84%" }, { label: "Days past due", value: "12" }],
      drivers: [{ label: "Debt-service coverage", value: 2.0, direction: "adverse" }, { label: "Days past due", value: 1.3, direction: "adverse" }],
    },
    {
      period: "Jun 26", pd: 0.354, rawPd: 0.369, anomaly: 88, warning: "Review threshold crossed; covenant warning issued.",
      featureValues: [{ label: "Debt-service coverage", value: "1.01×" }, { label: "Utilization", value: "86%" }, { label: "Days past due", value: "16" }],
      drivers: [{ label: "Debt-service coverage", value: 3.3, direction: "adverse" }, { label: "Utilization", value: 1.8, direction: "adverse" }],
    },
    {
      period: "Jul 26", pd: 0.481, rawPd: 0.503, anomaly: 94, warning: "Material deterioration; reviewer assignment required.",
      featureValues: [{ label: "Debt-service coverage", value: "0.96×" }, { label: "Utilization", value: "88%" }, { label: "Days past due", value: "19" }],
      drivers: [{ label: "Debt-service coverage", value: 5.1, direction: "adverse" }, { label: "Invoice concentration", value: 2.5, direction: "adverse" }],
    },
    {
      period: "Aug 26", pd: 0.612, rawPd: 0.634, anomaly: 98, warning: "Critical review: updated collateral evidence is required.",
      featureValues: [{ label: "Debt-service coverage", value: "0.91×" }, { label: "Utilization", value: "89%" }, { label: "Days past due", value: "19" }, { label: "Invoice concentration", value: "46%" }],
      drivers: [{ label: "Debt-service coverage", value: 6.4, direction: "adverse" }, { label: "Revolver utilization", value: 3.8, direction: "adverse" }, { label: "Payment recency", value: 0.7, direction: "protective" }],
    },
  ] satisfies RiskTimePoint[],
};

const logit = (value: number) => Math.log(value / (1 - value));
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

export function riskBand(probability: number): RiskBand {
  if (probability >= 0.6) return "Critical";
  if (probability >= 0.4) return "High";
  if (probability >= 0.2) return "Moderate";
  return "Low";
}

export function evaluateScenario(inputs: ScenarioInputs): ScenarioResult {
  const effects = [
    { label: "Income decline", value: inputs.incomeDecline * 0.024 },
    { label: "DTI increase", value: inputs.dtiIncrease * 0.082 },
    { label: "Interest-rate shock", value: inputs.rateShock * 0.00145 },
    { label: "Payment burden", value: inputs.paymentBurden * 0.068 },
  ].filter((item) => item.value > 0.001).sort((a, b) => b.value - a.value);
  const scoreShift = effects.reduce((total, item) => total + item.value, 0);
  const pd = sigmoid(logit(riskTimeMachineLoan.calibratedPd) + scoreShift);
  const rawPd = Math.min(0.999, sigmoid(logit(riskTimeMachineLoan.rawPd) + scoreShift * 1.04));
  return {
    pd,
    rawPd,
    expectedLoss: pd * riskTimeMachineLoan.exposure * riskTimeMachineLoan.lgd,
    band: riskBand(pd),
    delta: pd - riskTimeMachineLoan.calibratedPd,
    drivers: effects.map((item) => ({ label: item.label, value: item.value * 100 })),
  };
}

export function findBreakingPoint(threshold: number) {
  const needed = Math.max(0, logit(threshold) - logit(riskTimeMachineLoan.calibratedPd));
  if (needed === 0) {
    return {
      available: true,
      alreadyBreached: true,
      threshold,
      message: `Current calibrated PD already exceeds the ${Math.round(threshold * 100)}% threshold.`,
    };
  }
  const candidates = [
    { label: "Income decline", amount: needed / 0.024, unit: "%", limit: 30, descriptor: "decline in annual income" },
    { label: "DTI increase", amount: needed / 0.082, unit: " pp", limit: 20, descriptor: "increase in debt-to-income" },
    { label: "Interest-rate shock", amount: needed / 0.00145, unit: " bp", limit: 500, descriptor: "increase in the applicable interest rate" },
    { label: "Payment burden", amount: needed / 0.068, unit: " pp", limit: 15, descriptor: "increase in payment burden" },
  ].filter((candidate) => candidate.amount <= candidate.limit);
  const best = candidates.sort((a, b) => (a.amount / a.limit) - (b.amount / b.limit))[0];
  if (!best) return { available: false, alreadyBreached: false, threshold, message: "No single eligible variable reaches this threshold inside the configured realistic ranges." };
  return {
    available: true,
    alreadyBreached: false,
    threshold,
    variable: best.label,
    value: Math.ceil(best.amount * 10) / 10,
    unit: best.unit,
    descriptor: best.descriptor,
  };
}
