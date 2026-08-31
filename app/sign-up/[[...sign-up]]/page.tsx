import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  const configured = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return <main className="auth-page"><section className="auth-intro"><Link href="/" className="auth-brand"><i /> LoanPulse</Link><span>Controlled access</span><h1>Join the review team.</h1><p>New identities receive the reviewer role by default. Administrators can elevate permissions after verification.</p></section><section className="auth-panel">{configured ? <SignUp /> : <div className="auth-unconfigured"><span>Identity not configured</span><h2>Complete Clerk setup first</h2><p>The application remains in demonstration mode until identity credentials are present.</p><Link className="primary-button" href="/system-status">View setup checklist</Link></div>}</section></main>;
}
