import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

function isPublicPath(pathname: string) {
  return pathname === "/api/health"
    || pathname === "/api/ready"
    || pathname === "/sign-in"
    || pathname.startsWith("/sign-in/")
    || pathname === "/sign-up"
    || pathname.startsWith("/sign-up/");
}

const configured = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const protectedProxy = clerkMiddleware(async (auth, request) => {
  if (process.env.APP_MODE === "production" && !isPublicPath(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

function unconfiguredProxy(request: NextRequest) {
  if (process.env.APP_MODE !== "production" || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Identity provider is not configured" },
      { status: 503 },
    );
  }

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("reason", "identity-configuration");
  return NextResponse.redirect(signInUrl);
}

export default configured
  ? protectedProxy
  : unconfiguredProxy;

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api)(.*)"],
};
