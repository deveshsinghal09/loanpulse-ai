import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RiskTimeMachine } from "@/components/risk-time-machine";
import { riskTimeMachineLoan } from "@/lib/risk-time-machine";

type PageProps = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return [{ id: riskTimeMachineLoan.id }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: id === riskTimeMachineLoan.id ? `Risk Time Machine · ${riskTimeMachineLoan.borrower}` : "Loan not found" };
}

export default async function RiskTimeMachinePage({ params }: PageProps) {
  const { id } = await params;
  if (id !== riskTimeMachineLoan.id) notFound();
  return <RiskTimeMachine loan={riskTimeMachineLoan} />;
}
