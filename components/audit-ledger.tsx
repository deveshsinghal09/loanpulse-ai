"use client";

import { CheckCircle2, Fingerprint, History, Search, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { portfolioSummary } from "@/lib/demo-data";
import type { AuditEventDTO } from "@/lib/server/repository";
import { Navigation } from "./navigation";
import { TopContextBar } from "./top-context-bar";

function readableEvent(value: string) { return value.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · "); }
function describePayload(payload: Record<string, unknown>) {
  return Object.entries(payload).slice(0, 3).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`).join(" · ") || "Event metadata recorded";
}

export function AuditLedger({ events, source }: { events: AuditEventDTO[]; source: "demo" | "live" }) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => events.filter((event) => `${event.eventType} ${event.entityId} ${event.actor}`.toLowerCase().includes(query.toLowerCase())), [events, query]);
  return <div className="app-shell"><Navigation /><div className="app-stage"><TopContextBar summary={portfolioSummary} query={query} onQueryChange={setQuery} searchRef={searchRef} /><main className="dashboard-main audit-ledger-main"><header className="audit-ledger-hero"><div><span className="eyebrow">Governance ledger</span><h1>Every material action leaves proof.</h1><p>Model, policy, AI, data, and human-review events share one append-only chronology.</p></div><div className="audit-chain-state"><Fingerprint size={20} /><span>Hash chain</span><strong>{source === "live" ? "Write verified" : "Demonstration"}</strong><small>{events.length} events in view</small></div></header><section className="audit-ledger-toolbar"><label><Search size={14} /><input aria-label="Filter audit events" onChange={(event) => setQuery(event.target.value)} placeholder="Filter by event, loan, or actor" value={query} /></label><span><ShieldCheck size={14} /> Updates and deletes blocked at database level</span></section><section className="audit-event-ledger" aria-label="Audit events">{visible.map((event, index) => <article key={event.id}><div className="audit-sequence"><span>{String(index + 1).padStart(3, "0")}</span><i /></div><time>{new Date(event.time).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" })}</time><div className="audit-event-copy"><strong>{readableEvent(event.eventType)}</strong><p>{describePayload(event.payload)}</p></div><div className="audit-entity"><span>{event.entityType}</span><strong>{event.entityId}</strong></div><div className="audit-actor"><span>Actor</span><strong>{event.actor}</strong></div><code title={event.hash}>{event.hash.slice(0, 10)}…</code><CheckCircle2 aria-label="Integrity seal recorded" size={15} /></article>)}{!visible.length ? <div className="audit-empty"><History size={20} /><strong>No matching events</strong><p>Change the audit filter to broaden the chronology.</p></div> : null}</section></main></div></div>;
}
