import "server-only";
import { calculatePriorityScore } from "@/lib/risk";
import { portfolioSummary, portfolioTrend, reviewLoans, riskDistribution } from "@/lib/demo-data";
import { demoLoanTwin } from "@/lib/loan-digital-twin-data";
import type { LoanDigitalTwinData } from "@/lib/loan-digital-twin-data";
import type { LoanReview, PortfolioPoint, PortfolioSummary } from "@/lib/types";
import type { ScenarioInputs, ScenarioResult } from "@/lib/risk-time-machine";
import { appMode, isDatabaseConfigured, publicOperatingMode } from "./config";
import { checkDatabase, getDatabase } from "./db";
import { checkMlService } from "./ml-service";
import { requireActor, type AppActor } from "./auth";
import type { LoanIngestionInput } from "./validation";

export type PortfolioCommandData = {
  summary: PortfolioSummary;
  trend: PortfolioPoint[];
  loans: LoanReview[];
  distribution: typeof riskDistribution;
  source: "demo" | "live";
};

function demoCommandData(): PortfolioCommandData {
  return { summary: portfolioSummary, trend: portfolioTrend, loans: reviewLoans, distribution: riskDistribution, source: "demo" };
}

function mapLoan(row: Record<string, unknown>): LoanReview {
  const loan = {
    id: String(row.external_id), borrower: String(row.borrower), segment: String(row.segment), region: String(row.region),
    exposure: Number(row.exposure), calibratedPd: Number(row.calibrated_pd), previousPd: Number(row.previous_pd ?? row.calibrated_pd),
    expectedLoss: Number(row.expected_loss), anomalyPercentile: Number(row.anomaly_percentile),
    confidence: String(row.confidence) as LoanReview["confidence"], lastSignal: String(row.last_signal),
    lastSignalAt: row.observed_at ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      -Math.max(0, Math.round((Date.now() - new Date(String(row.observed_at)).getTime()) / 86_400_000)), "day",
    ) : "Unknown",
    priority: 0, topDriver: String(row.top_driver), modelAgreement: Boolean(row.model_agreement),
    daysPastDue: Number(row.days_past_due), officer: String(row.officer ?? "Unassigned"),
  } satisfies LoanReview;
  return { ...loan, priority: calculatePriorityScore(loan) };
}

async function livePortfolioData(actor: AppActor): Promise<PortfolioCommandData> {
  const sql = getDatabase();
  const portfolios = await sql`SELECT id,name,as_of,model_version,data_freshness,data_health
    FROM portfolios WHERE organization_id=${actor.organizationId} AND active=true ORDER BY updated_at DESC LIMIT 1` as Array<Record<string, unknown>>;
  const portfolio = portfolios[0];
  if (!portfolio) {
    return {
      summary: { name: "No active portfolio", asOf: new Date().toISOString(), modelVersion: "Not deployed", dataFreshness: "No data", loanCount: 0, totalExposure: 0, expectedLoss: 0, highRiskExposure: 0, newAlerts: 0, averageCalibratedPd: 0, dataHealth: 0 },
      trend: [], loans: [], distribution: [], source: "live",
    };
  }
  const rows = await sql`SELECT l.external_id,l.borrower,l.segment,l.region,l.exposure,l.officer,l.days_past_due,
      s.calibrated_pd,s.previous_pd,s.expected_loss,s.anomaly_percentile,s.confidence,s.model_agreement,
      s.last_signal,s.top_driver,s.observed_at
    FROM loans l
    JOIN LATERAL (SELECT * FROM risk_snapshots rs WHERE rs.loan_id=l.id ORDER BY rs.observed_at DESC LIMIT 1) s ON true
    WHERE l.organization_id=${actor.organizationId} AND l.portfolio_id=${String(portfolio.id)} AND l.status='active'
    ORDER BY s.calibrated_pd DESC` as Array<Record<string, unknown>>;
  const loans = rows.map(mapLoan);
  const totalExposure = loans.reduce((sum, loan) => sum + loan.exposure, 0);
  const expectedLoss = loans.reduce((sum, loan) => sum + loan.expectedLoss, 0);
  const highRiskExposure = loans.filter((loan) => loan.calibratedPd >= .3).reduce((sum, loan) => sum + loan.exposure, 0);
  const trendRows = await sql`SELECT date_trunc('month',rs.observed_at) AS month,
      avg(rs.calibrated_pd)::float8 AS pd,sum(rs.expected_loss)::float8 AS loss,
      sum(CASE WHEN rs.calibrated_pd>=.3 THEN l.exposure ELSE 0 END)::float8 AS high_exposure,
      count(*) FILTER (WHERE rs.calibrated_pd-coalesce(rs.previous_pd,rs.calibrated_pd)>=.025)::int AS alerts
    FROM risk_snapshots rs JOIN loans l ON l.id=rs.loan_id
    WHERE rs.organization_id=${actor.organizationId} AND l.portfolio_id=${String(portfolio.id)}
    GROUP BY 1 ORDER BY 1` as Array<Record<string, unknown>>;
  const trend = trendRows.map((row) => ({
    period: new Date(String(row.month)).toLocaleDateString("en-US", { month: "short" }), label: new Date(String(row.month)).toISOString(),
    calibratedPd: Number(row.pd), expectedLoss: Number(row.loss), highRiskExposure: Number(row.high_exposure), alerts: Number(row.alerts),
  }));
  const bands = [
    { band: "Low", min: 0, max: .12, color: "var(--risk-low)" },
    { band: "Moderate", min: .12, max: .3, color: "var(--risk-moderate)" },
    { band: "High", min: .3, max: .5, color: "var(--risk-high)" },
    { band: "Critical", min: .5, max: 2, color: "var(--risk-critical)" },
  ];
  const distribution = bands.map((band) => {
    const members = loans.filter((loan) => loan.calibratedPd >= band.min && loan.calibratedPd < band.max);
    return { band: band.band, loans: members.length, exposure: members.reduce((sum, loan) => sum + loan.exposure, 0) / 100_000, color: band.color };
  });
  return {
    summary: {
      name: String(portfolio.name), asOf: new Date(String(portfolio.as_of)).toISOString(), modelVersion: String(portfolio.model_version),
      dataFreshness: String(portfolio.data_freshness), loanCount: loans.length, totalExposure, expectedLoss, highRiskExposure,
      newAlerts: loans.filter((loan) => loan.calibratedPd - loan.previousPd >= .025).length,
      averageCalibratedPd: loans.length ? loans.reduce((sum, loan) => sum + loan.calibratedPd, 0) / loans.length : 0,
      dataHealth: Number(portfolio.data_health),
    },
    trend, loans, distribution, source: "live",
  };
}

export async function getPortfolioCommandData(): Promise<PortfolioCommandData> {
  if (appMode() === "demo") return demoCommandData();
  const actor = await requireActor();
  return livePortfolioData(actor);
}

export async function getLoanReviews() {
  return (await getPortfolioCommandData()).loans;
}

export async function getLoanTwin(id: string): Promise<LoanDigitalTwinData | undefined> {
  const demo = demoLoanTwin(id);
  if (appMode() === "demo") return demo;
  const loan = (await getLoanReviews()).find((item) => item.id === id);
  if (!loan || !demo) return undefined;
  return { ...demo, borrower: loan.borrower, segment: loan.segment, region: loan.region, exposure: loan.exposure,
    calibratedPd: loan.calibratedPd, previousPd: loan.previousPd, expectedLoss: loan.expectedLoss,
    anomalyPercentile: loan.anomalyPercentile, confidence: loan.confidence === "high" ? .9 : loan.confidence === "medium" ? .72 : .48,
    priority: loan.priority, owner: loan.officer };
}

export async function getLoanFeatureRecord(actor: AppActor, externalId: string): Promise<Record<string, unknown> | null> {
  if (actor.demo) return null;
  const sql = getDatabase();
  const rows = await sql`SELECT attributes || jsonb_build_object('exposure',exposure,'days_past_due',days_past_due,'lgd',coalesce((attributes->>'lgd')::numeric,.45)) AS record
    FROM loans WHERE organization_id=${actor.organizationId} AND external_id=${externalId} AND status='active' LIMIT 1` as Array<Record<string, unknown>>;
  return rows[0] ? rows[0].record as Record<string, unknown> : null;
}

export type AuditEventDTO = { id: string; time: string; eventType: string; entityType: string; entityId: string; actor: string; payload: Record<string, unknown>; hash: string };
export async function getAuditEvents(limit = 100): Promise<{ events: AuditEventDTO[]; source: "demo" | "live" }> {
  if (appMode() === "demo") return { source: "demo", events: [
    { id: "demo-1", time: "2026-08-25T09:42:16Z", eventType: "risk.score.changed", entityType: "loan", entityId: "LP-10482", actor: "LoanPulse model", payload: { from: .481, to: .612 }, hash: "demo-a91f" },
    { id: "demo-2", time: "2026-08-25T09:44:03Z", eventType: "review.escalated", entityType: "loan", entityId: "LP-10482", actor: "Policy engine", payload: { threshold: 85 }, hash: "demo-b42c" },
    { id: "demo-3", time: "2026-08-25T10:03:21Z", eventType: "review.assigned", entityType: "loan", entityId: "LP-10482", actor: "J. Morgan", payload: { reviewer: "A. Rivera", slaHours: 6 }, hash: "demo-c73e" },
  ] };
  const actor = await requireActor();
  const sql = getDatabase();
  const rows = await sql.query(`SELECT a.id,a.occurred_at,a.event_type,a.entity_type,a.entity_id,a.payload,a.event_hash,
      coalesce(u.display_name,initcap(a.actor_type)) AS actor
    FROM audit_events a LEFT JOIN app_users u ON u.id=a.actor_user_id
    WHERE a.organization_id=$1 ORDER BY a.occurred_at DESC LIMIT $2`, [actor.organizationId, Math.min(Math.max(limit, 1), 500)]) as Array<Record<string, unknown>>;
  return { source: "live", events: rows.map((row) => ({ id: String(row.id), time: String(row.occurred_at), eventType: String(row.event_type), entityType: String(row.entity_type), entityId: String(row.entity_id), actor: String(row.actor), payload: (row.payload ?? {}) as Record<string, unknown>, hash: String(row.event_hash) })) };
}

export async function recordReview(actor: AppActor, input: { loanId: string; outcome: string; rationale: string; acknowledged: boolean; requestId: string }) {
  if (actor.demo) return { id: "demo-review", persisted: false };
  const sql = getDatabase();
  const rows = await sql`WITH selected_loan AS (
      SELECT id FROM loans WHERE organization_id=${actor.organizationId} AND external_id=${input.loanId}
    ), inserted AS (
      INSERT INTO reviews (organization_id,loan_id,reviewer_id,outcome,rationale,limitations_acknowledged)
      SELECT ${actor.organizationId},id,${actor.id},${input.outcome},${input.rationale},${input.acknowledged} FROM selected_loan
      RETURNING id,loan_id
    ), audited AS (
      INSERT INTO audit_events (organization_id,actor_user_id,actor_type,event_type,entity_type,entity_id,request_id,payload)
      SELECT ${actor.organizationId},${actor.id},'human','review.submitted','loan',${input.loanId},${input.requestId},
        jsonb_build_object('review_id',inserted.id,'outcome',${input.outcome},'limitations_acknowledged',${input.acknowledged}) FROM inserted
    ) SELECT id FROM inserted` as Array<Record<string, unknown>>;
  if (!rows[0]) throw new Error("Loan not found in the active organization");
  return { id: String(rows[0].id), persisted: true };
}

export async function saveScenario(actor: AppActor, input: { loanId: string; name: string; scenario: ScenarioInputs; result: ScenarioResult; requestId: string }) {
  if (actor.demo) return { id: "demo-scenario", persisted: false };
  const sql = getDatabase();
  const rows = await sql`WITH selected_loan AS (
      SELECT id FROM loans WHERE organization_id=${actor.organizationId} AND external_id=${input.loanId}
    ), inserted AS (
      INSERT INTO saved_scenarios (organization_id,loan_id,created_by,name,inputs,result,model_version)
      SELECT ${actor.organizationId},id,${actor.id},${input.name},${JSON.stringify(input.scenario)}::jsonb,${JSON.stringify(input.result)}::jsonb,'scenario-v1' FROM selected_loan
      RETURNING id
    ), audited AS (
      INSERT INTO audit_events (organization_id,actor_user_id,actor_type,event_type,entity_type,entity_id,request_id,payload)
      SELECT ${actor.organizationId},${actor.id},'human','scenario.saved','loan',${input.loanId},${input.requestId},jsonb_build_object('scenario_id',inserted.id,'name',${input.name}) FROM inserted
    ) SELECT id FROM inserted` as Array<Record<string, unknown>>;
  if (!rows[0]) throw new Error("Loan not found in the active organization");
  return { id: String(rows[0].id), persisted: true };
}

export async function recordCopilotRun(actor: AppActor, input: { loanId?: string; prompt: string; response?: string; status: "succeeded" | "failed"; durationMs: number; model: string; errorCode?: string }) {
  if (actor.demo || !isDatabaseConfigured()) return;
  const sql = getDatabase();
  await sql`INSERT INTO copilot_runs (organization_id,loan_id,user_id,provider,model,prompt,response,status,duration_ms,error_code)
    SELECT ${actor.organizationId},l.id,${actor.id},'gemini',${input.model},${input.prompt},${input.response ?? null},${input.status},${input.durationMs},${input.errorCode ?? null}
    FROM (SELECT 1) seed LEFT JOIN loans l ON l.organization_id=${actor.organizationId} AND l.external_id=${input.loanId ?? ""}`;
}

export async function getSystemStatus() {
  const config = publicOperatingMode();
  const [database, ml] = await Promise.all([
    isDatabaseConfigured() ? checkDatabase() : Promise.resolve({ ok: false as const, latencyMs: 0 }),
    config.mlService ? checkMlService() : Promise.resolve({ ok: false as const, latencyMs: 0 }),
  ]);
  return { ...config, databaseReachable: database.ok, databaseLatencyMs: database.latencyMs, mlServiceReachable: ml.ok, mlServiceLatencyMs: ml.latencyMs, checkedAt: new Date().toISOString() };
}

export type IngestionPrincipal = {
  organizationId: string;
  actorUserId: string | null;
  actorType: "human" | "system";
};

export async function getServiceIngestionPrincipal(): Promise<IngestionPrincipal | null> {
  if (!isDatabaseConfigured()) return null;
  const sql = getDatabase();
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? "northstar-ventures";
  const rows = await sql`SELECT id FROM organizations WHERE slug=${slug} LIMIT 1` as Array<Record<string, unknown>>;
  return rows[0] ? { organizationId: String(rows[0].id), actorUserId: null, actorType: "system" } : null;
}

export async function ingestLoanBatch(principal: IngestionPrincipal, input: LoanIngestionInput, requestId: string) {
  const sql = getDatabase();
  const records = input.loans.map((loan) => ({
    external_id: loan.externalId,
    borrower: loan.borrower,
    segment: loan.segment,
    region: loan.region,
    exposure: loan.exposure,
    facility: loan.facility ?? null,
    officer: loan.officer ?? null,
    days_past_due: loan.daysPastDue,
    attributes: loan.attributes,
    observed_at: loan.observedAt,
    calibrated_pd: loan.calibratedPd,
    raw_pd: loan.rawPd ?? null,
    previous_pd: loan.previousPd ?? null,
    expected_loss: loan.expectedLoss,
    anomaly_percentile: loan.anomalyPercentile,
    confidence: loan.confidence,
    model_agreement: loan.modelAgreement,
    ood_score: loan.oodScore ?? null,
    last_signal: loan.lastSignal,
    top_driver: loan.topDriver,
    drivers: loan.drivers,
  }));
  const rows = await sql`
    WITH payload AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(records)}::jsonb) AS x(
        external_id text, borrower text, segment text, region text, exposure numeric,
        facility text, officer text, days_past_due integer, attributes jsonb, observed_at timestamptz,
        calibrated_pd numeric, raw_pd numeric, previous_pd numeric, expected_loss numeric,
        anomaly_percentile integer, confidence text, model_agreement boolean, ood_score numeric,
        last_signal text, top_driver text, drivers jsonb
      )
    ), run AS (
      INSERT INTO ingestion_runs (organization_id,source,status,rows_received)
      VALUES (${principal.organizationId},${input.source},'running',${records.length}) RETURNING id
    ), selected_portfolio AS (
      INSERT INTO portfolios (organization_id,slug,name,as_of,model_version,data_freshness,data_health,active)
      VALUES (${principal.organizationId},${input.portfolio.slug},${input.portfolio.name},${input.portfolio.asOf},
        ${input.portfolio.modelVersion},'Just ingested',${input.portfolio.dataHealth},true)
      ON CONFLICT (organization_id,slug) DO UPDATE SET name=EXCLUDED.name,as_of=EXCLUDED.as_of,
        model_version=EXCLUDED.model_version,data_freshness=EXCLUDED.data_freshness,data_health=EXCLUDED.data_health,active=true
      RETURNING id
    ), upserted_loans AS (
      INSERT INTO loans (organization_id,portfolio_id,external_id,borrower,segment,region,exposure,facility,officer,days_past_due,attributes)
      SELECT ${principal.organizationId},selected_portfolio.id,p.external_id,p.borrower,p.segment,p.region,p.exposure,
        p.facility,p.officer,p.days_past_due,coalesce(p.attributes,'{}'::jsonb)
      FROM payload p CROSS JOIN selected_portfolio
      ON CONFLICT (organization_id,external_id) DO UPDATE SET portfolio_id=EXCLUDED.portfolio_id,borrower=EXCLUDED.borrower,
        segment=EXCLUDED.segment,region=EXCLUDED.region,exposure=EXCLUDED.exposure,facility=EXCLUDED.facility,
        officer=EXCLUDED.officer,days_past_due=EXCLUDED.days_past_due,attributes=EXCLUDED.attributes,status='active'
      RETURNING id,external_id
    ), inserted_snapshots AS (
      INSERT INTO risk_snapshots (organization_id,loan_id,observed_at,calibrated_pd,raw_pd,previous_pd,expected_loss,
        anomaly_percentile,confidence,model_agreement,ood_score,model_version,last_signal,top_driver,drivers)
      SELECT ${principal.organizationId},l.id,p.observed_at,p.calibrated_pd,p.raw_pd,p.previous_pd,p.expected_loss,
        p.anomaly_percentile,p.confidence,p.model_agreement,p.ood_score,${input.portfolio.modelVersion},p.last_signal,p.top_driver,
        coalesce(p.drivers,'[]'::jsonb)
      FROM payload p JOIN upserted_loans l USING (external_id)
      ON CONFLICT (loan_id,observed_at,model_version) DO NOTHING RETURNING id
    ), completed AS (
      UPDATE ingestion_runs SET status='succeeded',rows_accepted=(SELECT count(*) FROM upserted_loans),completed_at=now()
      WHERE id=(SELECT id FROM run) RETURNING id
    ), audited AS (
      INSERT INTO audit_events (organization_id,actor_user_id,actor_type,event_type,entity_type,entity_id,request_id,payload)
      SELECT ${principal.organizationId},${principal.actorUserId},${principal.actorType},'dataset.ingested','portfolio',
        ${input.portfolio.slug},${requestId},jsonb_build_object('run_id',completed.id,'source',${input.source},
        'rows_received',${records.length},'model_version',${input.portfolio.modelVersion}) FROM completed
    )
    SELECT completed.id,(SELECT count(*)::int FROM upserted_loans) AS accepted,
      (SELECT count(*)::int FROM inserted_snapshots) AS snapshots FROM completed
  ` as Array<Record<string, unknown>>;
  if (!rows[0]) throw new Error("Ingestion did not complete");
  return { runId: String(rows[0].id), accepted: Number(rows[0].accepted), snapshots: Number(rows[0].snapshots) };
}

export type DataHealthView = {
  source: "demo" | "live";
  connected: boolean;
  health: number;
  freshness: string;
  activeLoans: number;
  latestRun: string | null;
  runs: Array<{ id: string; source: string; status: string; received: number; accepted: number; startedAt: string; completedAt: string | null }>;
};

export async function getDataHealthView(): Promise<DataHealthView> {
  if (appMode() === "demo") return {
    source: "demo", connected: false, health: .94, freshness: "42 min", activeLoans: reviewLoans.length,
    latestRun: "2026-08-25T09:01:00Z",
    runs: [
      { id: "demo-run-1", source: "Core servicing export", status: "succeeded", received: 1284, accepted: 1284, startedAt: "2026-08-25T09:00:00Z", completedAt: "2026-08-25T09:01:16Z" },
      { id: "demo-run-2", source: "Borrower financials", status: "succeeded", received: 1189, accepted: 1187, startedAt: "2026-08-24T09:00:00Z", completedAt: "2026-08-24T09:02:41Z" },
    ],
  };
  const actor = await requireActor();
  const sql = getDatabase();
  const [portfolioRows, runRows] = await Promise.all([
    sql`SELECT p.data_health,p.data_freshness,p.updated_at,count(l.id)::int AS active_loans
      FROM portfolios p LEFT JOIN loans l ON l.portfolio_id=p.id AND l.status='active'
      WHERE p.organization_id=${actor.organizationId} AND p.active=true
      GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 1` as Promise<Array<Record<string, unknown>>>,
    sql`SELECT id,source,status,rows_received,rows_accepted,started_at,completed_at FROM ingestion_runs
      WHERE organization_id=${actor.organizationId} ORDER BY started_at DESC LIMIT 12` as Promise<Array<Record<string, unknown>>>,
  ]);
  const portfolio = portfolioRows[0];
  return {
    source: "live", connected: true, health: Number(portfolio?.data_health ?? 0),
    freshness: String(portfolio?.data_freshness ?? "No successful ingestion"), activeLoans: Number(portfolio?.active_loans ?? 0),
    latestRun: runRows[0] ? String(runRows[0].completed_at ?? runRows[0].started_at) : null,
    runs: runRows.map((row) => ({ id: String(row.id), source: String(row.source), status: String(row.status),
      received: Number(row.rows_received), accepted: Number(row.rows_accepted), startedAt: String(row.started_at),
      completedAt: row.completed_at ? String(row.completed_at) : null })),
  };
}
