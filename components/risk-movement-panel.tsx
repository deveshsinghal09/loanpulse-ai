import { ArrowDownRight, ArrowUpRight, Minus, MoveUpRight } from "lucide-react";
import { formatMoneyCompact } from "@/lib/format";

interface DistributionItem {
  band: string;
  loans: number;
  exposure: number;
  color: string;
}

const movements = [
  { label: "Rapidly deteriorating", count: 46, exposure: 12_800_000, direction: "up" },
  { label: "Slowly deteriorating", count: 183, exposure: 31_600_000, direction: "up" },
  { label: "Stable", count: 1_742, exposure: 198_200_000, direction: "flat" },
  { label: "Improving", count: 447, exposure: 43_800_000, direction: "down" },
];

const largestMovement = Math.max(...movements.map((item) => item.count));

export function RiskMovementPanel({ distribution }: { distribution: DistributionItem[] }) {
  const total = distribution.reduce((sum, item) => sum + item.loans, 0);

  return (
    <section className="panel movement-panel">
      <div className="panel-header compact">
        <div>
          <span className="eyebrow">Portfolio shape</span>
          <h2>Risk movement</h2>
        </div>
        <button className="text-button" type="button">View cohorts <MoveUpRight size={13} /></button>
      </div>

      <div className="distribution-bar" aria-label="Loan risk distribution">
        {distribution.map((item) => (
          <span
            key={item.band}
            style={{ background: item.color, width: `${(item.loans / total) * 100}%` }}
            title={`${item.band}: ${item.loans.toLocaleString("en-IN")} loans`}
          />
        ))}
      </div>
      <div className="distribution-legend">
        {distribution.map((item) => (
          <div key={item.band}>
            <span><i style={{ background: item.color }} />{item.band}</span>
            <strong>{item.loans.toLocaleString("en-IN")}</strong>
          </div>
        ))}
      </div>

      <div className="movement-list">
        {movements.map((item) => (
          <div className="movement-row" key={item.label}>
            <span className={`movement-icon is-${item.direction}`}>
              {item.direction === "up" ? <ArrowUpRight size={14} /> : item.direction === "down" ? <ArrowDownRight size={14} /> : <Minus size={14} />}
            </span>
            <div>
              <strong>{item.label}</strong>
              <small>{formatMoneyCompact(item.exposure)} exposure</small>
            </div>
            <span className="movement-count"><strong>{item.count.toLocaleString("en-IN")}</strong><small>loans</small></span>
            <span className={`movement-meter is-${item.direction}`} aria-hidden="true"><i style={{ width: `${Math.max(5, (item.count / largestMovement) * 100)}%` }} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}
