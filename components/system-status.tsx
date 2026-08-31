import { Bot, CheckCircle2, CircleAlert, CircleDashed, Database, Fingerprint, ServerCog, ShieldCheck } from "lucide-react";
import Link from "next/link";

type Status = Awaited<ReturnType<typeof import("@/lib/server/repository")["getSystemStatus"]>>;
type ControlState = "ready" | "error" | "missing" | "optional";

const stateLabels: Record<ControlState, string> = {
  ready: "Operational",
  error: "Connection failed",
  missing: "Not connected",
  optional: "Optional",
};

function Control({ icon: Icon, label, state, detail }: { icon: typeof Database; label: string; state: ControlState; detail: string }) {
  const StateIcon = state === "ready" ? CheckCircle2 : state === "optional" ? CircleDashed : CircleAlert;
  return (
    <article className={`system-control is-${state}`}>
      <div className="system-control-icon"><Icon aria-hidden="true" size={17} /></div>
      <div className="system-control-copy">
        <span>{label}</span>
        <strong>{stateLabels[state]}</strong>
        <p>{detail}</p>
      </div>
      <div className="system-control-state"><StateIcon aria-hidden="true" size={14} /><span>{stateLabels[state]}</span></div>
    </article>
  );
}
export function SystemStatus({ status }: { status: Status }) {
  const productionReady = status.databaseReachable && status.identity && status.mlServiceReachable;
  const databaseState: ControlState = status.databaseReachable ? "ready" : status.database ? "error" : "missing";
  const mlState: ControlState = status.mlServiceReachable ? "ready" : status.mlService ? "error" : "missing";
  return <section className="system-status-board"><header><div><span className="eyebrow">Production control plane</span><h1>{productionReady ? "Systems ready for live review" : "Complete the production connection"}</h1><p>LoanPulse checks each dependency without exposing credentials or connection details.</p></div><div className={`readiness-orbit${productionReady ? " is-ready" : ""}`}><i /><strong>{productionReady ? "READY" : status.mode.toUpperCase()}</strong><small>{new Date(status.checkedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</small></div></header><div className="system-control-grid"><Control icon={Database} label="Neon data plane" state={databaseState} detail={status.databaseReachable ? `Connected · ${status.databaseLatencyMs} ms check` : status.database ? "Credentials found, but the database did not answer the readiness check." : "Add DATABASE_URL, then run the migration and seed commands."} /><Control icon={Fingerprint} label="Reviewer identity" state={status.identity ? "ready" : "missing"} detail={status.identity ? "Clerk session and role enforcement configured." : "Add the Clerk publishable and secret keys, then redeploy."} /><Control icon={ServerCog} label="ML inference service" state={mlState} detail={status.mlServiceReachable ? `Artifact loaded · ${status.mlServiceLatencyMs} ms check` : status.mlService ? "Service settings found, but the authenticated readiness check failed." : "Add the deployed service URL and API key."} /><Control icon={Bot} label="Reviewer copilot" state={status.copilot ? "ready" : "optional"} detail={status.copilot ? "Gemini server integration configured." : "Add GEMINI_API_KEY when advisory summaries are required."} /><Control icon={ShieldCheck} label="Immutable audit" state={status.databaseReachable ? "ready" : databaseState} detail={status.databaseReachable ? "Hash chain and mutation-blocking trigger available." : status.database ? "Waiting for the Neon connection before validating the audit chain." : "Audit persistence activates after Neon is connected."} /></div><div className="setup-ledger"><div><span>01</span><p><strong>Connect Neon</strong><small>Add pooled and direct URLs to <code>.env.local</code>.</small></p><code>npm run db:setup</code></div><div><span>02</span><p><strong>Connect identity</strong><small>Add Clerk keys and list administrator emails.</small></p><code>APP_MODE=production</code></div><div><span>03</span><p><strong>Deploy inference</strong><small>Build the ML container from the validated artifact.</small></p><code>docker compose up ml</code></div></div><footer><span>Readiness endpoint: <code>/api/ready</code></span><Link href="/controls">Review policy controls →</Link></footer></section>;
}
