"use client";

import { Bot, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Navigation } from "./navigation";
import { TopContextBar } from "./top-context-bar";
import { RiskFieldVisual } from "./risk-field-visual";
import { portfolioSummary } from "@/lib/demo-data";

type Message = { role: "user" | "assistant" | "system"; text: string };

export function ReviewerCopilot() {
  const [query, setQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: "Ask about Aster Components’ risk, evidence gaps, scenario results, or review priorities. I will keep the recommendation advisory and cite the supplied context." }]);
  const [sending, setSending] = useState(false);
  const send = async () => {
    const text = prompt.trim();
    if (!text || sending) return;
    setPrompt(""); setMessages((current) => [...current, { role: "user", text }]); setSending(true);
    try {
      const response = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const result = await response.json().catch(() => ({ error: "Reviewer Copilot did not receive a readable server response. Please try once more." })) as { text?: string; error?: string; configured?: boolean; retryable?: boolean };
      setMessages((current) => [...current, { role: result.configured === false || !response.ok ? "system" : "assistant", text: result.text ?? result.error ?? "The copilot did not return a response." }]);
    } catch { setMessages((current) => [...current, { role: "system", text: "Reviewer Copilot could not reach LoanPulse. Check your connection and try again." }]); }
    finally { setSending(false); }
  };
  return <div className="app-shell"><Navigation /><div className="app-stage"><TopContextBar onQueryChange={setQuery} query={query} searchRef={{ current: null }} summary={portfolioSummary} /><main className="dashboard-main workspace-main"><div className="workspace-heading workspace-hero is-copilot"><div className="workspace-hero-copy"><span className="eyebrow">Human-in-the-loop analysis</span><h1>Reviewer copilot</h1><p>Gemini is called only from the server after you add <code>GEMINI_API_KEY</code> to <code>.env.local</code>.</p><span className="copilot-guardrail"><ShieldCheck size={14} /> Advisory only</span></div><RiskFieldVisual compact label="Evidence context" value="Aster · P98" /></div><section className="copilot-layout"><div className="panel copilot-conversation"><div className="copilot-context"><Bot size={17} /><div><strong>Aster Components · LP-10482</strong><span>PD 61.2% · expected loss ₹6.77L · reviewer required</span></div></div><div className="copilot-messages" aria-live="polite">{messages.map((message, index) => <article className={`copilot-message is-${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "user" ? "You" : message.role === "system" ? "Setup" : "Copilot"}</span><p>{message.text}</p></article>)}{sending ? <article className="copilot-message is-assistant"><span>Copilot</span><p>Reviewing the supplied risk context…</p></article> : null}</div><form className="copilot-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea onChange={(event) => setPrompt(event.target.value)} placeholder="For example: What evidence should I request before changing facility terms?" rows={3} value={prompt} /><button className="primary-button" disabled={!prompt.trim() || sending} type="submit"><Send size={14} /> Send</button></form></div><aside className="panel copilot-side"><div><Sparkles size={16} /><h2>Gemini setup</h2><p>1. Create <code>.env.local</code> in the project root.<br />2. Add <code>GEMINI_API_KEY=your_key</code>.<br />3. Restart <code>npm run dev</code>.</p></div><div><h3>Guardrails</h3><ul><li>Key stays server-side.</li><li>No automatic lending decisions.</li><li>Model output requires reviewer validation.</li></ul></div></aside></section></main></div></div>;
}
