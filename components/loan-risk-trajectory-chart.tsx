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
import type { LoanTrajectoryPoint } from "@/lib/loan-digital-twin-data";

function TrajectoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: LoanTrajectoryPoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="chart-tooltip twin-chart-tooltip">
      <p>{point.period}</p>
      <dl>
        <div><dt>Calibrated PD</dt><dd>{(point.pd * 100).toFixed(1)}%</dd></div>
        <div><dt>Confidence range</dt><dd>{(point.lower * 100).toFixed(1)}–{(point.upper * 100).toFixed(1)}%</dd></div>
        {point.event ? <div><dt>Event</dt><dd>{point.event}</dd></div> : null}
      </dl>
    </div>
  );
}

export function LoanRiskTrajectoryChart({ data }: { data: LoanTrajectoryPoint[] }) {
  return (
    <div className="twin-chart-frame" role="img" aria-label="Aster Components calibrated probability of default rose from 11.2 percent to 61.2 percent over twelve months, crossing the 30 percent alert threshold in June 2026.">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 14, right: 15, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3761d2" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#3761d2" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e8edf1" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fill: "#7b8796", fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#7b8796", fontSize: 9 }} tickFormatter={(value) => `${Math.round(value * 100)}%`} domain={[0, 0.8]} ticks={[0, 0.2, 0.4, 0.6, 0.8]} />
          <Tooltip content={<TrajectoryTooltip />} cursor={{ stroke: "#b8c2cc", strokeDasharray: "3 3" }} />
          <ReferenceLine y={0.3} stroke="#c78318" strokeDasharray="4 4" label={{ value: "Alert 30%", position: "insideTopLeft", fill: "#9c6819", fontSize: 9 }} />
          <Area type="linear" dataKey="upper" stroke="none" fill="url(#confidenceBand)" isAnimationActive={false} />
          <Area type="linear" dataKey="lower" stroke="none" fill="#fff" fillOpacity={0.94} isAnimationActive={false} />
          <Line type="linear" dataKey="pd" stroke="#c43d32" strokeWidth={2.2} dot={{ r: 2, fill: "#fff", stroke: "#c43d32", strokeWidth: 1.5 }} activeDot={{ r: 4 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
