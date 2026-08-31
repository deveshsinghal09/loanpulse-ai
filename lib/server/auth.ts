import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { appMode, isClerkConfigured, isDatabaseConfigured } from "./config";
import { getDatabase } from "./db";

export type ActorRole = "admin" | "reviewer" | "analyst" | "viewer";
export type AppActor = {
  id: string;
  externalId: string;
  organizationId: string;
  organizationSlug: string;
  name: string;
  email: string;
  role: ActorRole;
  demo: boolean;
};

const demoActor: AppActor = {
  id: "demo-reviewer", externalId: "demo-reviewer", organizationId: "demo-organization",
  organizationSlug: "northstar-ventures", name: "A. Rivera", email: "reviewer@loanpulse.demo",
  role: "reviewer", demo: true,
};

function defaultRole(email: string): ActorRole {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase()) ? "admin" : "reviewer";
}

export const getActor = cache(async (): Promise<AppActor | null> => {
  if (!isClerkConfigured()) return appMode() === "demo" ? demoActor : null;
  const { userId } = await auth();
  // Demo mode stays fully interactive even when development Clerk keys are
  // present but the reviewer has not signed in yet. Production still fails
  // closed and requires a real session.
  if (!userId) return appMode() === "demo" ? demoActor : null;
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "unknown@unconfigured.local";
  const name = clerkUser?.fullName ?? clerkUser?.username ?? email.split("@")[0];
  if (!isDatabaseConfigured()) {
    return appMode() === "demo"
      ? { ...demoActor, externalId: userId, email, name }
      : null;
  }

  const sql = getDatabase();
  const slug = process.env.DEFAULT_ORGANIZATION_SLUG ?? "northstar-ventures";
  const role = defaultRole(email);
  const rows = await sql`
    WITH selected_org AS (
      SELECT id, slug FROM organizations WHERE slug=${slug}
    ), upsert_user AS (
      INSERT INTO app_users (clerk_user_id,email,display_name,last_seen_at)
      VALUES (${userId},${email},${name},now())
      ON CONFLICT (clerk_user_id) DO UPDATE SET email=EXCLUDED.email,display_name=EXCLUDED.display_name,last_seen_at=now()
      RETURNING id,clerk_user_id,email,display_name
    ), ensure_membership AS (
      INSERT INTO organization_memberships (organization_id,user_id,role)
      SELECT selected_org.id,upsert_user.id,${role} FROM selected_org,upsert_user
      ON CONFLICT (organization_id,user_id) DO NOTHING
    )
    SELECT u.id,u.clerk_user_id,u.email,u.display_name,o.id AS organization_id,o.slug,m.role
    FROM app_users u JOIN organization_memberships m ON m.user_id=u.id
    JOIN organizations o ON o.id=m.organization_id
    WHERE u.clerk_user_id=${userId} AND o.slug=${slug} AND u.status='active'
  ` as Array<Record<string, unknown>>;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id), externalId: String(row.clerk_user_id), organizationId: String(row.organization_id),
    organizationSlug: String(row.slug), name: String(row.display_name), email: String(row.email),
    role: String(row.role) as ActorRole, demo: false,
  };
});

export class AuthorizationError extends Error {
  status: number;
  constructor(status: 401 | 403, message: string) { super(message); this.name = "AuthorizationError"; this.status = status; }
}

export async function requireActor(roles?: ActorRole[]) {
  const actor = await getActor();
  if (!actor) throw new AuthorizationError(401, "Authentication required");
  if (roles && !roles.includes(actor.role)) throw new AuthorizationError(403, "Your role cannot perform this action");
  return actor;
}
