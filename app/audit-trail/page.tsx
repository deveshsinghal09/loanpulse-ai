import { AuditLedger } from "@/components/audit-ledger";
import { getAuditEvents } from "@/lib/server/repository";

export const dynamic = "force-dynamic";
export default async function AuditTrailPage() {
  const audit = await getAuditEvents();
  return <AuditLedger events={audit.events} source={audit.source} />;
}
