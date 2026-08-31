"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Gauge,
  LoaderCircle,
  Orbit,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { portfolioSummary } from "@/lib/demo-data";
import { formatMoneyCompact, money, percent, percentagePoints } from "@/lib/format";
import {
  evaluateScenario,
  findBreakingPoint,
  riskBand,
  type RiskTimePoint,
  type ScenarioInputs,
  type ScenarioResult,
} from "@/lib/risk-time-machine";
import { Navigation } from "./navigation";
import { TopContextBar } from "./top-context-bar";

type RiskTimeMachineLoan = {
  id: string;
  borrower: string;
  exposure: number;
  lgd: number;
  calibratedPd: number;
  rawPd: number;
  anomalyPercentile: number;
  confidence: number;
  modelDisagreement: number;
  timeline: RiskTimePoint[];
};

const initialScenario: ScenarioInputs = { incomeDecline: 0, dtiIncrease: 0, rateShock: 0, paymentBurden: 0 };

function TimeMachineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RiskTimePoint }> }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip time-machine-tooltip">
      <p>{point.period} snapshot</p>
      <dl>
        <div><dt>Calibrated PD</dt><dd>{percent.format(point.pd)}</dd></div>
        <div><dt>Anomaly percentile</dt><dd>P{point.anomaly}</dd></div>
        <div><dt>State</dt><dd>{riskBand(point.pd)}</dd></div>
      </dl>
    </div>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: string; detail: string; tone?: "neutral" | "risk" | "good" }) {
  return <div className={`time-machine-metric is-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function ScenarioSlider({ label, value, max, unit, onChange, hint }: {
  label: string; value: number; max: number; unit: string; hint: string; onChange: (value: number) => void;
}) {
  return (
    <label className="scenario-control">
      <span><strong>{label}</strong><small>{hint}</small><output>{value}{unit}</output></span>
      <input aria-label={label} max={max} min="0" onInput={(event) => onChange(Number(event.currentTarget.value))} step={unit === " bp" ? 25 : 1} type="range" value={value} />
    </label>
  );
}

export function RiskTimeMachine({ loan }: { loan: RiskTimeMachineLoan }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(loan.timeline.length - 1);
  const [scenario, setScenario] = useState<ScenarioInputs>(initialScenario);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult>(() => evaluateScenario(initialScenario));
  const [scenarioState, setScenarioState] = useState<"ready" | "updating" | "error">("ready");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [threshold, setThreshold] = useState(0.7);
  const searchRef = useRef<HTMLInputElement>(null);
  const shouldRequestScenario = useRef(false);
  const selected = loan.timeline[selectedIndex];
  const current = loan.timeline.at(-1)!;
  const previous = loan.timeline.at(-2)!;
  const twoPeriodsAgo = loan.timeline.at(-3)!;
  const velocity = current.pd - previous.pd;
  const acceleration = velocity - (previous.pd - twoPeriodsAgo.pd);
  const expectedLoss = loan.calibratedPd * loan.exposure * loan.lgd;
  const breakingPoint = useMemo(() => findBreakingPoint(threshold), [threshold]);
  const hasScenario = Object.values(scenario).some(Boolean);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!shouldRequestScenario.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/loans/${loan.id}/risk-time-machine/scenario`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenario),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Scenario calculation failed");
        setScenarioResult(await response.json() as ScenarioResult);
        setScenarioState("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setScenarioState("error");
      }
    }, 260);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [loan.id, scenario]);

  const setScenarioValue = (key: keyof ScenarioInputs, value: number) => {
    shouldRequestScenario.current = true;
    setScenarioState("updating");
    setScenario((currentScenario) => ({ ...currentScenario, [key]: value }));
  };
  const resetScenario = () => {
    shouldRequestScenario.current = true;
    setScenarioState("updating");
    setScenario(initialScenario);
  };
  const persistScenario = async () => {
    setSaveState("saving");
    try {
      const response = await fetch("/api/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loanId: loan.id, name: `Stress scenario ${new Date().toLocaleDateString()}`, scenario, result: scenarioResult }) });
      if (!response.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch { setSaveState("error"); }
  };

  return (
    <div className="app-shell">
      <Navigation />
      <div className="app-stage">
        <TopContextBar summary={portfolioSummary} query={query} onQueryChange={setQuery} searchRef={searchRef} />
        <main className="time-machine-main">
          <nav className="twin-breadcrumb" aria-label="Breadcrumb"><Link href={`/loans/${loan.id}`}><ArrowLeft size={13} /> Loan Digital Twin</Link><span>/</span><span>Risk Time Machine</span></nav>

          <header className="time-machine-heading">
            <div>
              <div className="time-machine-kicker"><Orbit size={15} /> Signature analysis</div>
              <h1>Risk Time Machine</h1>
              <p><strong>{loan.borrower}</strong> <span className="mono">{loan.id}</span> · trace the story, test the stress, locate the breach.</p>
            </div>
            <div className="time-machine-live"><span><i /> Scenario engine</span><small>Model-based simulation · not a lending decision</small></div>
          </header>

          <section className="time-machine-journey" aria-label="Risk Time Machine analysis">
            <div className="journey-rail" aria-hidden="true"><i /><i /><i /><i /></div>
            <section className="time-machine-stage past-stage" aria-labelledby="past-heading">
              <div className="stage-label"><span>Past</span><i /> <small>What changed?</small></div>
              <div className="past-grid">
                <div className="risk-trace-panel">
                  <div className="stage-heading"><div><h2 id="past-heading">The risk trace</h2><p>Each observation keeps its model context; selecting one rehydrates the evidence at that time.</p></div><span className="trace-range">Jan → Aug 2026</span></div>
                  <div className="risk-trace-chart" aria-label="Chronological probability of default chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={loan.timeline} margin={{ top: 14, right: 12, left: -14, bottom: 0 }}>
                        <defs><linearGradient id="riskTraceFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d55a43" stopOpacity={0.20} /><stop offset="100%" stopColor="#d55a43" stopOpacity={0.01} /></linearGradient></defs>
                        <CartesianGrid stroke="#e7eaee" strokeDasharray="2 4" vertical={false} />
                        <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "#778397", fontSize: 9 }} />
                        <YAxis axisLine={false} domain={[0, 0.8]} tickFormatter={(value) => `${Math.round(value * 100)}%`} tickLine={false} tick={{ fill: "#778397", fontSize: 9 }} ticks={[0, 0.2, 0.4, 0.6, 0.8]} />
                        <Tooltip content={<TimeMachineTooltip />} cursor={{ stroke: "#9ba6b7", strokeDasharray: "3 3" }} />
                        <ReferenceLine label={{ value: "Review 30%", fill: "#9b681c", fontSize: 9, position: "insideTopLeft" }} stroke="#c78318" strokeDasharray="4 4" y={0.3} />
                        <Area dataKey="pd" fill="url(#riskTraceFill)" stroke="none" type="linear" />
                        <Line activeDot={{ r: 5, strokeWidth: 2 }} dataKey="pd" dot={{ r: 2.5, fill: "#fff", stroke: "#c43d32", strokeWidth: 1.8 }} isAnimationActive={false} stroke="#c43d32" strokeWidth={2.4} type="linear" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="trace-scrubber" role="tablist" aria-label="Select an observation point">
                    {loan.timeline.map((point, index) => <button aria-selected={selectedIndex === index} className={selectedIndex === index ? "is-selected" : ""} key={point.period} onClick={() => setSelectedIndex(index)} role="tab" type="button"><span>{point.period}</span><strong>{percent.format(point.pd)}</strong></button>)}
                  </div>
                </div>
                <aside className="snapshot-inspector" aria-live="polite">
                  <div className="snapshot-head"><span>Selected snapshot</span><strong>{selected.period}</strong></div>
                  <div className="snapshot-score"><span>Calibrated PD</span><strong>{percent.format(selected.pd)}</strong><small>{riskBand(selected.pd)} band · raw {percent.format(selected.rawPd)}</small></div>
                  <p className="snapshot-warning"><AlertTriangle size={14} /> {selected.warning}</p>
                  <div className="snapshot-facts">{selected.featureValues.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
                  <div className="snapshot-driver-list"><span>SHAP movement drivers</span>{selected.drivers.map((driver) => <div key={driver.label}><i className={driver.direction} /><strong>{driver.label}</strong><small className={driver.direction}>{driver.direction === "adverse" ? "+" : "−"}{driver.value.toFixed(1)} pp</small></div>)}</div>
                  <div className="snapshot-anomaly"><Gauge size={14} /><span>Anomaly percentile</span><strong>P{selected.anomaly}</strong></div>
                </aside>
              </div>
            </section>

            <section className="time-machine-stage present-stage" aria-labelledby="present-heading">
              <div className="stage-label"><span>Present</span><i /> <small>What is the state now?</small></div>
              <div className="present-board">
                <div className="present-hero"><span>Current calibrated PD</span><strong>{percent.format(loan.calibratedPd)}</strong><p><ArrowUpRight size={14} /> {percentagePoints(velocity)} since July · <em>{riskBand(loan.calibratedPd)} risk</em></p></div>
                <Metric label="Uncalibrated PD" value={percent.format(loan.rawPd)} detail="Raw model probability" />
                <Metric label="Risk velocity" value={`${percentagePoints(velocity)}/mo`} detail={`Acceleration ${percentagePoints(acceleration)}`} tone="risk" />
                <Metric label="Anomaly percentile" value={`P${loan.anomalyPercentile}`} detail="Midwest industrial cohort" tone="risk" />
                <Metric label="Expected loss" value={formatMoneyCompact(expectedLoss)} detail="PD × 45% LGD × EAD" tone="risk" />
                <Metric label="Model confidence" value={percent.format(loan.confidence)} detail={`Disagreement ${percentagePoints(loan.modelDisagreement)}`} tone="good" />
              </div>
            </section>

            <section className="time-machine-stage future-stage" aria-labelledby="future-heading">
              <div className="stage-label"><span>Future</span><i /> <small>What happens under stress?</small></div>
              <div className="future-grid">
                <div className="scenario-workbench">
                  <div className="stage-heading"><div><h2 id="future-heading">Stress the observed state</h2><p>Adjust eligible borrower inputs; the scenario is scored after a 260 ms debounce.</p></div><span className={`scenario-state is-${scenarioState}`}>{scenarioState === "updating" ? <LoaderCircle size={13} /> : <CheckCircle2 size={13} />}{scenarioState === "error" ? "Calculation unavailable" : scenarioState === "updating" ? "Updating model" : "Model current"}</span></div>
                  <div className="scenario-controls">
                    <ScenarioSlider hint="Revenue or earnings pressure" label="Income decline" max={30} onChange={(value) => setScenarioValue("incomeDecline", value)} unit="%" value={scenario.incomeDecline} />
                    <ScenarioSlider hint="Change from current DTI" label="DTI increase" max={20} onChange={(value) => setScenarioValue("dtiIncrease", value)} unit=" pp" value={scenario.dtiIncrease} />
                    <ScenarioSlider hint="Increase to applicable rate" label="Interest-rate shock" max={500} onChange={(value) => setScenarioValue("rateShock", value)} unit=" bp" value={scenario.rateShock} />
                    <ScenarioSlider hint="Increase in income consumed" label="Payment burden" max={15} onChange={(value) => setScenarioValue("paymentBurden", value)} unit=" pp" value={scenario.paymentBurden} />
                  </div>
                  <button className="reset-scenario" disabled={!hasScenario} onClick={resetScenario} type="button">Reset to observed state</button>
                </div>
                <aside className="scenario-outcome">
                  <div className="scenario-compare-heading"><span>Observed</span><ArrowRight size={15} /><strong>Scenario</strong></div>
                  <div className="scenario-pd-comparison"><div><span>PD</span><strong>{percent.format(loan.calibratedPd)}</strong></div><div className="scenario-arrow"><ChevronRight size={18} /></div><div><span>PD</span><strong>{percent.format(scenarioResult.pd)}</strong><small className={scenarioResult.delta > 0 ? "negative" : "positive"}>{percentagePoints(scenarioResult.delta)}</small></div></div>
                  <div className="scenario-loss-row"><span>Expected loss</span><strong>{money.format(scenarioResult.expectedLoss)}</strong></div>
                  <div className="scenario-band-row"><span>Risk transition</span><div><b className={`risk-pill is-${riskBand(loan.calibratedPd).toLowerCase()}`}>{riskBand(loan.calibratedPd)}</b><ArrowRight size={12} /><b className={`risk-pill is-${scenarioResult.band.toLowerCase()}`}>{scenarioResult.band}</b></div></div>
                  <div className="scenario-driver-summary"><span>Major scenario drivers</span>{scenarioResult.drivers.length ? scenarioResult.drivers.slice(0, 3).map((driver) => <div key={driver.label}><strong>{driver.label}</strong><small>+{driver.value.toFixed(1)} risk-score pts</small></div>) : <p>No stressed variables. This is the observed state.</p>}</div>
                  <button className="scenario-save-button" disabled={!hasScenario || scenarioState !== "ready" || saveState === "saving"} onClick={() => void persistScenario()} type="button">{saveState === "saving" ? "Saving scenario…" : saveState === "saved" ? "Scenario saved" : saveState === "error" ? "Retry save" : "Save governed scenario"}</button>
                </aside>
              </div>
            </section>

            <section className="time-machine-stage breaking-stage" aria-labelledby="breaking-heading">
              <div className="stage-label"><span>Breaking point</span><i /> <small>What crosses the line?</small></div>
              <div className="breaking-board">
                <div>
                  <div className="stage-heading"><div><h2 id="breaking-heading">Locate the smallest realistic breach</h2><p>Searches one eligible input at a time within model-governed limits. This is scenario analysis, not a causal prediction.</p></div></div>
                  <div className="threshold-picker" aria-label="Risk threshold">
                    <span>Risk threshold</span>{[0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((value) => <button aria-pressed={threshold === value} className={threshold === value ? "is-selected" : ""} key={value} onClick={() => setThreshold(value)} type="button">{Math.round(value * 100)}%</button>)}
                  </div>
                </div>
                <aside className="breaking-answer">
                  <div className="breaking-answer-top"><Sparkles size={16} /><span>Model-based result</span></div>
                  {breakingPoint.available && breakingPoint.alreadyBreached ? <><strong>Already breached</strong><p>{breakingPoint.message}</p><div><Activity size={13} /><span>Current {percent.format(loan.calibratedPd)} → threshold {Math.round(threshold * 100)}%</span></div></> : breakingPoint.available ? <><strong>{breakingPoint.value}{breakingPoint.unit}</strong><p><b>{breakingPoint.variable}</b> {breakingPoint.descriptor} is the smallest single-variable move that reaches <b>{Math.round(threshold * 100)}% PD</b>.</p><div><Activity size={13} /><span>Current {percent.format(loan.calibratedPd)} → threshold {Math.round(threshold * 100)}%</span></div></> : <><strong>No single breach</strong><p>{breakingPoint.message}</p></>}
                </aside>
              </div>
            </section>
          </section>
          <footer className="dashboard-footer time-machine-footer"><span>LoanPulse AI · Risk Time Machine</span><span>Model interpretations and scenarios support human review; they are not lending decisions.</span></footer>
        </main>
      </div>
    </div>
  );
}
