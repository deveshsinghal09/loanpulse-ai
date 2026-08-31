import { DataHealthConsole } from "@/components/data-health-console";
import { Navigation } from "@/components/navigation";
import { getDataHealthView } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function DataHealthPage() {
  const data = await getDataHealthView();
  return <div className="app-shell"><Navigation /><div className="app-stage"><main className="dashboard-main data-health-main"><DataHealthConsole data={data} /></main></div></div>;
}
