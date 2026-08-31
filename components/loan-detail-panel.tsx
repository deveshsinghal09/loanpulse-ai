"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { money, percent, percentagePoints } from "@/lib/format";
import { calculateRiskVelocity, classifyRisk, classifyRiskVelocity } from "@/lib/risk";
import type { LoanReview } from "@/lib/types";

export function LoanDetailPanel({ loan, onClose }: { loan: LoanReview | null; onClose: () => void }) {
  if (!loan) return null;

  const velocity = calculateRiskVelocity(loan.calibratedPd, loan.previousPd);
  const trend = classifyRiskVelocity(velocity);
  const riskBand = classifyRisk(loan.calibratedPd);

  return (
    <>
      <button className="detail-backdrop" aria-label="Close loan preview" onClick={onClose} type="button" />
      <aside className="loan-detail" aria-labelledby="loan-detail-title">
        <div className="loan-detail-header">
          <div>
            <span className="eyebrow">Loan digital twin · preview</span>
            <h2 id="loan-detail-title">{loan.borrower}</h2>
            <p className="mono">{loan.id} · {loan.segment} · {loan.region}</p>
          </div>
          <button className="icon-button" aria-label="Close loan preview" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="loan-risk-hero">
          <div>
            <span>Calibrated probability of default</span>
            <strong>{percent.format(loan.calibratedPd)}</strong>
            <small>Isotonic calibration · PD v3.4</small>
          </div>
          <span className={`risk-band is-${riskBand}`}>{riskBand}</span>
        </div>

        <div className="loan-stat-grid">
          <div><span>Risk velocity</span><strong className={velocity > 0 ? "negative" : "positive"}>{percentagePoints(velocity)}</strong><small>{trend}</small></div>
          <div><span>Expected loss</span><strong>{money.format(loan.expectedLoss)}</strong><small>45% assumed LGD</small></div>
          <div><span>Peer anomaly</span><strong>{loan.anomalyPercentile}th</strong><small>cohort percentile</small></div>
          <div><span>Model confidence</span><strong className="capitalize">{loan.confidence}</strong><small>{loan.modelAgreement ? "models agree" : "model disagreement"}</small></div>
        </div>

        <section className="evidence-block">
          <div className="section-heading-row">
            <div><span className="eyebrow">Evidence</span><h3>Why this loan is prioritized</h3></div>
            <span className="priority-pill">Priority {loan.priority}</span>
          </div>
          <div className="evidence-item">
            <AlertTriangle size={16} />
            <div><strong>{loan.lastSignal}</strong><span>{loan.lastSignalAt} · source: servicing feed</span></div>
          </div>
          <div className="evidence-item">
            <ArrowRight size={16} />
            <div><strong>{loan.topDriver}</strong><span>Largest model contribution in the current scoring period</span></div>
          </div>
          <div className="evidence-item">
            {loan.modelAgreement ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <div><strong>{loan.modelAgreement ? "Primary and baseline models agree" : "Model disagreement — review recommended"}</strong><span>LightGBM primary versus logistic baseline</span></div>
          </div>
        </section>

        <div className="loan-detail-footer">
          <p>Counterfactual and scenario outputs are model interpretations, not lending advice.</p>
          <Link className="primary-button" href={`/loans/${loan.id}`}>Open full digital twin <ExternalLink size={14} /></Link>
        </div>
      </aside>
    </>
  );
}
