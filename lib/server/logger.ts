import "server-only";
import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, string | number | boolean | null | undefined>;

function write(level: LogLevel, event: string, fields: LogFields = {}) {
  const payload = { timestamp: new Date().toISOString(), level, event, ...fields };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};

export function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? randomUUID();
}
