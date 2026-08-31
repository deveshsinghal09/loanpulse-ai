CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE, name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clerk_user_id text NOT NULL UNIQUE,
  email text NOT NULL, display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  last_seen_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','reviewer','analyst','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug text NOT NULL, name text NOT NULL, as_of timestamptz NOT NULL, model_version text NOT NULL,
  data_freshness text NOT NULL, data_health numeric(6,5) NOT NULL CHECK (data_health BETWEEN 0 AND 1),
  currency char(3) NOT NULL DEFAULT 'INR', active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,slug)
);
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  portfolio_id uuid NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE, external_id text NOT NULL,
  borrower text NOT NULL, segment text NOT NULL, region text NOT NULL,
  exposure numeric(18,2) NOT NULL CHECK (exposure >= 0), facility text, officer text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','charged_off')),
  days_past_due integer NOT NULL DEFAULT 0 CHECK (days_past_due >= 0), attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,external_id)
);
CREATE TABLE IF NOT EXISTS risk_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE, observed_at timestamptz NOT NULL,
  calibrated_pd numeric(9,8) NOT NULL CHECK (calibrated_pd BETWEEN 0 AND 1), raw_pd numeric(9,8) CHECK (raw_pd BETWEEN 0 AND 1),
  previous_pd numeric(9,8) CHECK (previous_pd BETWEEN 0 AND 1), expected_loss numeric(18,2) NOT NULL CHECK (expected_loss >= 0),
  anomaly_percentile integer NOT NULL CHECK (anomaly_percentile BETWEEN 0 AND 100),
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low')), model_agreement boolean NOT NULL,
  ood_score numeric(9,8) CHECK (ood_score BETWEEN 0 AND 1), model_version text NOT NULL,
  last_signal text NOT NULL, top_driver text NOT NULL, drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (loan_id,observed_at,model_version)
);
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE, reviewer_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','superseded')),
  outcome text NOT NULL CHECK (outcome IN ('heightened_monitoring','request_evidence','maintain','escalate','exit_watch')),
  rationale text NOT NULL CHECK (char_length(rationale) BETWEEN 20 AND 5000), limitations_acknowledged boolean NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saved_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE, created_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120), inputs jsonb NOT NULL, result jsonb NOT NULL,
  model_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS copilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES loans(id) ON DELETE SET NULL, user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  provider text NOT NULL, model text NOT NULL, prompt text NOT NULL, response text,
  status text NOT NULL CHECK (status IN ('succeeded','failed')), duration_ms integer NOT NULL CHECK (duration_ms >= 0),
  error_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS model_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  run_key text NOT NULL UNIQUE, model_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('training','validated','deployed','failed','retired')),
  training_period jsonb NOT NULL DEFAULT '{}'::jsonb, metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_uri text, configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), deployed_at timestamptz
);
CREATE TABLE IF NOT EXISTS ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source text NOT NULL, status text NOT NULL CHECK (status IN ('running','succeeded','failed')),
  rows_received integer NOT NULL DEFAULT 0, rows_accepted integer NOT NULL DEFAULT 0,
  error_summary text, started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('human','model','policy','system','ai')),
  event_type text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL, request_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now(),
  previous_hash text, event_hash text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS loans_portfolio_status_idx ON loans (portfolio_id,status);
CREATE INDEX IF NOT EXISTS snapshots_loan_observed_idx ON risk_snapshots (loan_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS snapshots_org_observed_idx ON risk_snapshots (organization_id,observed_at DESC);
CREATE INDEX IF NOT EXISTS reviews_loan_submitted_idx ON reviews (loan_id,submitted_at DESC);
CREATE INDEX IF NOT EXISTS scenarios_loan_created_idx ON saved_scenarios (loan_id,created_at DESC);
CREATE INDEX IF NOT EXISTS audit_org_time_idx ON audit_events (organization_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events (organization_id,entity_type,entity_id,occurred_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS users_updated_at ON app_users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON app_users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS portfolios_updated_at ON portfolios;
CREATE TRIGGER portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS loans_updated_at ON loans;
CREATE TRIGGER loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION seal_audit_event() RETURNS trigger AS $$
DECLARE prior text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.organization_id::text));
  SELECT event_hash INTO prior FROM audit_events WHERE organization_id=NEW.organization_id ORDER BY id DESC LIMIT 1;
  NEW.previous_hash=prior;
  NEW.event_hash=encode(digest(concat_ws('|',coalesce(prior,''),NEW.organization_id::text,NEW.actor_type,
    NEW.event_type,NEW.entity_type,NEW.entity_id,NEW.occurred_at::text,NEW.payload::text),'sha256'),'hex');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_event_seal ON audit_events;
CREATE TRIGGER audit_event_seal BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION seal_audit_event();

CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit_events are append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_event_no_update ON audit_events;
CREATE TRIGGER audit_event_no_update BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
