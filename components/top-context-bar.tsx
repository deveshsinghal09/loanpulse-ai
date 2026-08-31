"use client";

import { Bell, BriefcaseBusiness, ChevronDown, Command, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type RefObject } from "react";
import type { PortfolioSummary } from "@/lib/types";
import { AuthControls } from "./auth-controls";

const routeLabels: Array<[string, string]> = [
  ["/loans/", "Loan digital twin"],
  ["/early-warnings", "Early warnings"],
  ["/peer-intelligence", "Peer intelligence"],
  ["/data-health", "Data health"],
  ["/model-performance", "Model performance"],
  ["/scenario-lab", "Scenario lab"],
  ["/vintage-analysis", "Vintage analysis"],
  ["/reviewer-copilot", "Reviewer copilot"],
  ["/audit-trail", "Audit trail"],
  ["/controls", "Controls"],
  ["/system-status", "System status"],
  ["/loans", "Loan explorer"],
  ["/", "Command center"],
];

export function TopContextBar({
  summary,
  query,
  onQueryChange,
  searchRef,
}: {
  summary: PortfolioSummary;
  query: string;
  onQueryChange: (value: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const pathname = usePathname();
  const activeLabel = routeLabels.find(([route]) => route === "/" ? pathname === "/" : pathname.startsWith(route))?.[1] ?? "Workspace";

  return (
    <header className="topbar">
      <div className="portfolio-context">
        <div className="topbar-route" aria-label={`Current page: ${activeLabel}`}>
          <span><Command aria-hidden="true" size={14} /></span>
          <strong>{activeLabel}</strong>
        </div>
        <div className="topbar-menu-control">
          <button aria-expanded={portfolioOpen} aria-label={`Active portfolio: ${summary.name}`} className="context-button context-portfolio" onClick={() => setPortfolioOpen((current) => !current)} type="button">
            <BriefcaseBusiness aria-hidden="true" size={14} />
            <strong>{summary.name}</strong>
            <ChevronDown aria-hidden="true" size={13} />
          </button>
          {portfolioOpen ? <div className="topbar-popover portfolio-popover"><span>Active portfolio</span><strong>{summary.name}</strong><small>{summary.loanCount.toLocaleString("en-IN")} loans · as of 25 Aug 2026</small><Link href="/controls" onClick={() => setPortfolioOpen(false)}>View portfolio controls</Link></div> : null}
        </div>
      </div>

      <div className="topbar-actions">
        <label className="global-search">
          <Search aria-hidden="true" size={15} />
          <span className="sr-only">Search loans or borrowers</span>
          <input
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search loans or borrowers"
            ref={searchRef}
            type="search"
            value={query}
          />
          <kbd aria-hidden="true">⌘ K</kbd>
        </label>
        <Link className="icon-button" aria-label="Open alerts" href="/early-warnings">
          <Bell size={17} />
          <span className="notification-dot" />
        </Link>
        <Link className="copilot-button" href="/reviewer-copilot">
          <Sparkles aria-hidden="true" size={15} />
          Ask reviewer copilot
        </Link>
        <AuthControls />
      </div>
    </header>
  );
}
