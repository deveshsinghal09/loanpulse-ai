import { describe, expect, it, vi } from "vitest";
import { buildEvidenceFallback, generateCopilotText } from "../lib/server/gemini";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Gemini copilot resilience", () => {
  it("retries temporary overloads and returns the recovered response", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { status: "UNAVAILABLE" } }, 503))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "Recovered" }] } }] }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await generateCopilotText({ apiKey: "test", prompt: "Review", primaryModel: "primary", fetchImpl, sleep });

    expect(result).toEqual({ ok: true, text: "Recovered", model: "primary" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("falls back after the primary model remains overloaded", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [{ text: "Fallback answer" }] } }] }));

    const result = await generateCopilotText({ apiKey: "test", prompt: "Review", primaryModel: "primary", fallbackModel: "fallback", fetchImpl, sleep: vi.fn().mockResolvedValue(undefined) });

    expect(result).toEqual({ ok: true, text: "Fallback answer", model: "fallback" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("does not retry invalid credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: { status: "PERMISSION_DENIED" } }, 403));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await generateCopilotText({ apiKey: "bad", prompt: "Review", primaryModel: "primary", fetchImpl, sleep });

    expect(result).toMatchObject({ ok: false, status: 403, retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("creates a transparent evidence fallback without inventing a decision", () => {
    const text = buildEvidenceFallback({
      borrower: "Aster Components",
      calibratedPd: 0.612,
      exposure: 2_460_000,
      expectedLoss: 677_000,
      anomalyPercentile: 98,
      modelAgreement: false,
    });

    expect(text).toContain("Aster Components");
    expect(text).toContain("61.2%");
    expect(text).toContain("₹24.6L");
    expect(text).toContain("human reviewer");
    expect(text).toContain("temporarily unavailable");
  });
});
