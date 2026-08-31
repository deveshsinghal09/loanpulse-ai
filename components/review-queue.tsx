"use client";

import {
  ArrowDown,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  ArrowUpDown,
  ChevronRight,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { formatMoneyCompact, percent, percentagePoints } from "@/lib/format";
import { calculateRiskVelocity, classifyRisk, classifyRiskVelocity } from "@/lib/risk";
import type { LoanReview, QueueFilter } from "@/lib/types";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const columnHelper = createColumnHelper<typeof features, LoanReview>();

function titleCase(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function PriorityCell({ loan }: { loan: LoanReview }) {
  const urgent = loan.priority >= 70;
  return (
    <div className={`priority-cell${urgent ? " is-urgent" : ""}`}>
      <strong>{loan.priority}</strong>
      <span>Review rank</span>
    </div>
  );
}

function BorrowerCell({ loan }: { loan: LoanReview }) {
  return (
    <div className="borrower-cell">
      <strong>{loan.borrower}</strong>
      <span><code>{loan.id}</code><i>·</i>{loan.segment}<i>·</i>{loan.region}</span>
    </div>
  );
}

function RiskCell({ loan }: { loan: LoanReview }) {
  const band = classifyRisk(loan.calibratedPd);
  return (
    <div className="pd-cell">
      <strong>{percent.format(loan.calibratedPd)}</strong>
      <span className={`risk-state is-${band}`}><i />{titleCase(band)}</span>
    </div>
  );
}

function VelocityCell({ loan }: { loan: LoanReview }) {
  const value = calculateRiskVelocity(loan.calibratedPd, loan.previousPd);
  const trend = classifyRiskVelocity(value);
  const tone = value > 0.025 ? "negative" : value < -0.025 ? "positive" : "neutral";
  return (
    <div className={`velocity-cell is-${tone}`}>
      <strong>{percentagePoints(value)} {tone === "negative" ? <ArrowUpRight aria-hidden="true" size={12} /> : tone === "positive" ? <ArrowDownRight aria-hidden="true" size={12} /> : null}</strong>
      <small>{trend}</small>
    </div>
  );
}

function PeerModelCell({ loan }: { loan: LoanReview }) {
  return (
    <div className="anomaly-cell">
      <div className="anomaly-heading"><strong>P{loan.anomalyPercentile}</strong><span>peer percentile</span></div>
      <div className="anomaly-track" aria-hidden="true"><span style={{ width: `${loan.anomalyPercentile}%` }}><i /></span></div>
      <div className="model-state">
        <span className={`confidence-badge is-${loan.confidence}`}>{titleCase(loan.confidence)}</span>
        <small
          className={loan.modelAgreement ? "is-agree" : "is-disagree"}
          title={loan.modelAgreement ? "Models agree" : "Models disagree"}
        >
          {loan.modelAgreement ? "Agree" : "Disagree"}
        </small>
      </div>
    </div>
  );
}

function SignalCell({ loan }: { loan: LoanReview }) {
  return (
    <div className="signal-cell">
      <strong>{loan.lastSignal}</strong>
      <span>{loan.topDriver}</span>
    </div>
  );
}

const columns = columnHelper.columns([
  columnHelper.accessor("priority", {
    id: "priority",
    header: "Priority",
    sortDescFirst: true,
    cell: (info) => <PriorityCell loan={info.row.original} />,
  }),
  columnHelper.accessor("borrower", {
    id: "borrower",
    header: "Borrower",
    cell: (info) => <BorrowerCell loan={info.row.original} />,
  }),
  columnHelper.accessor("exposure", {
    id: "exposure",
    header: "Exposure",
    sortDescFirst: true,
    cell: (info) => <span className="table-number">{formatMoneyCompact(info.getValue())}</span>,
  }),
  columnHelper.accessor("calibratedPd", {
    id: "calibratedPd",
    header: "Risk",
    sortDescFirst: true,
    cell: (info) => <RiskCell loan={info.row.original} />,
  }),
  columnHelper.accessor((row) => calculateRiskVelocity(row.calibratedPd, row.previousPd), {
    id: "velocity",
    header: "30D change",
    sortDescFirst: true,
    cell: (info) => <VelocityCell loan={info.row.original} />,
  }),
  columnHelper.accessor("anomalyPercentile", {
    id: "anomalyPercentile",
    header: "Model",
    sortDescFirst: true,
    cell: (info) => <PeerModelCell loan={info.row.original} />,
  }),
  columnHelper.accessor("lastSignal", {
    id: "lastSignal",
    header: "Key signal",
    cell: (info) => <SignalCell loan={info.row.original} />,
  }),
  columnHelper.display({
    id: "open",
    cell: () => <span className="row-action"><span>View</span><ChevronRight aria-hidden="true" className="row-chevron" size={15} /></span>,
  }),
]);

const filterLabels: Record<QueueFilter, string> = {
  all: "All attention",
  "high-risk": "High risk",
  emerging: "Emerging risk",
  anomalous: "Anomalous",
};

const columnLabels: Record<string, string> = {
  priority: "Priority",
  borrower: "Borrower",
  exposure: "Exposure",
  calibratedPd: "Risk",
  velocity: "30D change",
  anomalyPercentile: "Model",
  lastSignal: "Key signal",
};

function matchesFilter(loan: LoanReview, filter: QueueFilter) {
  if (filter === "high-risk") return loan.calibratedPd >= 0.3;
  if (filter === "emerging") return calculateRiskVelocity(loan.calibratedPd, loan.previousPd) >= 0.025;
  if (filter === "anomalous") return loan.anomalyPercentile >= 90;
  return true;
}

export function ReviewQueue({
  loans,
  query,
  filter,
  onFilterChange,
  selectedLoanId,
  onSelectLoan,
}: {
  loans: LoanReview[];
  query: string;
  filter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
  selectedLoanId?: string;
  onSelectLoan: (loan: LoanReview) => void;
}) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => columns.map((column) => column.id));
  const filteredLoans = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return loans.filter((loan) => {
      const searchable = `${loan.id} ${loan.borrower} ${loan.segment} ${loan.region} ${loan.officer}`.toLowerCase();
      return matchesFilter(loan, filter) && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [filter, loans, query]);
  const queueSummary = useMemo(() => {
    const velocities = filteredLoans
      .map((loan) => calculateRiskVelocity(loan.calibratedPd, loan.previousPd))
      .sort((a, b) => a - b);
    const middle = Math.floor(velocities.length / 2);
    const medianVelocity = velocities.length === 0
      ? 0
      : velocities.length % 2
        ? velocities[middle]
        : (velocities[middle - 1] + velocities[middle]) / 2;
    return {
      exposure: filteredLoans.reduce((sum, loan) => sum + loan.exposure, 0),
      highRisk: filteredLoans.filter((loan) => loan.calibratedPd >= .3).length,
      medianVelocity,
    };
  }, [filteredLoans]);

  const table = useTable({
    columns,
    data: filteredLoans,
    features,
    initialState: { sorting: [{ id: "priority", desc: true }] },
  });

  return (
    <section className="panel queue-panel">
      <div className="queue-header">
        <div>
          <div className="eyebrow-row">
            <span>Human review queue</span>
            <span className="queue-count">{filteredLoans.length} shown</span>
          </div>
          <h2>Loans requiring attention</h2>
          <p>Ranked by PD, risk velocity, peer anomaly, exposure, and model reliability.</p>
        </div>
        <div className="queue-actions">
          <div className="queue-control">
            <button aria-expanded={filterMenuOpen} className="secondary-button" onClick={() => { setFilterMenuOpen((value) => !value); setColumnMenuOpen(false); }} type="button"><Filter size={14} /> Filters <span className="button-count">{filter === "all" ? 0 : 1}</span></button>
            {filterMenuOpen ? <div className="queue-popover filter-popover"><strong>Attention view</strong><p>Choose the risk population shown in the queue.</p>{(Object.keys(filterLabels) as QueueFilter[]).map((key) => <button aria-pressed={filter === key} className={filter === key ? "is-active" : ""} key={key} onClick={() => { onFilterChange(key); setFilterMenuOpen(false); }} type="button"><span>{filterLabels[key]}</span>{filter === key ? <span aria-hidden="true">✓</span> : null}</button>)}</div> : null}
          </div>
          <div className="queue-control">
            <button aria-expanded={columnMenuOpen} className="icon-button" aria-label="Choose visible columns" onClick={() => { setColumnMenuOpen((value) => !value); setFilterMenuOpen(false); }} type="button"><SlidersHorizontal size={16} /></button>
            {columnMenuOpen ? <div className="queue-popover column-popover"><strong>Visible columns</strong>{columns.filter((column) => column.id !== "open").map((column, index) => { const id = column.id ?? `column-${index}`; return <label key={id}><input checked={visibleColumns.includes(id)} onChange={() => setVisibleColumns((current) => current.includes(id) ? current.filter((visibleId) => visibleId !== id) : [...current, id])} type="checkbox" /> <span>{columnLabels[id] ?? id}</span></label>; })}</div> : null}
          </div>
        </div>
      </div>

      <div className="queue-filter-tabs" role="group" aria-label="Filter review queue">
        {(Object.keys(filterLabels) as QueueFilter[]).map((key) => (
          <button
            aria-pressed={filter === key}
            className={filter === key ? "is-active" : ""}
            key={key}
            onClick={() => onFilterChange(key)}
            type="button"
          >
            {filterLabels[key]}
          </button>
        ))}
      </div>

      <div className="queue-summary" aria-label="Visible portfolio summary">
        <div><span>Borrowers</span><strong>{filteredLoans.length}</strong></div>
        <div><span>Exposure</span><strong>{formatMoneyCompact(queueSummary.exposure)}</strong></div>
        <div><span>High risk</span><strong>{queueSummary.highRisk}</strong></div>
        <div><span>Median 30D change</span><strong className={queueSummary.medianVelocity > .025 ? "is-negative" : queueSummary.medianVelocity < -.025 ? "is-positive" : ""}>{percentagePoints(queueSummary.medianVelocity)}</strong></div>
      </div>

      <div className="table-scroll">
        <table className="review-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.filter((header) => visibleColumns.includes(header.column.id)).map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      data-column={header.column.id}
                      key={header.id}
                      scope="col"
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          className={header.column.getCanSort() ? "sortable-header" : "plain-header"}
                          disabled={!header.column.getCanSort()}
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          <table.FlexRender header={header} />
                          {header.column.getCanSort() ? (
                            sorted === "asc" ? <ArrowUp size={12} /> : sorted === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />
                          ) : null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                aria-label={`Review ${row.original.borrower}`}
                aria-selected={selectedLoanId === row.original.id}
                key={row.id}
                onClick={() => onSelectLoan(row.original)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectLoan(row.original);
                  }
                }}
                tabIndex={0}
              >
                {row.getAllCells().filter((cell) => visibleColumns.includes(cell.column.id)).map((cell) => (
                  <td data-column={cell.column.id} key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 ? (
          <div className="queue-empty">
            <strong>No loans match this view</strong>
            <span>Clear the search or choose another attention filter.</span>
            <button onClick={() => onFilterChange("all")} type="button">Show all attention loans</button>
          </div>
        ) : null}
      </div>

      <div className="queue-footer">
        <span>Priority is a transparent review ranking, not an approval or decline decision.</span>
        <button className="text-button" type="button">How priority works <ChevronRight size={13} /></button>
      </div>
    </section>
  );
}
