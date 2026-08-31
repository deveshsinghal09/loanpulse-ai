# Production runbook

## 1. Local configuration

Copy `.env.example` to `.env.local`. Start with `APP_MODE=demo`. Add the Neon
pooled URL as `DATABASE_URL` and the direct URL as `DATABASE_URL_UNPOOLED`.

Run:

```bash
npm run db:setup
```

The migration is idempotent. The seed is optional and safe to rerun.

For real portfolio intake, set a strong `INGESTION_API_KEY` and submit the JSON
contract to `POST /api/ingestion/loans` with `Authorization: Bearer <key>`, or
sign in as an administrator and use Data health. Batches are capped at 1,000
loans, loan upserts are idempotent, identical snapshots are ignored, and every
successful run appends an audit event.

## 2. Identity

Create a Clerk application and add its publishable and secret keys. Add at least
one verified email to `ADMIN_EMAILS`. All other first-seen users receive the
`reviewer` role; change that membership directly through an administrator-only
operations process before production use.

## 3. Train and serve the model

```bash
python -m pip install -e ".[test]"
loanpulse-ml train --input data/loans.csv --config config/training.example.yaml --artifacts artifacts
```

Set `MODEL_ARTIFACT_PATH` to the selected run directory and generate a strong
`ML_SERVICE_API_KEY`. Run the service with `loanpulse-serve`, its container, or
`docker compose up ml`.

Review every nullable discovery field in `config/training.example.yaml` before a
governed run. Automatic discovery reports uncertainty; it does not silently bind
an ambiguous target or time field. A sample live intake body is available at
`docs/examples/portfolio-ingestion.json`.

## 4. Production mode

Set `APP_MODE=production` and `NEXT_PUBLIC_APP_MODE=production` only after:

- `/api/ready` returns HTTP 200;
- at least one administrator can sign in;
- the active portfolio has real loans and risk snapshots;
- the ML artifact is validated and the scenario feature map matches its schema;
- Gemini data handling has been approved if the copilot is enabled.

Production mode never falls back to synthetic data.

## 5. Deployment

For Vercel, connect Neon and Clerk through Marketplace or enter their environment
variables in project settings. Deploy the ML container separately and keep its URL
private where possible. For self-hosting, `Dockerfile` uses the Next.js standalone
output and runs as a non-root user.

## 6. Monitoring

- `/api/health`: web-process liveness; does not call dependencies.
- `/api/ready`: Neon, identity configuration, and ML readiness.
- ML `/health`: process liveness.
- ML `/ready`: artifact availability; requires its service credential.
- Application mutation logs are structured JSON and include request ID, actor ID,
  duration, status, and entity ID without secrets or full borrower records.

Alert on readiness failures, repeated 5xx responses, scoring latency, failed
ingestion runs, and audit-chain verification failures.
