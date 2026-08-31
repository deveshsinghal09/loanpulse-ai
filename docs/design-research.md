# LoanPulse AI — UI/UX research and design decisions

Research completed before the visual prototype on 26 August 2026. LoanPulse is designed for an institutional portfolio-risk reviewer whose immediate job is to identify meaningful change, inspect the evidence, and record a defensible decision.

## 1. Research scope and source register

### Production financial and operating products

- [Stripe Dashboard basics](https://docs.stripe.com/dashboard/basics) and [search](https://docs.stripe.com/dashboard/search): persistent primary navigation, global object search, field operators, keyboard shortcuts, drillable analytics, and context that survives navigation.
- [Stripe Radar](https://docs.stripe.com/radar), [Radar analytics](https://docs.stripe.com/radar/analytics?locale=en-GB&radar-dash=legacy), and [Radar rules](https://docs.stripe.com/radar/rules): risk evaluation routed into a review queue; rule outcomes are inspectable; an AI assistant proposes a structured rule and shows a historical simulation instead of replacing the workflow with chat.
- [Ramp real-time reporting](https://support.ramp.com/real-time-reporting/) and [reporting](https://ramp.com/reporting): role-aware dashboards, saved reports, and charts that drill into the exact underlying records. The pattern to retain is “summary → explain the spike → inspect records.”
- [Brex dashboard and smart tables](https://www.brex.com/support/brex-dashboard-and-app), [role-aware home](https://www.brex.com/support/home-page), and [approval chains](https://www.brex.com/support/approval-chains): column pinning/resizing, saved views, trait/range filters, exception grouping, bulk decisions, and an undo affordance after consequential action.
- [Mercury transaction data](https://support.mercury.com/hc/en-us/articles/38790547830036-Viewing-cashflow-and-transactions-data-on-your-Transactions-page): transaction-oriented search and filtering with direct movement from aggregate cashflow to records.
- [Linear UI redesign](https://linear.app/changelog/2024-03-20-new-linear-ui) and [Peek](https://linear.app/docs/peek): hierarchy achieved by reducing visual noise, a decluttered sidebar, keyboard-first navigation, and a quick preview that does not destroy list context.
- [Vercel Observability](https://vercel.com/docs/observability) and [Insights](https://vercel.com/docs/observability/insights): diagnostic sections mirror the system being observed; top-level signals drill into filtered detail views.
- [Bloomberg PORT](https://professional.bloomberg.com/products/bloomberg-terminal/portfolio-analytics/): positions, risk, performance, attribution, scenario analysis, and reporting are connected. Dense information is useful when the grouping is explicit and the comparison context is stable.

### Credit, lending, and investigation products

- [Moody’s CreditView](https://www.moodys.com/web/en/us/capabilities/credit-risk/creditview.html): an entity page combines monitoring, financials, news, peer comparison, scorecards, and scenarios. AI is a research accelerator while source evidence remains visible.
- [Moody’s Lending Suite loan monitoring](https://www.moodys.com/web/en/us/site-assets/lending-suite-loan-monitoring-brochure-nov-2024.pdf): early-warning thresholds, team queues, sensitivity analysis, and portfolio-first oversight.
- [nCino commercial lending](https://www.ncino.com/solutions/commercial-lending?nxtPslug=commercial-loan-origination-system): a complete relationship view, visual audit trail, covenants, policy exceptions, approvals, and decision history. Its record hierarchy informed the Loan Digital Twin ordering.
- [Persona Cases](https://docs.withpersona.com/2021-05-14/cases) and [Cases product](https://withpersona.com/product/cases/): a case is a collection of evidence with assignment, SLA, comments, audit history, and a decision. AI recommendations surface with reasoning inside that case, not in a detached conversation.

### Open-source implementation research

- [Tremor dashboard template](https://github.com/tremorlabs/template-dashboard-oss), Apache-2.0: inspected the Next.js layout, sticky filter bar, chart cards, desktop/mobile navigation, and Radix-based drawer. Useful patterns: date context above all charts, sparse axes, responsive drawer navigation, and comparison labels adjacent to values.
- [OpenStatus data-table-filters](https://github.com/openstatusHQ/data-table-filters), MIT: inspected its provider/state boundary, TanStack table setup, schema-generated columns and filters, command filter syntax, filter drawer, row-detail sheet, skeletons, resizing, persisted column state, and memoized rows. Useful patterns: one typed field definition drives table/filter/detail representations; table state can use memory or URL adapters; rows are keyboard focusable; the detail sheet supports up/down navigation and restores row focus when closed.
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/base/data-table) and [source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/app/(app)/examples/dashboard/components/data-table.tsx), MIT: inspected the separation of server data loading, client column definitions, table features, accessible row actions, and inline editing. We retain the composition model, not the example’s visual styling.
- [TanStack Table](https://tanstack.com/table/latest), MIT: headless sorting, filtering, faceting, visibility, selection, and controlled state are the correct primitives for the review queue.
- [Recharts ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/), MIT: chart dimensions follow their container through `ResizeObserver`; all prototype charts need an explicit parent height and responsive container.
- [Radix Primitives](https://www.radix-ui.com/primitives/docs/components), MIT: dialogs, popovers, tooltips, and dropdowns supply keyboard/focus behavior without dictating visual style.
- [Motion accessibility](https://motion.dev/docs/react-accessibility), MIT: reduced-motion preferences should remove large transform/layout movement while retaining brief opacity feedback.
- [Magic UI components](https://magicui.design/docs/components) and [Aceternity UI components](https://ui.aceternity.com/explore): reviewed for motion and visual treatments. Their animated backgrounds, glow, marquee, 3D, and hero patterns are intentionally excluded from the institutional application. A quiet numeric ticker could be appropriate in marketing, not in risk review where settled values must remain immediately legible.

No external project is copied wholesale. The prototype uses original layout, product vocabulary, tokens, and component composition. Any future direct reuse must retain the source project’s required license notice.

## 2. Product principles extracted from the research

1. **Exceptions before exploration.** The home screen answers “what changed, how large is it, and what needs a decision?” before it offers broad analysis.
2. **Every aggregate has a route to evidence.** Metrics and charts filter or open the records underneath them.
3. **Level and velocity are distinct.** A high-risk but stable loan and a moderate-risk rapidly deteriorating loan are different operational problems.
4. **AI is constrained to inspectable work.** It summarizes evidence, suggests the next action, creates structured filters/scenarios, and states confidence. It never occupies the main canvas as a large chat window.
5. **Decisions must be reconstructable.** Model version, reporting time, source recency, threshold, reviewer, comments, and decision history stay close to the decision.
6. **Density is earned by alignment.** Compact rows, tabular numerals, repeated column geometry, and thin rules support scan speed. Random card mosaics do not.
7. **Preview preserves queue context.** A right-side quick view supports triage; a full Digital Twin supports investigation.

## 3. Visual direction

LoanPulse should look like an institutional risk operating system: calm, exact, slightly editorial, and more like an analyst’s working ledger than a generic admin template. It combines Stripe/Vercel clarity, Linear restraint, Bloomberg information density, and case-management accountability.

Surfaces are off-white and cool gray. Dark ledger navy anchors navigation and headings. Borders, alignment, and white space create hierarchy; shadows are rare. Color appears only for risk state, selection, or a meaningful analytical series. Cards are not all equal: primary analytical surfaces are larger and quieter while exceptions are compact and sharper.

The signature visual is the **risk pressure strip**: a compact sequence of reporting periods encoded by weighted portfolio PD and threshold breaches. It makes risk velocity visible before a reviewer reaches a chart and gives LoanPulse a recognizable product device without ornamental graphics.

Rejected directions:

- giant chat panel, hero copy, glassmorphism, aurora/gradient backdrops, glowing borders, 3D hover cards, bento mosaics, and animated counters;
- a grid of equally weighted KPI cards;
- pie/donut charts for close quantitative comparison;
- “AI score” output without calibration, model version, confidence, and evidence;
- black terminal styling across the whole product—Bloomberg density is useful, Bloomberg visual imitation is not.

## 4. Information hierarchy

Across the product, visual priority is:

1. portfolio or loan identity, reporting date, and freshness;
2. change in risk and whether a decision is due;
3. magnitude: exposure, calibrated PD, expected loss, and downside;
4. causal evidence and source quality;
5. peer/history/scenario context;
6. reviewer action and audit history.

On the portfolio dashboard, expected loss and newly deteriorating exposure have stronger emphasis than total exposure. On a Loan Digital Twin, current calibrated PD and its velocity appear together; the AI recommendation is secondary to the evidence that produced it.

## 5. Navigation architecture

Desktop uses a persistent 232 px left rail and a 48 px top context bar. The rail is grouped by reviewer workflow:

- **Command center** — portfolio health, change, review queue.
- **Loan explorer** — searchable universe and saved views.
- **Review queues** — assigned, unassigned, SLA-risk, completed.
- **Scenarios** — saved macro and borrower-level stresses.
- **Portfolio analytics** — distribution, vintage, concentration, calibration.
- **Data quality** — stale feeds, missing documents, reconciliation issues.
- **Models** — active versions, drift, validation, thresholds.
- **Audit trail** — decisions, overrides, exports.

Workspace controls—portfolio, as-of date, model version, and data freshness—live in the top bar because they affect every page. Global search supports borrower, loan ID, facility, and field syntax; `Ctrl/Cmd+K` opens commands and `/` focuses search. Saved views are visible next to table filters, not buried in settings.

On mobile, the rail becomes an off-canvas drawer. The top bar retains page identity, freshness, search trigger, and reviewer queue count; portfolio/model selectors move into a context sheet.

## 6. Portfolio dashboard — exact layout

Desktop content order:

1. **Page header:** “Portfolio command center,” portfolio subtitle, saved-view control, and reporting status.
2. **Risk pressure strip:** latest six periods, threshold crossings, weighted PD, and “last refresh” annotation.
3. **Metric row:** total exposure; expected loss; high-risk exposure; new early warnings. Expected loss and warnings carry the strongest comparison treatment. Every metric is clickable and applies a visible queue filter.
4. **Analytical split (2:1):** calibrated portfolio risk trajectory on the left; “risk movement” exception summary on the right. The line chart includes threshold, comparison period, exact tooltip, and direct final values.
5. **Review queue:** dominant full-width surface with saved views, search, faceted filters, sorting, column controls, row count, and reviewer state. It should be visible on a common laptop viewport without requiring the user to traverse secondary charts.
6. **Quick-view sheet:** opens from a row and preserves the list. It summarizes change, top drivers, evidence recency, recommendation, and actions; up/down changes the selected row; “Open Digital Twin” moves to the full record.

Secondary portfolio analytics—distribution, vintage, calibration, concentration, scenario comparison—belong on the analytics page, not above the working queue.

## 7. Loan Digital Twin — exact information order

The Digital Twin is an evidence workspace, not a profile page and not a chat transcript.

1. **Identity and decision header:** breadcrumb; loan ID; borrower; facility; exposure; relationship owner; risk state; SLA; as-of timestamp; primary actions (“Assign,” “Request evidence,” “Record decision”).
2. **Risk spine:** calibrated PD; PD change over 30/90 days; expected loss; risk velocity; anomaly percentile; model confidence. Every value names its period or benchmark and offers provenance.
3. **What changed:** a concise event ledger ordered by contribution, showing before → after, event time, source, freshness, and contribution to risk. This is the core five-second answer.
4. **Risk trajectory:** historical calibrated PD with decision/alert markers and confidence band. A period selector changes 6M/12M/24M; no smoothing that invents unobserved data.
5. **Evidence and risk drivers:** two columns. Left: ranked adverse and protective drivers with contribution bars. Right: evidence completeness, contradictions, stale sources, covenant state, and document links.
6. **Borrower/loan structure:** repayment behavior, financial performance, covenants, collateral, relationship exposure, and facility terms in compact definition lists. Sections start expanded only when they contain an exception.
7. **Peer and history context:** percentile comparison against a named cohort; similar historical loans with outcomes; never a radar chart because overlapping axes obscure comparison.
8. **Scenario studio:** base, mild downside, severe downside, and one reviewer-defined scenario. Show PD, expected loss, covenant headroom, and the variables that changed. No theatrical simulation animation.
9. **Decision workspace:** AI recommendation, confidence, cited evidence, missing evidence, policy checks, reviewer note, decision selector, and required reason for overrides. AI content is a structured memo with “accept as draft” rather than a chat bubble.
10. **Audit timeline:** model runs, data changes, assignments, comments, decisions, and overrides in chronological order with actor and timestamp.

On wide screens, sections 3–5 use an 8/4 grid and the decision workspace can become a sticky right rail. At standard laptop widths it follows the analysis. The audit timeline always comes last because it proves the decision rather than driving initial comprehension.

## 8. Tables

### Review queue columns

Default visible columns:

1. priority rank;
2. loan ID / borrower;
3. facility / segment;
4. exposure;
5. calibrated PD and band;
6. 30-day PD change;
7. risk velocity;
8. expected loss;
9. top trigger;
10. evidence freshness;
11. assignee / SLA;
12. review status;
13. quick actions.

Optional columns: origination vintage, region, industry, maturity, LTV, DSCR, anomaly percentile, model confidence, last decision, and data-quality state. Monetary and percentage values are right-aligned with tabular numerals; identity and text are left-aligned.

### Filters and saved views

- status/band/segment/region/industry/assignee are faceted multi-selects with counts;
- exposure, PD, velocity, expected loss, LTV, DSCR, anomaly percentile, and SLA use ranges;
- trigger and borrower support text search;
- date ranges cover signal time, review due, maturity, and last decision;
- “My queue,” “New deterioration,” “Threshold breach,” “Stale evidence,” and “SLA at risk” are first-class saved views;
- filters serialize to the URL in production so a reviewer can share an exact investigative state.

Desktop filters use a compact toolbar plus optional control panel. Mobile uses a filter drawer with applied-count badge and explicit reset. Active filters appear as removable tokens only when applied.

### Sorting and row behavior

- default sort: transparent review priority descending, then earliest SLA;
- multi-sort is available but visually names the sort order;
- header click sorts; a header menu handles hide/pin/resize/reset;
- column order and visibility persist per saved view;
- row click opens quick view; `Enter` does the same; `↑/↓` moves through rows inside the sheet and closing restores focus;
- expansion is reserved for one-line evidence detail, not a second full dashboard nested inside a row;
- checkboxes enable bulk assign, request evidence, or mark reviewed. Risk decisions themselves are never silently bulk-approved.

### Status badges

Badges pair text with shape/icon; color is never the only signal:

- Critical — red lozenge + alert diamond;
- Watch — amber lozenge + clock;
- Stable — cool-gray lozenge + dash;
- Improving — teal lozenge + downward-risk arrow;
- Pending review / Evidence requested / Escalated / Complete — workflow-specific neutral or blue outlines.

### Quick actions

Open Digital Twin, assign/reassign, add note, request evidence, run scenario, and record decision. Destructive or policy-significant actions require confirmation and offer undo when operationally safe.

### Loading, empty, and error states

Skeletons match the final column geometry and do not animate financial values. Preserve header/filter layout while loading. Empty states name the active filters and offer reset. Partial-data states show which sources are stale or unavailable rather than replacing the entire table with a generic error.

## 9. Chart selection

| Question | Visualization | Required details | Avoid |
|---|---|---|---|
| Risk trajectory | Time-series line with step/event markers and optional confidence band | calibrated PD, alert threshold, event annotations, direct end label | smoothed curve or unexplained dual axis |
| Calibration | Reliability curve plus diagonal perfect-calibration reference; adjacent bin counts | observed default rate vs predicted PD, cohort/date/model version, confidence intervals | one aggregate “accuracy” gauge |
| Expected loss | Decomposed bars for PD × LGD × EAD, plus time comparison when needed | currency totals, assumption labels, period delta | decorative donut |
| Risk distribution | Ordered histogram or horizontal bands by risk grade | exposure and loan count toggle, threshold boundaries | 3D pie |
| Vintage analysis | Cohort heatmap with months-on-book columns | fixed color scale, visible values/tooltips, exposure-weight toggle | rainbow palette or stacked area across vintages |
| Risk velocity | Diverging horizontal bars around zero, sorted by magnitude | direction, 30/90-day period, exposure context | speedometer gauge |
| Anomaly percentile | Percentile strip/bullet plot with cohort markers | named peer group, P50/P90/P99, current position | radial gauge |
| Scenario comparison | Grouped horizontal bars or slope chart for base vs scenarios | PD, EL, covenant headroom, changed assumptions | radar/spider chart |

General chart rules: no chart without a stated question; axes retain units; tooltips repeat the series name and reporting date; legends sit near the data; thresholds are labeled directly; color semantics remain consistent; charts include a compact table or text summary for accessibility. Recharts containers have explicit heights and responsive width.

## 10. Motion

Meaningful motion only:

- 120–180 ms color/border/opacity feedback for hover, focus, filter application, and selection;
- 180–240 ms sheet/drawer entrance to preserve spatial context;
- one initial chart trace/fade after data settles, never on every filter keystroke;
- a brief highlight when a selected event maps to a chart point or driver;
- toast + undo after safe operational actions.

No parallax, floating elements, perpetual pulsing, number count-up, staggered dashboard reveals, or animated risk-state colors. Under `prefers-reduced-motion`, remove transforms and chart drawing; retain instantaneous state changes or short opacity fades.

## 11. Color system

Core palette:

- Ledger navy `#122033` — navigation, primary text, selected structural elements;
- Ink `#253247` — body headings;
- Graphite `#5C687A` — secondary text;
- Cloud `#F3F5F7` — application canvas;
- Paper `#FFFFFF` — working surfaces;
- Rule `#D8DEE6` — borders and gridlines;
- Analysis blue `#3761D2` — links, selection, neutral analytical series;
- Critical red `#C43D32` — threshold breach / worsening high risk;
- Watch amber `#B97512` — approaching threshold / review due;
- Recovery teal `#17796F` — improving risk / resolved signal;
- Data-violet `#7556B2` — model/scenario series only when a fourth series is necessary.

Red never means a negative business outcome in one chart and a generic highlight in another. Amber is not used decoratively. Text and icons accompany every semantic color, and light tints maintain WCAG contrast for labels.

## 12. Typography

- **Manrope Variable:** navigation, labels, titles, explanatory text. It is compact and contemporary without the startup-marketing character of oversized geometric display type.
- **JetBrains Mono Variable:** loan IDs, timestamps, model versions, percentages, currency, deltas, and compact table metadata.

Scale: 28 px page title; 20 px section title; 16 px surface title; 14 px body/control; 12 px label/table metadata; 11 px eyebrow. Line heights are 1.2 for headings and 1.45–1.55 for body text. Numerals use `font-variant-numeric: tabular-nums`. Sentence case is used throughout.

## 13. Responsive behavior

### 1280 px and above

Persistent 232 px rail, full context bar, four-metric row, 2:1 analysis split, visible table columns, and optional sticky decision rail on the Digital Twin.

### 768–1279 px

Rail can collapse to icons; portfolio/model controls condense; metrics become a 2×2 grid; analysis stacks; less important table columns hide by default but remain available in column controls; the quick-view sheet uses 44–52% width.

### Below 768 px

Navigation and filter controls move to drawers. Metrics become a vertical two-column or one-column sequence depending on available width. Charts use reduced axis ticks and a 240–280 px height. The queue keeps a true horizontally scrollable table with sticky identity and status; it does not become a pile of cards that removes comparison. Digital Twin actions move into a sticky bottom action bar, the risk spine becomes two columns, and each major evidence group becomes an accessible accordion. AI recommendation appears after “What changed,” never before it.

Touch targets are at least 44 px when controls are not part of the dense desktop table. No critical information depends on hover.

## 14. Prototype acceptance criteria

The prototype is coherent when a new reviewer can answer within five seconds:

- which portfolio/date/model they are viewing;
- whether risk is worsening;
- the scale of exposure and expected loss;
- which loans require review;
- why the top loan moved;
- where to inspect evidence and record a decision.

Visual inspection must also confirm: no unnecessary card mosaic, no clipped data at common laptop widths, charts answer explicit questions, tables remain keyboard-usable, risk color is semantic, the mobile layout preserves comparison, and AI appears as a cited recommendation rather than the application’s center of gravity.
