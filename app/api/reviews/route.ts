import { AuthorizationError, requireActor } from "@/lib/server/auth";
import { logger, requestId } from "@/lib/server/logger";
import { recordReview } from "@/lib/server/repository";
import { reviewInputSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  const id = requestId(request);
  const started = performance.now();
  try {
    const actor = await requireActor(["reviewer", "admin"]);
    const parsed = reviewInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Review fields are incomplete or invalid.", issues: parsed.error.flatten().fieldErrors, requestId: id }, { status: 400 });
    const result = await recordReview(actor, { ...parsed.data, requestId: id });
    logger.info("review.submitted", { requestId: id, actorId: actor.id, loanId: parsed.data.loanId, persisted: result.persisted, durationMs: Math.round(performance.now() - started) });
    return Response.json({ ...result, requestId: id }, { status: 201 });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    logger.error("review.submit_failed", { requestId: id, status, durationMs: Math.round(performance.now() - started) });
    return Response.json({ error: status === 500 ? "The review could not be recorded." : (error as Error).message, requestId: id }, { status });
  }
}
