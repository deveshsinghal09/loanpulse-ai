"use client";

import { ArrowRight, CheckCircle2, CircleAlert, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { portfolioSummary, reviewLoans } from "@/lib/demo-data";
import { percent } from "@/lib/format";
import { Navigation } from "./navigation";
import { TopContextBar } from "./top-context-bar";
import { WorkspaceConcept, type WorkspaceConceptKind } from "./workspace-concept";

export type WorkspaceKind = WorkspaceConceptKind;

type WorkspaceDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string; note: string; tone?: "danger" | "success" | "neutral" }>;
  items: Array<{ title: string; detail: string; meta: string; tone?: "danger" | "success" | "neutral" }>;
  action?: { label: string; href: string };
};

const definitions: Record<WorkspaceKind, WorkspaceDefinition> = {
  "early-warnings": {
    eyebrow: "Surveillance queue", title: "Early warnings", description: "Signals are ranked by materiality, evidence freshness, and model confidence.",
    metrics: [{ label: "Open warnings", value: "37", note: "12 new since last review", tone: "danger" }, { label: "High-confidence", value: "29", note: "Ready for review", tone: "success" }, { label: "Escalated", value: "8", note: "Human action required", tone: "danger" }],
    items: reviewLoans.slice(0, 4).map((loan) => ({ title: loan.borrower, detail: loan.lastSignal, meta: `${percent.format(loan.calibratedPd)} PD · ${loan.lastSignalAt}`, tone: loan.calibratedPd >= .4 ? "danger" : "neutral" })),
    action: { label: "Open loan explorer", href: "/loans" },
  },
  "peer-intelligence": {
    eyebrow: "Cohort analysis", title: "Peer intelligence", description: "Compare each borrower against the segment and regional risk distributions that govern review context.",
    metrics: [{ label: "Comparable loans", value: "184", note: "Industrial Midwest cohort" }, { label: "Aster percentile", value: "P98", note: "Outlier across current inputs", tone: "danger" }, { label: "Cohort median PD", value: "11.8%", note: "Calibrated probability" }],
    items: [{ title: "Debt service coverage", detail: "Aster is 0.91× versus a peer median of 1.42×.", meta: "P96 adverse deviation", tone: "danger" }, { title: "Revolver utilization", detail: "89% versus a peer median of 58%.", meta: "P91 adverse deviation", tone: "danger" }, { title: "Payment recency", detail: "9 days since partial payment; peers average 17 days.", meta: "Protective signal", tone: "success" }],
    action: { label: "Open Aster Time Machine", href: "/loans/LP-10482/time-machine" },
  },
  "data-health": {
    eyebrow: "Data controls", title: "Data health", description: "Source completeness, freshness, and reconciliation status for the active surveillance portfolio.",
    metrics: [{ label: "Overall health", value: "94%", note: "Above 90% operating threshold", tone: "success" }, { label: "Fresh sources", value: "18 / 20", note: "Two feeds need attention" }, { label: "Schema alerts", value: "3", note: "No critical contract breaks", tone: "neutral" }],
    items: [{ title: "Core banking ledger", detail: "Reconciled at 09:01 UTC with no material source contradictions.", meta: "Fresh · 42 min", tone: "success" }, { title: "Borrower financials", detail: "41-day evidence age is outside the 30-day preferred freshness target.", meta: "Review requested", tone: "danger" }, { title: "Collateral appraisals", detail: "One document is missing for a critical-risk facility.", meta: "Evidence gap", tone: "danger" }],
  },
  "model-performance": {
    eyebrow: "Model governance", title: "Model performance", description: "Discrimination, calibration, and monitoring controls for the deployed PD model.",
    metrics: [{ label: "ROC AUC", value: "0.824", note: "Held-out validation", tone: "success" }, { label: "PR AUC", value: "0.461", note: "Class-imbalanced portfolio" }, { label: "Calibration error", value: "2.7 pp", note: "Within alert tolerance", tone: "success" }],
    items: [{ title: "Calibration", detail: "Isotonic recalibration reduced validation Brier score by 0.006.", meta: "Last validated Aug 21", tone: "success" }, { title: "Population drift", detail: "Utilization distribution is elevated but remains inside the monitoring limit.", meta: "PSI 0.12", tone: "neutral" }, { title: "Model disagreement", detail: "Primary and challenger disagree materially on 4.1% of active alerts.", meta: "Human review routed", tone: "danger" }],
  },
  "scenario-lab": {
    eyebrow: "Decision simulation", title: "Scenario lab", description: "Test borrower stress inputs without changing the source record or decision policy.",
    metrics: [{ label: "Selected facility", value: "Aster", note: "LP-10482" }, { label: "Observed PD", value: "61.2%", note: "Critical risk", tone: "danger" }, { label: "Simulation mode", value: "Live", note: "Debounced model scoring", tone: "success" }],
    items: [{ title: "Downside inputs", detail: "Income, DTI, interest-rate, and payment-burden shocks are eligible for scenario evaluation.", meta: "No source mutation" }, { title: "Breaking point", detail: "Searches the smallest governed single-variable movement that reaches a selected risk threshold.", meta: "Model-based analysis" }],
    action: { label: "Launch Risk Time Machine", href: "/loans/LP-10482/time-machine" },
  },
  "vintage-analysis": {
    eyebrow: "Portfolio analytics", title: "Vintage analysis", description: "Track portfolio performance by origination cohort and surface shifts before loss realization.",
    metrics: [{ label: "2026 vintage PD", value: "8.9%", note: "+1.2 pp vs. 2025", tone: "danger" }, { label: "2025 vintage PD", value: "7.7%", note: "Within observed range" }, { label: "Peak delinquency", value: "M+14", note: "Consumer lending cohort" }],
    items: [{ title: "2026 Q1", detail: "Early payment variance is higher than prior vintages; monitor at month-on-book 6.", meta: "Emerging watch", tone: "danger" }, { title: "2025 Q3", detail: "Delinquency trend has stabilized after the April remediation program.", meta: "Stabilizing", tone: "success" }, { title: "2024 Q4", detail: "Loss curve remains below forecast and supports current reserve assumptions.", meta: "Backtest pass", tone: "success" }],
  },
  "audit-trail": {
    eyebrow: "Governance ledger", title: "Audit trail", description: "Immutable model, data, assignment, and reviewer events for the active portfolio.",
    metrics: [{ label: "Events today", value: "1,284", note: "All event writes acknowledged", tone: "success" }, { label: "Open reviews", value: "37", note: "Within six-hour SLA" }, { label: "Control exceptions", value: "2", note: "Evidence freshness only", tone: "danger" }],
    items: [{ title: "09:42 · PD v3.4 scoring", detail: "Aster Components calibrated PD moved from 48.1% to 61.2%.", meta: "LoanPulse model" }, { title: "09:44 · Review escalated", detail: "Priority crossed the human-review threshold of 85.", meta: "Policy engine", tone: "danger" }, { title: "10:03 · Reviewer assigned", detail: "Six-hour review SLA started for A. Rivera.", meta: "J. Morgan", tone: "success" }],
  },
  controls: {
    eyebrow: "Policy controls", title: "Controls", description: "Configured thresholds that keep model output advisory and direct high-risk cases to human review.",
    metrics: [{ label: "Review threshold", value: "30%", note: "Calibrated PD" }, { label: "Auto-decision policy", value: "Off", note: "Human review required", tone: "success" }, { label: "OOD holdback", value: "P98.5", note: "Confidence withheld above limit", tone: "danger" }],
    items: [{ title: "Critical risk escalation", detail: "A calibrated PD of 60% or greater routes to the urgent review queue.", meta: "Enabled", tone: "success" }, { title: "Model disagreement", detail: "A primary/challenger probability gap of 15 pp requires reviewer confirmation.", meta: "Enabled", tone: "success" }, { title: "Evidence freshness", detail: "Financial statements older than 30 days are marked for source refresh.", meta: "Enabled", tone: "success" }],
  },
};

export function WorkspaceView({ kind }: { kind: WorkspaceKind }) {
  const [query, setQuery] = useState("");
  const [refreshed, setRefreshed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const definition = definitions[kind];
  return (
    <div className="app-shell">
      <Navigation />
      <div className="app-stage">
        <TopContextBar onQueryChange={setQuery} query={query} searchRef={searchRef} summary={portfolioSummary} />
        <main className="dashboard-main workspace-main">
          <div className={`workspace-heading workspace-hero is-${kind}`}>
            <div className="workspace-hero-copy"><span className="eyebrow">{definition.eyebrow}</span><h1>{definition.title}</h1><p>{definition.description}</p><div className="page-actions"><button className="secondary-button" onClick={() => setRefreshed(true)} type="button"><RefreshCw size={14} /> Refresh view</button>{definition.action ? <Link className="primary-button" href={definition.action.href}>{definition.action.label}<ArrowRight size={14} /></Link> : null}</div></div>
            <WorkspaceConcept kind={kind} />
          </div>
          {refreshed ? <div className="workspace-refresh" role="status"><CheckCircle2 size={14} /> View refreshed against the current demonstration snapshot.</div> : null}
          <section className="workspace-metrics" aria-label={`${definition.title} summary`}>
            {definition.metrics.map((metric) => <article className={`workspace-metric${metric.tone ? ` is-${metric.tone}` : ""}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
          </section>
          <section className="panel workspace-ledger">
            <div className="panel-header"><div><span className="eyebrow">Current state</span><h2>Decision-relevant signals</h2><p>Values are sourced from the synthetic demonstration dataset until connected to your production services.</p></div><ShieldCheck size={19} /></div>
            <div className="workspace-items">{definition.items.map((item) => <article className={`workspace-item${item.tone ? ` is-${item.tone}` : ""}`} key={item.title}><span>{item.tone === "danger" ? <CircleAlert size={15} /> : <Gauge size={15} />}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><small>{item.meta}</small></article>)}</div>
          </section>
          <footer className="dashboard-footer"><span>LoanPulse AI · {definition.title}</span><span>Demonstration values remain advisory until connected to verified production data.</span></footer>
        </main>
      </div>
    </div>
  );
}
