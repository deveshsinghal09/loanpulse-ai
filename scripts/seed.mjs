import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL before seeding.");
const sql = neon(connectionString);
const orgSlug = process.env.DEFAULT_ORGANIZATION_SLUG || "northstar-ventures";
const loans = [
  ["LP-10482","Aster Components","Industrial","Midwest",2460000,.612,.481,98,"high",false,19,"A. Rivera","Payment coverage fell 22%","Debt service coverage 0.91×"],
  ["LP-10317","Juniper Health Group","Healthcare","Southeast",1920000,.447,.348,91,"medium",false,0,"M. Chen","Two moderate signals combined","DTI rose from 44% to 53%"],
  ["LP-10901","Cobalt Freight","Transport","Southwest",1480000,.391,.296,96,"high",true,0,"N. Shah","Utilization breached 85%","Revolver utilization 88%"],
  ["LP-10144","Harborline Foods","Consumer","Northeast",2210000,.338,.322,72,"low",false,4,"L. Walker","Outside training distribution","Unusual balance expansion"],
  ["LP-10856","Meridian Field Services","Business services","Mountain",1130000,.284,.191,88,"medium",true,0,"K. Johnson","Risk velocity accelerated","Payment variance +31%"],
  ["LP-10663","Northwind Packaging","Industrial","Midwest",960000,.218,.137,79,"high",true,11,"R. Patel","DPD crossed watch threshold","Recent DPD reached 11"],
  ["LP-10528","Solis Dental Partners","Healthcare","Southwest",1650000,.174,.192,43,"high",true,0,"A. Gomez","Payment momentum improved","Three on-time payments"],
  ["LP-10206","Redwood Learning","Education","West",740000,.143,.109,67,"medium",true,0,"S. Lewis","Coverage ratio declined","Payment-to-income 28%"],
  ["LP-10739","Verdant Home Supply","Retail","Southeast",1340000,.087,.096,52,"high",true,0,"T. Brooks","Risk returned to baseline","Balance decay normalized"],
  ["LP-10072","Blue Oak Hospitality","Hospitality","West",2730000,.263,.241,84,"high",true,0,"D. Kim","Revenue trend weakened","Income trend -14%"]
];

const [organization] = await sql`INSERT INTO organizations (slug,name) VALUES (${orgSlug},'Northstar Ventures')
  ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`;
const [portfolio] = await sql`INSERT INTO portfolios
  (organization_id,slug,name,as_of,model_version,data_freshness,data_health)
  VALUES (${organization.id},'northstar-2026','Northstar 2026 — Mid-market','2026-08-25T09:42:00Z','PD v3.4 · isotonic','Updated 42 min ago',.94)
  ON CONFLICT (organization_id,slug) DO UPDATE SET as_of=EXCLUDED.as_of,model_version=EXCLUDED.model_version RETURNING id`;
for (const [externalId,borrower,segment,region,exposure,pd,previousPd,anomaly,confidence,agreement,dpd,officer,signal,driver] of loans) {
  const [loan] = await sql`INSERT INTO loans
    (organization_id,portfolio_id,external_id,borrower,segment,region,exposure,officer,days_past_due)
    VALUES (${organization.id},${portfolio.id},${externalId},${borrower},${segment},${region},${exposure},${officer},${dpd})
    ON CONFLICT (organization_id,external_id) DO UPDATE SET borrower=EXCLUDED.borrower,exposure=EXCLUDED.exposure,updated_at=now() RETURNING id`;
  await sql`INSERT INTO risk_snapshots
    (organization_id,loan_id,observed_at,calibrated_pd,raw_pd,previous_pd,expected_loss,anomaly_percentile,confidence,model_agreement,model_version,last_signal,top_driver)
    VALUES (${organization.id},${loan.id},'2026-08-25T09:42:00Z',${pd},${Math.min(.999,pd*1.036)},${previousPd},${pd*.45*exposure},${anomaly},${confidence},${agreement},'PD v3.4',${signal},${driver})
    ON CONFLICT (loan_id,observed_at,model_version) DO NOTHING`;
}
console.log(`seeded ${loans.length} loans for ${orgSlug}`);
