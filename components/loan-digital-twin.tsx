"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileSearch,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LoanDigitalTwinData } from "@/lib/loan-digital-twin-data";
import { portfolioSummary } from "@/lib/demo-data";
import { money, percent, percentagePoints } from "@/lib/format";
import { Navigation } from "./navigation";
import { LoanRiskTrajectoryChart } from "./loan-risk-trajectory-chart";
import { TopContextBar } from "./top-context-bar";

const similarLoans = [
  { id: "LP-08814", borrower: "Vantage Tooling", similarity: "93%", pdAtMatch: "58.4%", outcome: "Restructured", time: "47 days" },
  { id: "LP-09137", borrower: "Northline Castings", similarity: "89%", pdAtMatch: "63.1%", outcome: "Cured", time: "76 days" },
  { id: "LP-07642", borrower: "Edison Fasteners", similarity: "86%", pdAtMatch: "55.7%", outcome: "Watch exit", time: "104 days" },
];

const facilityDetails = [
  ["Original balance", "₹32L"],
  ["Current exposure", "₹24.6L"],
  ["Available capacity", "₹3.52L"],
  ["Maturity", "Feb 18, 2028"],
  ["Pricing", "SOFR + 425 bp"],
  ["Collateral", "A/R + inventory"],
];

const auditEvents = [
  { time: "09:42", label: "PD v3.4 scoring completed", detail: "Calibrated PD moved 48.1% → 61.2%; confidence 87%.", actor: "LoanPulse model" },
  { time: "09:44", label: "Review escalated", detail: "Priority crossed the human-review threshold of 85.", actor: "Policy engine" },
  { time: "10:03", label: "Assigned to A. Rivera", detail: "Six-hour review SLA started.", actor: "J. Morgan" },
  { time: "10:16", label: "Servicing evidence reconciled", detail: "No source conflicts; one financial statement is 41 days old.", actor: "Data controls" },
];

function EvidenceState({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" }) {
  return (
    <div className="evidence-state">
      <span className={`evidence-state-dot is-${tone}`} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function LoanDigitalTwin({ loan }: { loan: LoanDigitalTwinData }) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"6M" | "12M">("12M");
  const [notice, setNotice] = useState<string | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState("heightened_monitoring");
  const [rationale, setRationale] = useState("Material PD deterioration is corroborated across current servicing and utilization evidence. Obtain updated collateral support before changing facility terms.");
  const [acknowledged, setAcknowledged] = useState(true);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const chartData = useMemo(
    () => period === "6M" ? loan.trajectory.slice(-6) : loan.trajectory,
    [loan.trajectory, period],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const confirmAction = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const submitDecision = async () => {
    if (submittingDecision) return;
    setSubmittingDecision(true);
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loanId: loan.id, outcome: decisionOutcome, rationale, acknowledged }) });
      const result = await response.json() as { error?: string; persisted?: boolean };
      if (!response.ok) throw new Error(result.error ?? "The review could not be recorded.");
      confirmAction(result.persisted ? "Review decision recorded in the immutable audit trail." : "Review validated in demo mode. Connect Neon to persist it.");
    } catch (error) { confirmAction((error as Error).message); }
    finally { setSubmittingDecision(false); }
  };

  const velocity = loan.calibratedPd - loan.previousPd;

  return (
    <div className="app-shell">
      <Navigation />
      <div className="app-stage">
        <TopContextBar summary={portfolioSummary} query={query} onQueryChange={setQuery} searchRef={searchRef} />

        <main className="twin-main">
          <nav className="twin-breadcrumb" aria-label="Breadcrumb">
            <Link href="/"><ArrowLeft size={13} /> Review queue</Link>
            <span>/</span>
            <span>{loan.id}</span>
          </nav>

          <header className="twin-identity">
            <div className="twin-title-group">
              <div className="twin-title-line">
                <h1>{loan.borrower}</h1>
                <span className="risk-status is-critical"><ShieldAlert size={12} /> Critical risk</span>
                <span className="sla-status"><Clock3 size={12} /> {loan.sla}</span>
              </div>
              <p><span className="mono">{loan.id}</span> · {loan.facility} · {loan.segment} · {loan.region}</p>
              <div className="twin-ownership">
                <span>Relationship owner <strong>{loan.owner}</strong></span>
                <span>Reviewer <strong>{loan.reviewer}</strong></span>
                <span>As of <strong>{loan.asOf}</strong></span>
              </div>
            </div>
            <div className="twin-actions">
              <button className="secondary-button" onClick={() => confirmAction("Evidence request drafted for Aster Components.")} type="button"><FileSearch size={14} /> Request evidence</button>
              <button className="secondary-button" onClick={() => confirmAction("Assignment controls opened for this review.")} type="button"><UserRoundPlus size={14} /> Reassign</button>
              <Link className="secondary-button" href={`/loans/${loan.id}/time-machine`}><Clock3 size={14} /> Risk Time Machine</Link>
              <button className="primary-button" onClick={() => document.getElementById("decision-workspace")?.scrollIntoView({ behavior: "smooth" })} type="button"><ClipboardCheck size={14} /> Record decision</button>
              <button className="icon-button" aria-label="More loan actions" type="button"><MoreHorizontal size={16} /></button>
            </div>
          </header>

          <div className="twin-provenance">
            <span><CheckCircle2 size={13} /> All core feeds reconciled</span>
            <span><strong>Model</strong> PD v3.4 · isotonic calibration</span>
            <span><strong>Scored</strong> 18 minutes ago</span>
            <span className="demo-disclosure">Synthetic demonstration borrower</span>
          </div>

          <section className="risk-spine" aria-label="Current loan risk summary">
            <div className="risk-spine-primary">
              <span>Calibrated probability of default</span>
              <div><strong>{percent.format(loan.calibratedPd)}</strong><span className="risk-spine-delta"><ArrowUpRight size={14} /> {percentagePoints(velocity)} in 30d</span></div>
              <small>Critical band · alert threshold 30.0%</small>
            </div>
            <div><span>Expected loss</span><strong>{money.format(loan.expectedLoss)}</strong><small>PD × 45% LGD × EAD</small></div>
            <div><span>Risk velocity</span><strong className="negative">Rapid</strong><small>+13.1 pp / 30d</small></div>
            <div><span>Peer anomaly</span><strong>P{loan.anomalyPercentile}</strong><small>Midwest industrial cohort</small></div>
            <div><span>Model confidence</span><strong>{percent.format(loan.confidence)}</strong><small>Primary + baseline agree</small></div>
          </section>

          <section className="twin-section what-changed">
            <div className="twin-section-heading">
              <div><span className="eyebrow">Evidence ledger</span><h2>What changed</h2><p>Ordered by contribution to the latest risk movement.</p></div>
              <span className="twin-section-meta"><BellRing size={13} /> 4 material changes since Jul 25</span>
            </div>
            <div className="change-ledger">
              {loan.changes.map((change) => (
                <article className={`change-row is-${change.tone}`} key={change.label}>
                  <span className="change-severity" aria-hidden="true" />
                  <div className="change-name"><strong>{change.label}</strong><span>{change.source} · {change.freshness}</span></div>
                  <div className="change-values"><span>{change.before}</span><ArrowRight size={13} /><strong>{change.after}</strong></div>
                  <span className={`change-impact${change.contribution.startsWith("−") ? " is-protective" : ""}`}>{change.contribution}</span>
                </article>
              ))}
            </div>
          </section>

          <div className="twin-analysis-grid">
            <section className="panel twin-chart-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Calibrated trajectory</span><h2>Risk has accelerated since June</h2><p>Monthly PD with model confidence range and review events.</p></div>
                <div className="period-toggle" aria-label="Chart period">
                  {(["6M", "12M"] as const).map((value) => <button aria-pressed={period === value} className={period === value ? "is-active" : ""} key={value} onClick={() => setPeriod(value)} type="button">{value}</button>)}
                </div>
              </div>
              <LoanRiskTrajectoryChart data={chartData} />
              <div className="twin-chart-caption"><span><i className="caption-line" /> Calibrated PD</span><span><i className="caption-band" /> Confidence range</span><span><i className="caption-threshold" /> Review threshold</span></div>
            </section>

            <aside className="panel evidence-health-panel">
              <div className="panel-header compact"><div><span className="eyebrow">Evidence health</span><h2>Decision readiness</h2></div><span className="readiness-score">82%</span></div>
              <div className="readiness-track"><span style={{ width: "82%" }} /></div>
              <div className="evidence-state-list">
                <EvidenceState label="Servicing ledger" value="Current" tone="good" />
                <EvidenceState label="Bank transactions" value="42m" tone="good" />
                <EvidenceState label="Borrower financials" value="41d" tone="warn" />
                <EvidenceState label="Collateral appraisal" value="Missing" tone="bad" />
                <EvidenceState label="Source contradictions" value="None" tone="good" />
              </div>
              <div className="evidence-callout"><AlertTriangle size={15} /><div><strong>One material gap</strong><span>Request an updated collateral appraisal before a limit increase or renewal decision.</span></div></div>
              <button className="text-button" type="button">View source lineage <ArrowRight size={13} /></button>
            </aside>
          </div>

          <section className="twin-section driver-section">
            <div className="twin-section-heading"><div><span className="eyebrow">Model interpretation</span><h2>Risk drivers</h2><p>Contribution to the 13.1 percentage-point increase in calibrated PD.</p></div><span className="model-agreement"><Check size={12} /> Models agree</span></div>
            <div className="driver-list">
              {loan.drivers.map((driver) => (
                <div className="driver-row" key={driver.label}>
                  <div className="driver-copy"><strong>{driver.label}</strong><span>{driver.detail}</span></div>
                  <div className="driver-bar"><span className={`is-${driver.direction}`} style={{ width: `${Math.max(12, driver.contribution / 6.4 * 100)}%` }} /></div>
                  <span className={`driver-value is-${driver.direction}`}>{driver.direction === "adverse" ? "+" : "−"}{driver.contribution.toFixed(1)} pp</span>
                </div>
              ))}
            </div>
            <p className="interpretation-note">Contributions explain the current model movement; they are not causal claims.</p>
          </section>

          <div className="twin-detail-grid">
            <section className="twin-section facility-section">
              <div className="twin-section-heading"><div><span className="eyebrow">Loan structure</span><h2>Facility and covenant state</h2></div><span className="exception-badge"><AlertTriangle size={12} /> 2 exceptions</span></div>
              <dl className="facility-definition-list">
                {facilityDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
              <div className="covenant-table">
                <div className="covenant-row covenant-header"><span>Covenant</span><span>Required</span><span>Actual</span><span>Status</span></div>
                <div className="covenant-row"><strong>Debt-service coverage</strong><span>≥ 1.15×</span><span className="negative">0.91×</span><span className="mini-status is-breach">Breach</span></div>
                <div className="covenant-row"><strong>Leverage ratio</strong><span>≤ 4.50×</span><span>4.38×</span><span className="mini-status is-watch">Watch</span></div>
                <div className="covenant-row"><strong>Minimum liquidity</strong><span>≥ ₹4L</span><span>₹5.18L</span><span className="mini-status is-pass">Pass</span></div>
              </div>
            </section>

            <section className="twin-section peer-section">
              <div className="twin-section-heading"><div><span className="eyebrow">Comparable outcomes</span><h2>Similar historical loans</h2><p>Nearest matches from the same policy and segment cohort.</p></div><span className="cohort-label">n = 184</span></div>
              <div className="peer-percentile-strip">
                <div className="peer-axis"><span>P0</span><span>P50</span><span>P90</span><span>P100</span></div>
                <div className="peer-track"><span className="peer-p50" /><span className="peer-p90" /><i style={{ left: `${loan.anomalyPercentile}%` }} /></div>
                <strong style={{ left: `calc(${loan.anomalyPercentile}% - 27px)` }}>Aster · P{loan.anomalyPercentile}</strong>
              </div>
              <div className="similar-table" role="table" aria-label="Similar historical loans">
                <div className="similar-row similar-header" role="row"><span>Loan</span><span>Match</span><span>PD</span><span>Outcome</span><span>Time</span></div>
                {similarLoans.map((item) => <div className="similar-row" role="row" key={item.id}><span><strong>{item.borrower}</strong><small className="mono">{item.id}</small></span><span>{item.similarity}</span><span>{item.pdAtMatch}</span><span>{item.outcome}</span><span>{item.time}</span></div>)}
              </div>
            </section>
          </div>

          <section className="twin-section scenario-section">
            <div className="twin-section-heading"><div><span className="eyebrow">Scenario studio</span><h2>Downside and remediation comparison</h2><p>Variables change; the decision policy and LGD assumption remain fixed.</p></div><button className="secondary-button" onClick={() => confirmAction("A custom scenario workspace is ready.")} type="button"><Sparkles size={14} /> Create scenario</button></div>
            <div className="scenario-grid">
              {loan.scenarios.map((scenario, index) => (
                <article className={`scenario-card${index === 0 ? " is-base" : scenario.name === "Remediation" ? " is-remediation" : ""}`} key={scenario.name}>
                  <div className="scenario-card-header"><strong>{scenario.name}</strong>{index === 0 ? <span>Observed</span> : null}</div>
                  <p>{scenario.assumption}</p>
                  <dl>
                    <div><dt>Calibrated PD</dt><dd>{percent.format(scenario.pd)}</dd></div>
                    <div><dt>Expected loss</dt><dd>{money.format(scenario.expectedLoss)}</dd></div>
                    <div><dt>Covenant headroom</dt><dd className={scenario.headroom < 0 ? "negative" : "positive"}>{scenario.headroom > 0 ? "+" : ""}{Math.round(scenario.headroom * 100)}%</dd></div>
                  </dl>
                  <div className="scenario-pd-track"><span style={{ width: `${scenario.pd * 100}%` }} /></div>
                </article>
              ))}
            </div>
          </section>

          <div className="decision-grid" id="decision-workspace">
            <section className="panel copilot-memo">
              <div className="memo-kicker"><Sparkles size={15} /><span>Reviewer copilot · structured recommendation</span><span>High confidence</span></div>
              <h2>Maintain the facility on heightened monitoring and request remediation within 10 business days.</h2>
              <p>The deterioration is material and confirmed across servicing, utilization, and borrower-ledger evidence. Immediate acceleration is not supported because liquidity remains above covenant minimum and a recent partial payment is protective.</p>
              <div className="memo-columns">
                <div><strong>Recommended controls</strong><ul><li>Freeze incremental draws above 90% utilization.</li><li>Request a 13-week cash-flow forecast and updated appraisal.</li><li>Re-score after the next scheduled payment.</li></ul></div>
                <div><strong>Evidence cited</strong><ul><li><Link2 size={12} /> Servicing ledger · Aug 25</li><li><Link2 size={12} /> Core banking · Aug 25</li><li><Link2 size={12} /> Borrower ERP · Aug 24</li></ul></div>
              </div>
              <div className="memo-footer"><span><BookOpenCheck size={13} /> Policy CR-7.2 checks passed</span><button className="secondary-button" onClick={() => confirmAction("Copilot recommendation copied into the review draft.")} type="button">Accept as draft</button></div>
            </section>

            <section className="panel reviewer-decision">
              <div className="panel-header compact"><div><span className="eyebrow">Human decision</span><h2>Record review outcome</h2></div><span className="required-label">Required</span></div>
              <label><span>Outcome</span><select className="decision-select" onChange={(event) => setDecisionOutcome(event.target.value)} value={decisionOutcome}><option value="heightened_monitoring">Heightened monitoring</option><option value="request_evidence">Request evidence</option><option value="maintain">Maintain current terms</option><option value="escalate">Escalate review</option><option value="exit_watch">Exit watch</option></select></label>
              <label><span>Reviewer rationale</span><textarea onChange={(event) => setRationale(event.target.value)} rows={5} value={rationale} /></label>
              <div className="attachment-row"><button type="button"><Paperclip size={13} /> Attach evidence</button><span>0 files</span></div>
              <label className="decision-check"><input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" /><span>I reviewed the cited evidence and model limitations.</span></label>
              <button className="primary-button decision-submit" disabled={!acknowledged || rationale.trim().length < 20 || submittingDecision} onClick={() => void submitDecision()} type="button"><Send size={14} /> {submittingDecision ? "Recording…" : "Submit decision"}</button>
            </section>
          </div>

          <section className="twin-section audit-section">
            <div className="twin-section-heading"><div><span className="eyebrow">Governance</span><h2>Audit timeline</h2><p>Model, data, assignment, and reviewer events are immutable in production.</p></div><button className="text-button" type="button">Open full audit trail <ArrowRight size={13} /></button></div>
            <div className="audit-timeline">
              {auditEvents.map((event) => <article key={`${event.time}-${event.label}`}><span className="audit-dot" /><time>{event.time}</time><div><strong>{event.label}</strong><p>{event.detail}</p></div><span className="audit-actor">{event.actor}</span></article>)}
            </div>
          </section>

          <footer className="dashboard-footer twin-footer"><span>LoanPulse AI · Internal surveillance workspace</span><span>Model interpretations and scenarios support human review; they are not lending decisions.</span></footer>
        </main>
      </div>

      {notice ? <div className="action-toast" role="status"><CheckCircle2 size={15} /><span>{notice}</span><button onClick={() => setNotice(null)} type="button">Dismiss</button></div> : null}
      <div className="mobile-decision-bar"><button className="secondary-button" onClick={() => confirmAction("Evidence request drafted for Aster Components.")} type="button"><MessageSquareText size={14} /> Evidence</button><button className="primary-button" onClick={() => document.getElementById("decision-workspace")?.scrollIntoView({ behavior: "smooth" })} type="button"><ClipboardCheck size={14} /> Record decision</button></div>
    </div>
  );
}
