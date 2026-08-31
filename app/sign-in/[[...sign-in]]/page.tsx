import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  const configured = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return <main className="auth-page"><section className="auth-intro"><Link href="/" className="auth-brand"><i /> LoanPulse</Link><span>Secure reviewer workspace</span><h1>Evidence before action.</h1><p>Sign in to access organization-scoped loan surveillance, reviewer decisions, and immutable audit history.</p><div className="auth-proof"><strong>Human review enforced</strong><small>Model output remains advisory at every risk threshold.</small></div></section><section className="auth-panel">{configured ? <SignIn /> : <div className="auth-unconfigured"><span>Identity not configured</span><h2>Add Clerk credentials</h2><p>Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> in <code>.env.local</code>, then restart the server.</p><Link className="primary-button" href="/system-status">View system status</Link></div>}</section></main>;
}
