import "server-only";
import type { ScenarioInputs, ScenarioResult } from "@/lib/risk-time-machine";

export class MlServiceError extends Error {
  constructor(message: string, public status = 502) { super(message); this.name = "MlServiceError"; }
}

export async function checkMlService() {
  const baseUrl = process.env.ML_SERVICE_URL;
  const apiKey = process.env.ML_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) return { ok: false as const, latencyMs: 0 };
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/ready`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal, cache: "no-store" });
    return { ok: response.ok, latencyMs: Math.round(performance.now() - started) };
  } catch { return { ok: false as const, latencyMs: Math.round(performance.now() - started) }; }
  finally { clearTimeout(timeout); }
}

export async function evaluateMlScenario(loanId: string, scenario: ScenarioInputs, record: Record<string, unknown>): Promise<ScenarioResult> {
  const baseUrl = process.env.ML_SERVICE_URL;
  const apiKey = process.env.ML_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) throw new MlServiceError("The production inference service is not configured.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/scenario`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ loan_id: loanId, record, inputs: scenario }), signal: controller.signal, cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as ScenarioResult | { detail?: string } | null;
    if (!response.ok) throw new MlServiceError(response.status >= 500 ? "The inference service is unavailable." : "The inference service rejected the scenario.", response.status >= 500 ? 502 : 400);
    return payload as ScenarioResult;
  } catch (error) {
    if (error instanceof MlServiceError) throw error;
    throw new MlServiceError((error as Error).name === "AbortError" ? "The inference service timed out." : "The inference service could not be reached.");
  } finally { clearTimeout(timeout); }
}
