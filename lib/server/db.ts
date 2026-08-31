import "server-only";
import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

export class DatabaseUnavailableError extends Error {
  constructor(message = "Database is not configured") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export function getDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseUnavailableError();
  client ??= neon(url);
  return client;
}

export async function checkDatabase() {
  const started = performance.now();
  try {
    const sql = getDatabase();
    await sql`SELECT 1 AS ok`;
    return { ok: true as const, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false as const, latencyMs: Math.round(performance.now() - started) };
  }
}
