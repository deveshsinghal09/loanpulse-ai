import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL before running migrations.");
const sql = neon(connectionString);
const directory = join(process.cwd(), "db", "migrations");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      current += character;
      if (character === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      current += character;
      if (character === "*" && next === "/") {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += character;
      }
      continue;
    }

    if (!singleQuoted && !doubleQuoted && character === "-" && next === "-") {
      current += character + next;
      index += 1;
      lineComment = true;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && character === "/" && next === "*") {
      current += character + next;
      index += 1;
      blockComment = true;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && character === "$") {
      const match = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length - 1;
        continue;
      }
    }

    if (!doubleQuoted && character === "'") {
      if (singleQuoted && next === "'") {
        current += character + next;
        index += 1;
        continue;
      }
      singleQuoted = !singleQuoted;
    } else if (!singleQuoted && character === '"') {
      if (doubleQuoted && next === '"') {
        current += character + next;
        index += 1;
        continue;
      }
      doubleQuoted = !doubleQuoted;
    }

    if (!singleQuoted && !doubleQuoted && character === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

await sql.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
for (const filename of files) {
  const applied = await sql`SELECT 1 FROM schema_migrations WHERE filename=${filename}`;
  if (applied.length) { console.log(`skip ${filename}`); continue; }
  const statements = splitSqlStatements(await readFile(join(directory, filename), "utf8"));
  await sql.transaction([
    ...statements.map((statement) => sql`${sql.unsafe(statement)}`),
    sql`INSERT INTO schema_migrations (filename) VALUES (${filename})`,
  ]);
  console.log(`applied ${filename}`);
}
