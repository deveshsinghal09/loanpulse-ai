"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="app-error"><span>LoanPulse AI</span><h1>We could not load this workspace.</h1><p>The issue has been isolated from your saved review data. Try the route again.</p><button className="primary-button" onClick={() => reset()} type="button">Try again</button></main>;
}
