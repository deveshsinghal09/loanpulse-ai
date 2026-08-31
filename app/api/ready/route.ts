import { appMode } from "@/lib/server/config";
import { getSystemStatus } from "@/lib/server/repository";

export const dynamic = "force-dynamic";
export async function GET() {
  const status = await getSystemStatus();
  const ready = appMode() === "demo" || (status.databaseReachable && status.identity && status.mlServiceReachable);
  return Response.json({ status: ready ? "ready" : "not_ready", ...status }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
