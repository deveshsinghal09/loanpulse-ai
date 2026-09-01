type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string; status?: string };
};

type GenerateOptions = {
  apiKey: string;
  prompt: string;
  primaryModel: string;
  fallbackModel?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

export type GeminiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; code: string; status: number; retryable: boolean; model: string };

type EvidenceFallbackInput = {
  borrower: string;
  calibratedPd: number;
  exposure: number;
  expectedLoss: number;
  anomalyPercentile: number;
  modelAgreement: boolean;
};

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function modelSequence(primaryModel: string, fallbackModel?: string) {
  return Array.from(new Set([primaryModel, fallbackModel].filter((model): model is string => Boolean(model))));
}

export function buildEvidenceFallback(input: EvidenceFallbackInput) {
  const pd = (input.calibratedPd * 100).toFixed(1);
  const exposure = (input.exposure / 100_000).toFixed(1);
  const loss = (input.expectedLoss / 100_000).toFixed(2);
  const agreement = input.modelAgreement ? "The primary and challenger models agree." : "The models materially disagree, so confidence should be treated cautiously.";

  return `Live Gemini generation is temporarily unavailable, so LoanPulse prepared this evidence-based fallback from the stored loan record.\n\n${input.borrower} currently has a calibrated probability of default of ${pd}%, exposure of ₹${exposure}L, expected loss of ₹${loss}L, and an anomaly percentile of P${input.anomalyPercentile}. ${agreement}\n\nReviewer priority: validate recent repayment behavior, updated cash-flow or income evidence, current leverage, and covenant compliance before changing facility terms. Re-run the stress scenario after new evidence is recorded.\n\nThis is advisory decision support based on recorded model outputs; a human reviewer must validate all material actions.`;
}

export async function generateCopilotText({
  apiKey,
  prompt,
  primaryModel,
  fallbackModel,
  fetchImpl = fetch,
  sleep = wait,
}: GenerateOptions): Promise<GeminiResult> {
  const models = modelSequence(primaryModel, fallbackModel);
  let lastFailure: Extract<GeminiResult, { ok: false }> = {
    ok: false,
    code: "provider_unavailable",
    status: 503,
    retryable: true,
    model: primaryModel,
  };

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
            }),
            signal: AbortSignal.timeout(20_000),
          },
        );
        const payload = (await response.json().catch(() => null)) as GeminiPayload | null;

        if (response.ok) {
          const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
          if (text) return { ok: true, text, model };
          return { ok: false, code: "empty_response", status: 502, retryable: false, model };
        }

        const retryable = RETRYABLE_STATUSES.has(response.status);
        lastFailure = {
          ok: false,
          code: payload?.error?.status?.toLowerCase() ?? `provider_${response.status}`,
          status: response.status,
          retryable,
          model,
        };
        if (!retryable) return lastFailure;
      } catch {
        lastFailure = { ok: false, code: "provider_network_error", status: 503, retryable: true, model };
      }

      if (attempt < 2) {
        const jitter = Math.floor(Math.random() * 250);
        await sleep(500 * 2 ** attempt + jitter);
      }
    }
  }

  return lastFailure;
}
