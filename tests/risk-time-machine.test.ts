import { describe, expect, it } from "vitest";
import { evaluateScenario, findBreakingPoint } from "../lib/risk-time-machine";

describe("Risk Time Machine scenario analysis", () => {
  it("keeps the governed DTI stress calculation available without remote inference", () => {
    const result = evaluateScenario({
      incomeDecline: 0,
      dtiIncrease: 5,
      rateShock: 0,
      paymentBurden: 0,
    });

    expect(result.pd).toBeCloseTo(0.704, 3);
    expect(result.expectedLoss).toBeCloseTo(779_000, -3);
    expect(result.band).toBe("Critical");
    expect(result.drivers[0]?.label).toBe("DTI increase");
  });

  it("finds the smallest governed move for a 70 percent threshold", () => {
    const result = findBreakingPoint(0.7);

    expect(result.available).toBe(true);
    expect(result.alreadyBreached).toBe(false);
    expect(result.variable).toBe("DTI increase");
    expect(result.value).toBe(4.8);
  });
});
