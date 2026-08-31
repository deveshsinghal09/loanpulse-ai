"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { CircleUserRound } from "lucide-react";
import Link from "next/link";

function ClerkControls() {
  return (
    <>
      <Show when="signed-out"><SignInButton mode="modal"><button className="session-button" type="button"><CircleUserRound size={15} /> Sign in</button></SignInButton></Show>
      <Show when="signed-in"><div className="clerk-user-control"><UserButton /></div></Show>
    </>
  );
}

export function AuthControls() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <div className="auth-controls">
      {configured ? (
        <ClerkControls />
      ) : (
        <Link className="session-button session-setup-button" href="/sign-in" title="Configure production sign in">
          <CircleUserRound size={15} /> Set up sign in
        </Link>
      )}
    </div>
  );
}
