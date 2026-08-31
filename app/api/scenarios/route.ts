import { AuthorizationError, requireActor } from "@/lib/server/auth";
import { logger, requestId } from "@/lib/server/logger";
import { saveScenario } from "@/lib/server/repository";
import { scenarioInputSchema } from "@/lib/server/validation";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const actor = await requireActor(["analyst", "reviewer", "admin"]);
    const parsed = scenarioInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Scenario values are outside the governed ranges.", issues: parsed.error.flatten().fieldErrors, requestId: id }, { status: 400 });
    const result = await saveScenario(actor, { ...parsed.data, requestId: id });
    logger.info("scenario.saved", { requestId: id, actorId: actor.id, loanId: parsed.data.loanId, persisted: result.persisted });
    return Response.json({ ...result, requestId: id }, { status: 201 });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return Response.json({ error: status === 500 ? "The scenario could not be saved." : (error as Error).message, requestId: id }, { status });
  }
}
