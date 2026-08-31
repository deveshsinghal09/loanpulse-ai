import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL before running migrations.");
const sql = neon(connectionString);
const directory = join(process.cwd(), "db", "migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

await sql.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
for (const filename of files) {
  const applied = await sql`SELECT 1 FROM schema_migrations WHERE filename=${filename}`;
  if (applied.length) { console.log(`skip ${filename}`); continue; }
  await sql.query(await readFile(join(directory, filename), "utf8"));
  await sql`INSERT INTO schema_migrations (filename) VALUES (${filename})`;
  console.log(`applied ${filename}`);
}
