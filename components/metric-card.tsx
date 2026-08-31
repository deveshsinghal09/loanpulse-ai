import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { QueueFilter } from "@/lib/types";

export function MetricCard({
  label,
  value,
  detail,
  delta,
  direction,
  icon: Icon,
  filter,
  active,
  onActivate,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  delta: string;
  direction: "up" | "down";
  icon: LucideIcon;
  filter?: QueueFilter;
  active?: boolean;
  onActivate?: (filter: QueueFilter) => void;
  tone?: "neutral" | "danger" | "warning" | "positive";
}) {
  const content = (
    <>
      <div className="metric-heading">
        <span>{label}</span>
        <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        <span className={`metric-delta is-${tone}`}>
          {direction === "up" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {delta}
        </span>
        <span>{detail}</span>
      </div>
    </>
  );

  if (filter && onActivate) {
    return (
      <button
        aria-pressed={active}
        className={`metric-card is-actionable${active ? " is-selected" : ""}`}
        onClick={() => onActivate(filter)}
        type="button"
      >
        {content}
      </button>
    );
  }

  return <article className="metric-card">{content}</article>;
}
