"use client";

import {
  BadgeDollarSign,
  BellRing,
  Download,
  RefreshCw,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatMoneyCompact, percent } from "@/lib/format";
import type { LoanReview, PortfolioPoint, PortfolioSummary, QueueFilter } from "@/lib/types";
import { LoanDetailPanel } from "./loan-detail-panel";
import { MetricCard } from "./metric-card";
import { Navigation } from "./navigation";
import { ReviewQueue } from "./review-queue";
import { RiskMovementPanel } from "./risk-movement-panel";
import { RiskFieldVisual } from "./risk-field-visual";
import { RiskPressureStrip } from "./risk-pressure-strip";
import { RiskTrendChart } from "./risk-trend-chart";
import { TopContextBar } from "./top-context-bar";

interface DistributionItem {
  band: string;
  loans: number;
  exposure: number;
  color: string;
}

export function PortfolioCommandCenter({
  summary,
  trend,
  loans,
  distribution,
  source,
}: {
  summary: PortfolioSummary;
  trend: PortfolioPoint[];
  loans: LoanReview[];
  distribution: DistributionItem[];
  source: "demo" | "live";
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [selectedLoan, setSelectedLoan] = useState<LoanReview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
      } else if (event.key === "Escape" && selectedLoan) {
        setSelectedLoan(null);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selectedLoan]);

  const activateMetric = (nextFilter: QueueFilter) => {
    setFilter((current) => current === nextFilter ? "all" : nextFilter);
    document.getElementById("review-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const exportView = () => {
    const rows = loans.map((loan) => [loan.id, loan.borrower, loan.segment, loan.exposure, loan.calibratedPd, loan.anomalyPercentile]);
    const csv = [["Loan ID", "Borrower", "Segment", "Exposure (INR)", "Calibrated PD", "Anomaly percentile"], ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "loanpulse-review-queue.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Review queue exported as CSV.");
  };

  const refreshSignals = () => {
    setIsRefreshing(true);
    window.setTimeout(() => {
      setIsRefreshing(false);
      setNotice("Signals refreshed against the current demonstration snapshot.");
    }, 650);
  };

  return (
    <div className="app-shell">
      <Navigation />
      <div className="app-stage">
        <TopContextBar
          onQueryChange={setQuery}
          query={query}
          searchRef={searchRef}
          summary={summary}
        />

        <main className="dashboard-main">
          <div className="page-heading command-masthead">
            <div className="page-title-block">
              <div className="eyebrow-row">
                <span>Portfolio surveillance / 08.25.26</span>
                <span className="live-indicator"><i /> Surveillance active</span>
              </div>
              <h1>See the <em>signal</em>{" "}<br />before the loss.</h1>
              <p>Northstar portfolio · {summary.loanCount.toLocaleString("en-IN")} active loans under continuous review.</p>
            </div>
            <div className="masthead-visual-wrap">
              <RiskFieldVisual label="Northstar living risk field" value="37 review signals" />
              <div className="masthead-signal">
                <RiskPressureStrip points={trend} />
                <p><span>Review posture</span><strong>37</strong> loans require a human read today.</p>
              </div>
            </div>
            <div className="page-actions">
              <button className="secondary-button" onClick={exportView} type="button"><Download size={14} /> Export view</button>
              <button className="primary-button" disabled={isRefreshing} onClick={refreshSignals} type="button"><RefreshCw className={isRefreshing ? "is-spinning" : ""} size={14} /> {isRefreshing ? "Refreshing" : "Refresh signals"}</button>
            </div>
          </div>

          <div className="provenance-bar">
            <span><strong>Model</strong> {summary.modelVersion}</span>
            <span><strong>Data</strong> {summary.dataFreshness}</span>
            <span><strong>Health</strong> {percent.format(summary.dataHealth)}</span>
            <span className={`demo-disclosure${source === "live" ? " is-live" : ""}`}>{source === "live" ? "Live organization portfolio" : "Synthetic demonstration portfolio"}</span>
          </div>

          <section className="metric-grid" aria-label="Portfolio summary">
            <MetricCard
              delta="3.2%"
              detail="vs. prior month"
              direction="up"
              icon={WalletCards}
              label="Total exposure"
              tone="neutral"
              value={formatMoneyCompact(summary.totalExposure)}
            />
            <MetricCard
              delta="₹1.14L"
              detail="month-over-month"
              direction="up"
              icon={BadgeDollarSign}
              label="Expected loss"
              tone="danger"
              value={formatMoneyCompact(summary.expectedLoss)}
            />
            <MetricCard
              active={filter === "high-risk"}
              delta="8.7%"
              detail="14.9% of exposure"
              direction="up"
              filter="high-risk"
              icon={ShieldAlert}
              label="High-risk exposure"
              onActivate={activateMetric}
              tone="danger"
              value={formatMoneyCompact(summary.highRiskExposure)}
            />
            <MetricCard
              active={filter === "emerging"}
              delta="12"
              detail="since last review"
              direction="up"
              filter="emerging"
              icon={BellRing}
              label="New early warnings"
              onActivate={activateMetric}
              tone="warning"
              value={summary.newAlerts.toString()}
            />
          </section>

          <div className="analytics-grid">
            <RiskTrendChart data={trend} />
            <RiskMovementPanel distribution={distribution} />
          </div>

          <div id="review-queue">
            <ReviewQueue
              filter={filter}
              loans={loans}
              onFilterChange={setFilter}
              onSelectLoan={setSelectedLoan}
              query={query}
              selectedLoanId={selectedLoan?.id}
            />
          </div>

          <footer className="dashboard-footer">
            <span>LoanPulse AI · Internal surveillance workspace</span>
            <span>Expected loss uses PD × 45% assumed LGD × current exposure. Assumption is disclosed and editable in later phases.</span>
          </footer>
        </main>
      </div>

      <LoanDetailPanel loan={selectedLoan} onClose={() => setSelectedLoan(null)} />
      {notice ? <div className="action-toast" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} type="button">Dismiss</button></div> : null}
    </div>
  );
}
