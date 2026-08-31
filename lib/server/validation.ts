import { z } from "zod";

export const reviewInputSchema = z.object({
  loanId: z.string().min(3).max(80),
  outcome: z.enum(["heightened_monitoring", "request_evidence", "maintain", "escalate", "exit_watch"]),
  rationale: z.string().trim().min(20).max(5_000),
  acknowledged: z.literal(true),
});

export const scenarioInputSchema = z.object({
  loanId: z.string().min(3).max(80),
  name: z.string().trim().min(2).max(120),
  scenario: z.object({ incomeDecline: z.number().min(0).max(30), dtiIncrease: z.number().min(0).max(20), rateShock: z.number().min(0).max(500), paymentBurden: z.number().min(0).max(15) }),
  result: z.object({
    pd: z.number().min(0).max(1), rawPd: z.number().min(0).max(1), expectedLoss: z.number().nonnegative(),
    band: z.enum(["Low", "Moderate", "High", "Critical"]), delta: z.number().min(-1).max(1),
    drivers: z.array(z.object({ label: z.string().max(120), value: z.number() })).max(20),
  }),
});

const probability = z.number().min(0).max(1);

export const loanIngestionSchema = z.object({
  source: z.string().trim().min(2).max(120),
  portfolio: z.object({
    slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
    name: z.string().trim().min(2).max(160),
    asOf: z.string().datetime({ offset: true }),
    modelVersion: z.string().trim().min(1).max(80),
    dataHealth: probability.default(1),
  }),
  loans: z.array(z.object({
    externalId: z.string().trim().min(2).max(100),
    borrower: z.string().trim().min(1).max(240),
    segment: z.string().trim().min(1).max(120),
    region: z.string().trim().min(1).max(120),
    exposure: z.number().nonnegative().max(1_000_000_000_000),
    facility: z.string().trim().max(160).optional(),
    officer: z.string().trim().max(160).optional(),
    daysPastDue: z.number().int().min(0).max(100_000).default(0),
    attributes: z.record(z.string(), z.unknown()).default({}),
    observedAt: z.string().datetime({ offset: true }),
    calibratedPd: probability,
    rawPd: probability.optional(),
    previousPd: probability.optional(),
    expectedLoss: z.number().nonnegative().max(1_000_000_000_000),
    anomalyPercentile: z.number().int().min(0).max(100),
    confidence: z.enum(["high", "medium", "low"]),
    modelAgreement: z.boolean(),
    oodScore: probability.optional(),
    lastSignal: z.string().trim().min(1).max(500),
    topDriver: z.string().trim().min(1).max(240),
    drivers: z.array(z.object({ label: z.string().max(120), value: z.number() })).max(50).default([]),
  })).min(1).max(1_000),
});

export type LoanIngestionInput = z.infer<typeof loanIngestionSchema>;
