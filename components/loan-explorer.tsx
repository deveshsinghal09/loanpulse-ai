"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { portfolioSummary } from "@/lib/demo-data";
import { formatMoneyCompact, percent } from "@/lib/format";
import type { LoanReview } from "@/lib/types";
import { Navigation } from "./navigation";
import { RiskFieldVisual } from "./risk-field-visual";
import { TopContextBar } from "./top-context-bar";

export function LoanExplorer({ loans }: { loans: LoanReview[] }) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const visibleLoans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return loans.filter((loan) => !normalized || `${loan.id} ${loan.borrower} ${loan.segment} ${loan.region}`.toLowerCase().includes(normalized));
  }, [loans, query]);
  return <div className="app-shell"><Navigation /><div className="app-stage"><TopContextBar onQueryChange={setQuery} query={query} searchRef={searchRef} summary={portfolioSummary} /><main className="dashboard-main workspace-main"><div className="workspace-heading workspace-hero is-loan-explorer"><div className="workspace-hero-copy"><span className="eyebrow">Portfolio inventory</span><h1>Loan explorer</h1><p>Search active facilities and move directly into the detailed review workspace.</p></div><RiskFieldVisual compact label="Portfolio inventory" value={`${visibleLoans.length} visible facilities`} /></div><label className="loan-explorer-search"><Search size={16} /><input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Search borrower, loan ID, segment, or region" value={query} /></label><section className="panel loan-explorer-list">{visibleLoans.map((loan) => <Link className="loan-explorer-row" href={`/loans/${loan.id}`} key={loan.id}><div><strong>{loan.borrower}</strong><span className="mono">{loan.id} · {loan.segment} · {loan.region}</span></div><span>{formatMoneyCompact(loan.exposure)}</span><span className={loan.calibratedPd >= .4 ? "negative mono" : "mono"}>{percent.format(loan.calibratedPd)}</span><span>{loan.topDriver}</span><ArrowRight size={16} /></Link>)}{visibleLoans.length === 0 ? <div className="workspace-empty">No active facilities match this search.</div> : null}</section><footer className="dashboard-footer"><span>LoanPulse AI · Loan explorer</span><span>Select a facility to review its evidence, risk trajectory, and decision workflow.</span></footer></main></div></div>;
}
