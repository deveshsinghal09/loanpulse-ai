# LoanPulse AI production implementation plan

## Objective

Move LoanPulse from a synthetic product demonstration to a production-capable,
human-in-the-loop credit-surveillance platform without weakening its model-risk
disclosures or changing its visual identity.

## Operating modes

- `demo`: the default when production credentials are absent. Synthetic data is
  clearly labelled and all persistence-dependent actions explain that they are
  local demonstrations.
- `production`: enabled explicitly with `APP_MODE=production`. Neon and Clerk are
  required; missing dependencies fail closed and are reported by readiness checks.

The application must never silently substitute demonstration values while it is
running in production mode.

## Architecture

```text
Browser
  └─ Next.js 16 application
      ├─ Clerk identity and optimistic route protection
      ├─ server-side data access and organization authorization
      ├─ Neon Postgres
      │   ├─ portfolios and loans
      │   ├─ risk snapshots
      │   ├─ reviewer decisions
      │   ├─ saved scenarios
      │   ├─ copilot activity
      │   └─ append-only audit events
      ├─ Gemini reviewer copilot (server-side only)
      └─ LoanPulse Python inference service
          ├─ calibrated primary model
          ├─ challenger disagreement
          ├─ OOD confidence
          └─ SHAP explanations
```

## Authorization model

| Role | Read portfolio | Run scenarios | Record reviews | Manage users/config |
|---|---:|---:|---:|---:|
| Viewer | Yes | No | No | No |
| Analyst | Yes | Yes | No | No |
| Reviewer | Yes | Yes | Yes | No |
| Admin | Yes | Yes | Yes | Yes |

Authorization is repeated in the data-access layer and every mutation endpoint.
Hiding a button is not treated as a security boundary.

## Database decisions

- Neon Postgres is accessed only from the server with the pooled `DATABASE_URL`.
- Every business row carries `organization_id` for tenant isolation.
- Monetary amounts use integer paise-safe database numerics rather than floats.
- PD, LGD, confidence, and model scores use bounded numeric columns.
- Audit records are append-only; database triggers reject updates and deletes.
- Common reviewer and surveillance queries have dedicated composite indexes.
- Migrations are explicit SQL files and can be run repeatedly safely.

## UI direction

The production layer should feel like evidence entering an operating system, not
like a generic admin settings template.

- Preserve the dark surveillance rail, warm light canvas, indigo model signal,
  lime system health, and semantic risk colors.
- Add one compact environment indicator to the top context bar.
- Add a `System status` governance destination that shows data, identity, model,
  AI, and audit readiness as a connected control ledger.
- Review and scenario mutations use explicit pending, success, and failure states.
- Live, degraded, and demonstration states are always visible in context.
- No secret values, raw connection strings, or internal exception details appear
  in the browser.

## Data flow

1. A server page asks the data-access layer for an organization-scoped DTO.
2. The DAL verifies identity and role, then queries Neon in production mode.
3. Client components receive only fields needed for the view.
4. Mutations validate input, repeat authorization, write the business record and
   audit event in one transaction, then revalidate the affected route.
5. AI and ML calls happen through protected server routes and record metadata,
   duration, outcome, and actor without logging secrets.

## ML completion

- Add the missing training orchestrator and CLI.
- Preserve chronological splitting when prediction time is usable.
- Train logistic baseline, XGBoost primary, and optional Random Forest challenger.
- Select Platt or isotonic calibration on validation data only.
- Evaluate held-out test metrics after calibration selection.
- Persist the inference bundle, preprocessing objects, configuration, feature
  names, metadata, calibration report, metrics, leakage report, and SHAP summary.
- Expose health, prediction, and explanation endpoints from a separate Python
  service loaded from a versioned artifact directory.

## Deployment

- Next.js: Vercel or the included standalone container.
- Postgres: Neon pooled connection for runtime, direct connection for migrations.
- ML service: included container, independently scalable from the web tier.
- Health: `/api/health` for liveness and `/api/ready` for dependency readiness.
- Logging: structured JSON with request IDs and duration; sensitive inputs are
  excluded by default.

## Release gates

- Database migration and seed succeed against a staging Neon branch.
- Every protected mutation has authentication, role, tenant, and validation tests.
- Typecheck, lint, unit tests, ML tests, and production build pass.
- Desktop and mobile workflows are browser-tested.
- Production readiness returns healthy before traffic promotion.

