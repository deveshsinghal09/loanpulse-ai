"use client";

import { ArrowRight, Check, CloudUpload, Database, FileJson2, Fingerprint, GitCommitHorizontal, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import type { DataHealthView } from "@/lib/server/repository";

function formatTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DataHealthConsole({ data }: { data: DataHealthView }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function importDataset() {
    if (!file) return inputRef.current?.click();
    setState("uploading");
    try {
      const body = JSON.parse(await file.text());
      const response = await fetch("/api/ingestion/loans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { accepted?: number; snapshots?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Import failed");
      setState("success");
      setMessage(`${result.accepted ?? 0} loans accepted · ${result.snapshots ?? 0} new risk snapshots`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The file could not be imported");
    }
  }

  return <section className="data-control-room">
    <header className="data-health-hero"><div><span className="eyebrow">Evidence pipeline · {data.source}</span><h1>Trust starts before the score.</h1><p>Validate a governed portfolio contract, write it to Neon, and preserve the intake event in the immutable audit chain.</p></div><div className="health-dial" style={{ "--health": `${Math.round(data.health * 100) * 3.6}deg` } as React.CSSProperties}><div><strong>{Math.round(data.health * 100)}%</strong><span>data health</span></div></div></header>
    <div className="data-health-stats"><article><Database size={16} /><span>Active facilities</span><strong>{data.activeLoans.toLocaleString("en-IN")}</strong><small>{data.connected ? "Neon system of record" : "Demonstration dataset"}</small></article><article><GitCommitHorizontal size={16} /><span>Source freshness</span><strong>{data.freshness}</strong><small>Latest accepted portfolio state</small></article><article><Fingerprint size={16} /><span>Last pipeline run</span><strong>{data.latestRun ? "Completed" : "Awaiting data"}</strong><small>{formatTime(data.latestRun)}</small></article></div>
    <section className="ingestion-studio"><div className="ingestion-copy"><span className="eyebrow">Controlled intake</span><h2>Bring a portfolio into surveillance</h2><p>The JSON contract is validated server-side. Duplicate loans are updated; identical snapshots are ignored, so retries stay safe.</p><div className="ingestion-flow" aria-label="Ingestion workflow"><span><FileJson2 size={15} /> Contract</span><ArrowRight size={13} /><span><Check size={15} /> Validate</span><ArrowRight size={13} /><span><Database size={15} /> Persist</span><ArrowRight size={13} /><span><ShieldCheck size={15} /> Audit</span></div></div><div className={`dataset-dropzone is-${state}`}><input accept="application/json,.json" hidden onChange={(event) => { setFile(event.target.files?.[0] ?? null); setState("idle"); setMessage(""); }} ref={inputRef} type="file" /><button aria-label="Choose JSON dataset" onClick={() => inputRef.current?.click()} type="button"><CloudUpload size={24} /><strong>{file ? file.name : "Choose a portfolio contract"}</strong><span>{file ? `${(file.size / 1024).toFixed(1)} KB · ready to validate` : "JSON · maximum 1,000 loans per request"}</span></button><button className="primary-button" disabled={state === "uploading"} onClick={importDataset} type="button">{state === "uploading" ? "Validating…" : file ? "Validate & import" : "Select dataset"}</button>{message ? <p role="status">{message}</p> : <small>{data.source === "demo" ? "Switch to production mode before importing data." : "Administrator or ingestion service credential required."}</small>}</div></section>
    <section className="ingestion-ledger"><header><div><span className="eyebrow">Run history</span><h2>Recent ingestion evidence</h2></div><span className={`connection-pill${data.connected ? " is-live" : ""}`}>{data.connected ? "Neon connected" : "Preview mode"}</span></header><div>{data.runs.length ? data.runs.map((run) => <article key={run.id}><i className={`run-state is-${run.status}`} /><div><strong>{run.source}</strong><span>{run.id}</span></div><p><strong>{run.accepted.toLocaleString("en-IN")}</strong><span>of {run.received.toLocaleString("en-IN")} accepted</span></p><time>{formatTime(run.completedAt ?? run.startedAt)}</time></article>) : <div className="empty-run-state">No ingestion runs yet. Import the first validated portfolio contract above.</div>}</div></section>
  </section>;
}
