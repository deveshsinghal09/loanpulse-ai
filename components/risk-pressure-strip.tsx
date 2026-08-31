import type { PortfolioPoint } from "@/lib/types";

export function RiskPressureStrip({ points }: { points: PortfolioPoint[] }) {
  const min = Math.min(...points.map((point) => point.calibratedPd));
  const max = Math.max(...points.map((point) => point.calibratedPd));

  return (
    <div className="pressure-strip" aria-label="Twelve-week portfolio risk pressure">
      <div className="pressure-copy">
        <span>Risk pressure</span>
        <strong>Rising for 6 weeks</strong>
      </div>
      <div className="pressure-bars" aria-hidden="true">
        {points.map((point) => {
          const normalized = (point.calibratedPd - min) / Math.max(max - min, 0.001);
          const height = 8 + normalized * 20;
          return (
            <span
              className={`pressure-bar${point.calibratedPd >= 0.08 ? " is-breach" : ""}`}
              key={point.period}
              style={{ height }}
              title={`${point.label}: ${(point.calibratedPd * 100).toFixed(1)}% calibrated PD`}
            />
          );
        })}
      </div>
      <div className="pressure-delta">
        <span>12-week shift</span>
        <strong>+2.5 pp</strong>
      </div>
    </div>
  );
}
