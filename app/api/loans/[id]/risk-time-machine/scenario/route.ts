import { evaluateScenario, type ScenarioInputs } from "@/lib/risk-time-machine";
import { requireActor, AuthorizationError } from "@/lib/server/auth";
import { appMode } from "@/lib/server/config";
import { evaluateMlScenario, MlServiceError } from "@/lib/server/ml-service";
import { getLoanFeatureRecord } from "@/lib/server/repository";

export async function POST(request: Request, context: RouteContext<"/api/loans/[id]/risk-time-machine/scenario">) {
  try {
    const actor = await requireActor(["analyst", "reviewer", "admin"]);
    const { id } = await context.params;
    if (appMode() === "demo" && id !== "LP-10482") return Response.json({ error: "Loan not found" }, { status: 404 });
    const body = await request.json() as Partial<ScenarioInputs>;
    const fields: Array<keyof ScenarioInputs> = ["incomeDecline", "dtiIncrease", "rateShock", "paymentBurden"];
    const scenario = Object.fromEntries(fields.map((field) => [field, Number(body[field] ?? 0)])) as ScenarioInputs;
    const limits: Record<keyof ScenarioInputs, number> = { incomeDecline: 30, dtiIncrease: 20, rateShock: 500, paymentBurden: 15 };
    if (fields.some((field) => !Number.isFinite(scenario[field]) || scenario[field] < 0 || scenario[field] > limits[field])) return Response.json({ error: "Scenario inputs must be finite values inside the published control ranges" }, { status: 400 });
    if (appMode() === "production") {
      const record = await getLoanFeatureRecord(actor, id);
      if (!record) return Response.json({ error: "Loan features are unavailable for scenario scoring." }, { status: 404 });
      return Response.json(await evaluateMlScenario(id, scenario, record));
    }
    return Response.json(evaluateScenario(scenario));
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : error instanceof MlServiceError ? error.status : 500;
    return Response.json({ error: status === 500 ? "Scenario calculation failed." : (error as Error).message }, { status });
  }
}
