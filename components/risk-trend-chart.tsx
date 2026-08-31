"use client";

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
import { Info } from "lucide-react";
import { formatMoneyCompact } from "@/lib/format";
import type { PortfolioPoint } from "@/lib/types";

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PortfolioPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <p>{point.label}, 2026</p>
      <dl>
        <div><dt>Calibrated PD</dt><dd>{(point.calibratedPd * 100).toFixed(1)}%</dd></div>
        <div><dt>Expected loss</dt><dd>{formatMoneyCompact(point.expectedLoss * 1_000_000)}</dd></div>
        <div><dt>High-risk exposure</dt><dd>{formatMoneyCompact(point.highRiskExposure * 1_000_000)}</dd></div>
      </dl>
    </div>
  );
}

export function RiskTrendChart({ data }: { data: PortfolioPoint[] }) {
  return (
    <section className="panel trend-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow-row">
            <span>Portfolio trend</span>
            <span className="calibration-badge">Calibrated · isotonic</span>
          </div>
          <h2>Risk is moving above the operating range</h2>
        </div>
        <div className="panel-actions">
          <span className="chart-legend"><i className="legend-line" /> Weighted PD</span>
          <span className="chart-legend"><i className="legend-area" /> High-risk exposure</span>
          <button className="icon-button is-small" aria-label="Show metric definitions" type="button">
            <Info size={15} />
          </button>
        </div>
      </div>
      <div className="chart-frame" role="img" aria-label="Twelve-week calibrated default probability trend">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="exposureFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3761d2" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#3761d2" stopOpacity={0.015} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="2 5" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              interval={2}
              tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              domain={[0.05, 0.1]}
              tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
              tickLine={false}
              ticks={[0.05, 0.06, 0.07, 0.08, 0.09, 0.1]}
              width={42}
              yAxisId="pd"
            />
            <YAxis hide domain={[25, 48]} orientation="right" yAxisId="exposure" />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} />
            <ReferenceLine
              label={{ value: "Watch 8%", fill: "var(--risk-moderate)", fontSize: 10, position: "insideTopLeft" }}
              stroke="var(--risk-moderate)"
              strokeDasharray="5 5"
              y={0.08}
              yAxisId="pd"
            />
            <Area
              dataKey="highRiskExposure"
              fill="url(#exposureFill)"
              isAnimationActive={false}
              stroke="none"
              type="monotone"
              yAxisId="exposure"
            />
            <Line
              activeDot={{ fill: "#fff", r: 4, stroke: "var(--risk-critical)", strokeWidth: 2 }}
              dataKey="calibratedPd"
              dot={false}
              isAnimationActive={false}
              stroke="var(--risk-critical)"
              strokeWidth={2.25}
              type="monotone"
              yAxisId="pd"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-caption">
        <span>Weighted by current exposure</span>
        <span>Latest: 8.6% · 95% CI 7.9–9.4%</span>
      </div>
    </section>
  );
}
