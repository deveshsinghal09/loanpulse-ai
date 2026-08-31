import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoanDigitalTwin } from "@/components/loan-digital-twin";
import { demoLoanTwin } from "@/lib/loan-digital-twin-data";
import { reviewLoans } from "@/lib/demo-data";
import { getLoanTwin } from "@/lib/server/repository";

type LoanPageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return reviewLoans.map((loan) => ({ id: loan.id }));
}

export async function generateMetadata({ params }: LoanPageProps): Promise<Metadata> {
  const { id } = await params;
  const loan = demoLoanTwin(id);
  if (!loan) return { title: "Loan not found" };
  return { title: `${loan.borrower} · ${loan.id}` };
}

export default async function LoanPage({ params }: LoanPageProps) {
  const { id } = await params;
  const loan = await getLoanTwin(id);
  if (!loan) notFound();
  return <LoanDigitalTwin loan={loan} />;
}
