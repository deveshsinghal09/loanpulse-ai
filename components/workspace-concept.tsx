"use client";

import {
  Activity,
  ArrowRight,
  Check,
  CircleAlert,
  Database,
  Fingerprint,
  GitBranch,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

export type WorkspaceConceptKind =
  | "early-warnings"
  | "peer-intelligence"
  | "data-health"
  | "model-performance"
  | "scenario-lab"
  | "vintage-analysis"
  | "audit-trail"
  | "controls";

const conceptMeta: Record<WorkspaceConceptKind, { index: string; label: string; state: string }> = {
  "early-warnings": { index: "01", label: "Signal radar", state: "Live surveillance" },
  "peer-intelligence": { index: "02", label: "Cohort field", state: "184 comparable loans" },
  "data-health": { index: "03", label: "Evidence pipeline", state: "18 of 20 sources fresh" },
  "model-performance": { index: "04", label: "Calibration lab", state: "PD model v3.4" },
  "scenario-lab": { index: "05", label: "Stress chamber", state: "No source mutation" },
  "vintage-analysis": { index: "06", label: "Cohort ribbons", state: "Month-on-book view" },
  "audit-trail": { index: "07", label: "Immutable chronicle", state: "Write-verified" },
  controls: { index: "08", label: "Control matrix", state: "Human review enforced" },
};

const peerPoints = Array.from({ length: 26 }, (_, index) => ({
  left: `${8 + ((index * 31) % 82)}%`,
  top: `${13 + ((index * 47) % 70)}%`,
}));

function ConceptFrame({ children, kind }: { children: React.ReactNode; kind: WorkspaceConceptKind }) {
  const meta = conceptMeta[kind];
  return (
    <section className={`workspace-concept concept-${kind}`} aria-label={meta.label}>
      <div className="concept-chrome">
        <span><b>{meta.index}</b>{meta.label}</span>
        <span><i />{meta.state}</span>
      </div>
      {children}
    </section>
  );
}

function WarningRadar() {
  const signals = [
    { name: "Aster", value: "61.2%", className: "signal-aster" },
    { name: "Kestrel", value: "44.8%", className: "signal-kestrel" },
    { name: "Nova", value: "31.6%", className: "signal-nova" },
  ];
  return (
    <ConceptFrame kind="early-warnings">
      <div className="radar-stage">
        <div className="radar-rings" aria-hidden="true"><span /><span /><span /><i /></div>
        {signals.map((signal) => <div className={`radar-signal ${signal.className}`} key={signal.name}><b>{signal.name}</b><small>{signal.value}</small></div>)}
        <div className="radar-sweep" aria-hidden="true" />
        <div className="radar-caption"><Radar size={15} /><span><b>12</b> new signals</span><small>ranked by materiality</small></div>
      </div>
    </ConceptFrame>
  );
}

function PeerField() {
  return (
    <ConceptFrame kind="peer-intelligence">
      <div className="peer-field">
        <div className="peer-axis peer-axis-x"><span>Lower leverage</span><span>Higher leverage</span></div>
        <div className="peer-quadrant" aria-hidden="true" />
        {peerPoints.map((point, index) => <i className="peer-dot" key={`${point.left}-${point.top}`} style={{ left: point.left, top: point.top, opacity: .28 + (index % 5) * .12 }} />)}
        <div className="peer-selected"><span>Aster</span><b>P98</b></div>
        <div className="peer-legend"><span><i /> Cohort</span><span><i /> Selected loan</span></div>
      </div>
    </ConceptFrame>
  );
}

function DataPipeline() {
  return (
    <ConceptFrame kind="data-health">
      <div className="pipeline-stage">
        <div className="pipeline-source is-good"><Database size={16} /><span><b>Core ledger</b><small>42 min</small></span><Check size={14} /></div>
        <div className="pipeline-source is-warn"><Fingerprint size={16} /><span><b>Financials</b><small>41 days</small></span><CircleAlert size={14} /></div>
        <div className="pipeline-source is-good"><GitBranch size={16} /><span><b>Payment feed</b><small>8 min</small></span><Check size={14} /></div>
        <div className="pipeline-route"><span>3 feeds</span><ArrowRight aria-hidden="true" size={13} /></div>
        <div className="pipeline-core"><span>Evidence<br />graph</span><strong>94%</strong><small>reconciled</small></div>
        <div className="pipeline-stamp"><ShieldCheck size={14} /> Schema contracts intact</div>
      </div>
    </ConceptFrame>
  );
}

function CalibrationLab() {
  return (
    <ConceptFrame kind="model-performance">
      <div className="calibration-stage">
        <div className="calibration-copy"><span>Observed default rate</span><strong>2.7<small> pp</small></strong><p>Expected calibration error</p></div>
        <svg aria-label="Observed probability compared with perfect calibration" className="calibration-chart" role="img" viewBox="0 0 360 210">
          <line className="chart-grid" x1="28" x2="335" y1="178" y2="178" />
          <line className="chart-grid" x1="28" x2="28" y1="25" y2="178" />
          <line className="chart-reference" x1="28" x2="335" y1="178" y2="25" />
          <path className="chart-band" d="M28 170 C82 150 108 131 150 116 S250 65 335 35 L335 58 C258 80 217 103 155 132 S75 167 28 181 Z" />
          <path className="chart-line" d="M28 174 C83 151 111 135 154 124 S250 77 335 45" />
          {[{x:68,y:157},{x:125,y:136},{x:188,y:108},{x:249,y:80},{x:311,y:55}].map((p) => <circle className="chart-point" cx={p.x} cy={p.y} key={p.x} r="4" />)}
        </svg>
        <div className="calibration-legend"><span><i /> Isotonic calibrated</span><span><i /> Perfect calibration</span></div>
      </div>
    </ConceptFrame>
  );
}

function StressChamber() {
  const [stress, setStress] = useState(42);
  const scenarioPd = Math.min(92, 61.2 + stress * .17).toFixed(1);
  return (
    <ConceptFrame kind="scenario-lab">
      <div className="stress-stage">
        <div className="stress-readout">
          <span>Baseline</span><strong>61.2%</strong><i aria-hidden="true" /><span>Scenario</span><strong>{scenarioPd}%</strong>
        </div>
        <div className="stress-arc" style={{ "--stress": `${stress}%` } as React.CSSProperties}>
          <div><Activity size={18} /><strong>+{stress}</strong><small>stress index</small></div>
        </div>
        <label className="stress-control"><span>Composite borrower stress</span><input aria-label="Composite borrower stress" max="100" min="0" onInput={(event) => setStress(Number(event.currentTarget.value))} type="range" value={stress} /><small><span>Observed</span><span>Severe</span></small></label>
      </div>
    </ConceptFrame>
  );
}

function VintageRibbons() {
  return (
    <ConceptFrame kind="vintage-analysis">
      <div className="vintage-stage">
        <div className="vintage-y-label">Cumulative delinquency</div>
        <svg aria-label="Delinquency curves for three origination vintages" className="vintage-chart" role="img" viewBox="0 0 420 220">
          <line className="chart-grid" x1="28" x2="392" y1="184" y2="184" />
          <path className="vintage-path vintage-2024" d="M30 177 C86 169 104 158 150 151 S239 137 291 118 S357 102 391 96" />
          <path className="vintage-path vintage-2025" d="M30 177 C75 168 110 151 150 143 S232 118 287 104 S352 80 391 71" />
          <path className="vintage-path vintage-2026" d="M30 177 C68 161 96 139 145 125 S229 91 284 74 S350 47 391 39" />
        </svg>
        <div className="vintage-label label-2026"><b>2026</b><span>8.9%</span></div>
        <div className="vintage-label label-2025"><b>2025</b><span>7.7%</span></div>
        <div className="vintage-label label-2024"><b>2024</b><span>6.3%</span></div>
        <div className="vintage-x-label"><span>M+0</span><span>Month on book</span><span>M+18</span></div>
      </div>
    </ConceptFrame>
  );
}

function AuditChronicle() {
  return (
    <ConceptFrame kind="audit-trail">
      <div className="chronicle-stage">
        <div className="chronicle-summary">
          <div className="chronicle-date"><span>25</span><div><b>AUG</b><small>2026 · UTC</small></div></div>
          <div className="chronicle-proof"><LockKeyhole size={13} /> Hash chain verified</div>
        </div>
        <div className="chronicle-line" aria-hidden="true"><i /><i /><i /></div>
        <div className="chronicle-events">
          <article><header><time>09:42:16</time><em>Model</em></header><span><b>PD score changed</b><small>48.1% → 61.2%</small></span></article>
          <article><header><time>09:44:03</time><em>Policy</em></header><span><b>Review escalated</b><small>Priority threshold crossed</small></span></article>
          <article><header><time>10:03:21</time><em>Human</em></header><span><b>Reviewer assigned</b><small>A. Rivera · 6h SLA</small></span></article>
        </div>
      </div>
    </ConceptFrame>
  );
}

function ControlMatrix() {
  const [states, setStates] = useState([true, true, true]);
  const controls = [
    ["Critical risk escalation", "PD ≥ 60%"],
    ["Model disagreement hold", "Gap ≥ 15 pp"],
    ["Evidence freshness gate", "Age > 30 days"],
  ];
  const toggle = (index: number) => setStates((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));
  return (
    <ConceptFrame kind="controls">
      <div className="control-stage">
        <div className="control-head"><span>Policy</span><span>Threshold</span><span>State</span></div>
        {controls.map(([name, threshold], index) => <div className="control-row" key={name}><span><ShieldCheck size={15} /><b>{name}</b></span><code>{threshold}</code><button aria-checked={states[index]} aria-label={`${states[index] ? "Disable" : "Enable"} ${name}`} className={states[index] ? "is-on" : ""} onClick={() => toggle(index)} role="switch" type="button"><i /><span>{states[index] ? "On" : "Off"}</span></button></div>)}
        <div className="control-footer"><Sparkles size={13} /><span>Changes are local to this demonstration.</span></div>
      </div>
    </ConceptFrame>
  );
}

export function WorkspaceConcept({ kind }: { kind: WorkspaceConceptKind }) {
  switch (kind) {
    case "early-warnings": return <WarningRadar />;
    case "peer-intelligence": return <PeerField />;
    case "data-health": return <DataPipeline />;
    case "model-performance": return <CalibrationLab />;
    case "scenario-lab": return <StressChamber />;
    case "vintage-analysis": return <VintageRibbons />;
    case "audit-trail": return <AuditChronicle />;
    case "controls": return <ControlMatrix />;
  }
}
