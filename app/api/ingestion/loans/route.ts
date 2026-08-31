import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AuthorizationError, requireActor } from "@/lib/server/auth";
import { ingestLoanBatch, getServiceIngestionPrincipal, type IngestionPrincipal } from "@/lib/server/repository";
import { loanIngestionSchema } from "@/lib/server/validation";

export const runtime = "nodejs";

function matchesSecret(request: NextRequest) {
  const configured = process.env.INGESTION_API_KEY;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configured || !presented) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(presented);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function authorize(request: NextRequest): Promise<IngestionPrincipal> {
  if (matchesSecret(request)) {
    const principal = await getServiceIngestionPrincipal();
    if (!principal) throw new AuthorizationError(401, "The service organization is not configured");
    return principal;
  }
  const actor = await requireActor(["admin"]);
  return { organizationId: actor.organizationId, actorUserId: actor.demo ? null : actor.id, actorType: "human" };
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    if (process.env.APP_MODE !== "production") {
      return NextResponse.json({ error: "Dataset ingestion is available only in production mode." }, { status: 409 });
    }
    const principal = await authorize(request);
    const parsed = loanIngestionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ingestion payload", issues: parsed.error.flatten() }, { status: 400 });
    }
    const result = await ingestLoanBatch(principal, parsed.data, requestId);
    return NextResponse.json({ ...result, requestId }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Dataset ingestion failed", requestId }, { status: 500 });
  }
}
