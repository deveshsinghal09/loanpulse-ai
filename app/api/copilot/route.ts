export const runtime = "nodejs";
import { AuthorizationError, requireActor } from "@/lib/server/auth";
import { getLoanReviews, recordCopilotRun } from "@/lib/server/repository";

type CopilotRequest = { message?: unknown };

export async function POST(request: Request) {
  const started = performance.now();
  let actor: Awaited<ReturnType<typeof requireActor>>;
  try { actor = await requireActor(["analyst", "reviewer", "admin"]); }
  catch (error) { const status = error instanceof AuthorizationError ? error.status : 500; return Response.json({ error: status === 500 ? "Authorization failed." : (error as Error).message }, { status }); }
  const body = await request.json().catch(() => null) as CopilotRequest | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4_000) return Response.json({ error: "Enter a question between 1 and 4,000 characters." }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return Response.json({ configured: false, error: "Gemini is not configured. Add GEMINI_API_KEY to .env.local and restart the server." }, { status: 503 });

  const loan = (await getLoanReviews()).find((item) => item.id === "LP-10482");
  const loanContext = loan ? `${loan.borrower} has ${(loan.calibratedPd * 100).toFixed(1)}% calibrated PD, ₹${(loan.exposure / 100_000).toFixed(1)}L exposure, expected loss ₹${(loan.expectedLoss / 100_000).toFixed(2)}L, P${loan.anomalyPercentile} anomaly percentile, and ${loan.modelAgreement ? "model agreement" : "material model disagreement"}.` : "The selected loan context is unavailable.";
  const systemContext = "You are LoanPulse Reviewer Copilot. Summarize supplied loan-risk context for trained human reviewers. Be concise, cite stated figures, distinguish model-based scenario analysis from observed evidence, do not make lending decisions, and require human validation for material actions.";
  const model = process.env.GEMINI_MODEL ?? "gemini-3.7-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${systemContext}\n\nLoan context: ${loanContext}\n\nReviewer question: ${message}` }] }], generationConfig: { maxOutputTokens: 600, temperature: 0.2 } }),
  });
  const payload = await response.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } } | null;
  if (!response.ok) { await recordCopilotRun(actor, { loanId: "LP-10482", prompt: message, status: "failed", durationMs: Math.round(performance.now() - started), model, errorCode: String(response.status) }); return Response.json({ error: payload?.error?.message ?? "Gemini could not complete this request." }, { status: response.status >= 500 ? 502 : response.status }); }
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) return Response.json({ error: "Gemini returned no readable text." }, { status: 502 });
  await recordCopilotRun(actor, { loanId: "LP-10482", prompt: message, response: text, status: "succeeded", durationMs: Math.round(performance.now() - started), model });
  return Response.json({ configured: true, text });
}
