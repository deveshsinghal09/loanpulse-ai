"use client";

import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  ChevronDown,
  CircleGauge,
  Database,
  FlaskConical,
  History,
  Gauge,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  ServerCog,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavigationItem {
  label: string;
  icon: typeof Activity;
  href?: string;
  count?: number;
}

const primaryItems = [
  { label: "Command center", icon: CircleGauge, href: "/" },
  { label: "Loan explorer", icon: Search, href: "/loans" },
  { label: "Early warnings", icon: Activity, href: "/early-warnings", count: 37 },
  { label: "Peer intelligence", icon: UsersRound, href: "/peer-intelligence" },
] satisfies NavigationItem[];

const intelligenceItems = [
  { label: "Data health", icon: Database, href: "/data-health" },
  { label: "Model performance", icon: Gauge, href: "/model-performance" },
  { label: "Scenario lab", icon: FlaskConical, href: "/scenario-lab" },
  { label: "Vintage analysis", icon: ChartNoAxesCombined, href: "/vintage-analysis" },
] satisfies NavigationItem[];

const governanceItems = [
  { label: "Reviewer copilot", icon: Bot, href: "/reviewer-copilot" },
  { label: "Audit trail", icon: History, href: "/audit-trail" },
  { label: "Controls", icon: SlidersHorizontal, href: "/controls" },
  { label: "System status", icon: ServerCog, href: "/system-status" },
] satisfies NavigationItem[];

function NavGroup({
  label,
  items,
  onNavigate,
  pathname,
}: {
  label: string;
  items: NavigationItem[];
  onNavigate: () => void;
  pathname: string;
}) {
  return (
    <div className="nav-group">
      <p className="nav-group-label">{label}</p>
      <div className="nav-list">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/"
            ? pathname === "/"
            : Boolean(item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
          const content = (
            <>
              <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.count ? <span className="nav-count">{item.count}</span> : null}
            </>
          );

          return item.href ? (
            <Link aria-current={active ? "page" : undefined} className={`nav-item${active ? " is-active" : ""}`} href={item.href} key={item.label} onClick={onNavigate} title={item.label}>{content}</Link>
          ) : (
            <button className="nav-item" key={item.label} onClick={onNavigate} type="button">{content}</button>
          );
        })}
      </div>
    </div>
  );
}

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      return next;
    });
  };

  return (
    <>
      <button
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        className="mobile-menu-button"
        onClick={() => setMobileOpen((value) => !value)}
        type="button"
      >
        {mobileOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      <aside className={`sidebar${mobileOpen ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Activity size={18} strokeWidth={2.2} />
          </div>
          <div>
            <p className="brand-name">LoanPulse</p>
            <p className="brand-edition">Risk intelligence</p>
          </div>
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="nav-collapse-button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <div className="workspace-control">
        <button aria-expanded={workspaceOpen} className="workspace-switcher" onClick={() => setWorkspaceOpen((value) => !value)} type="button">
          <span className="workspace-avatar">NV</span>
          <span>
            <strong>Northstar Ventures</strong>
            <small>Credit operations</small>
          </span>
          <ChevronDown aria-hidden="true" size={14} />
        </button>
        {workspaceOpen ? <div className="workspace-menu"><strong>Northstar Ventures</strong><span>Credit operations</span><button onClick={() => setWorkspaceOpen(false)} type="button">Keep current workspace</button></div> : null}
        </div>

        <nav aria-label="Primary navigation">
          <NavGroup label="Monitor" items={primaryItems} onNavigate={() => setMobileOpen(false)} pathname={pathname} />
          <NavGroup label="Intelligence" items={intelligenceItems} onNavigate={() => setMobileOpen(false)} pathname={pathname} />
          <NavGroup label="Governance" items={governanceItems} onNavigate={() => setMobileOpen(false)} pathname={pathname} />
        </nav>

        <div className="sidebar-status">
          <div className="sidebar-status-row">
            <span className="status-dot" aria-hidden="true" />
            <ShieldCheck aria-hidden="true" size={16} />
            <span>Decision controls active</span>
          </div>
          <p>Automatic decisions are withheld for low-confidence predictions.</p>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      ) : null}
    </>
  );
}
