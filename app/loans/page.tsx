import { LoanExplorer } from "@/components/loan-explorer";
import { getLoanReviews } from "@/lib/server/repository";

export const dynamic = "force-dynamic";
export default async function LoansPage() { return <LoanExplorer loans={await getLoanReviews()} />; }
