"use client";

import { Bell, CalendarDays, ChevronDown, Command, Search, Sparkles } from "lucide-react";
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
  const [openMenu, setOpenMenu] = useState<"portfolio" | "date" | "profile" | null>(null);
  const pathname = usePathname();
  const activeLabel = routeLabels.find(([route]) => route === "/" ? pathname === "/" : pathname.startsWith(route))?.[1] ?? "Workspace";

  return (
    <header className="topbar">
      <div className="portfolio-context">
        <div className="topbar-route" aria-label={`Current page: ${activeLabel}`}>
          <span><Command aria-hidden="true" size={14} /></span>
          <div><small>LoanPulse</small><strong>{activeLabel}</strong></div>
        </div>
        <span aria-hidden="true" className="context-divider" />
        <div className="topbar-menu-control">
        <button aria-expanded={openMenu === "portfolio"} className="context-button context-portfolio" onClick={() => setOpenMenu((current) => current === "portfolio" ? null : "portfolio")} type="button">
          <span className="context-overline">Book</span>
          <strong>{summary.name}</strong>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
        {openMenu === "portfolio" ? <div className="topbar-popover portfolio-popover"><span>Active workspace</span><strong>{summary.name}</strong><small>{summary.loanCount.toLocaleString()} loans · synthetic demonstration</small><Link href="/controls" onClick={() => setOpenMenu(null)}>View portfolio controls</Link></div> : null}
        </div>
        <div className="topbar-menu-control">
        <button aria-expanded={openMenu === "date"} className="context-button context-date" onClick={() => setOpenMenu((current) => current === "date" ? null : "date")} type="button">
          <CalendarDays aria-hidden="true" size={15} />
          <span className="context-date-copy"><small>As of</small><strong>25 Aug 2026</strong></span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
        {openMenu === "date" ? <div className="topbar-popover date-popover"><span>Demonstration snapshot</span><strong>Aug 25, 2026 · 09:42 UTC</strong><small>Source feeds reconciled. Historical time travel is available inside each Loan Digital Twin.</small></div> : null}
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
