import { Navigation } from "@/components/navigation";
import { SystemStatus } from "@/components/system-status";
import { getSystemStatus } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function SystemStatusPage() {
  const status = await getSystemStatus();
  return <div className="app-shell"><Navigation /><div className="app-stage"><main className="dashboard-main system-status-main"><SystemStatus status={status} /></main></div></div>;
}
