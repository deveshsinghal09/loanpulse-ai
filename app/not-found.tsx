import Link from "next/link";

export default function NotFoundPage() {
  return <main className="app-error"><span>LoanPulse AI</span><h1>This workspace is not available.</h1><p>The route may be invalid, or the requested loan is no longer in the active demonstration portfolio.</p><Link className="primary-button" href="/">Return to command center</Link></main>;
}
