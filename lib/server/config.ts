import "server-only";

export type AppMode = "demo" | "production";

export function appMode(): AppMode {
  return process.env.APP_MODE === "production" ? "production" : "demo";
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isClerkConfigured() {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

export function isMlServiceConfigured() {
  return Boolean(process.env.ML_SERVICE_URL && process.env.ML_SERVICE_API_KEY);
}

export function publicOperatingMode() {
  return {
    mode: appMode(),
    database: isDatabaseConfigured(),
    identity: isClerkConfigured(),
    copilot: isGeminiConfigured(),
    mlService: isMlServiceConfigured(),
  };
}

export function assertProductionConfiguration() {
  if (appMode() !== "production") return;
  const missing = [
    !isDatabaseConfigured() ? "DATABASE_URL" : null,
    !isClerkConfigured() ? "Clerk keys" : null,
    !process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY ? "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" : null,
  ].filter(Boolean);
  if (missing.length) throw new Error(`Production configuration is incomplete: ${missing.join(", ")}`);
}
