import Image from "next/image";

export function RiskFieldVisual({
  compact = false,
  label = "Portfolio topology",
  value = "37 live signals",
}: {
  compact?: boolean;
  label?: string;
  value?: string;
}) {
  return (
    <figure className={`risk-field-visual${compact ? " is-compact" : ""}`} aria-label={`${label}: ${value}`}>
      <Image
        alt=""
        className="risk-field-image"
        fill
        loading="eager"
        priority={!compact}
        sizes={compact ? "(max-width: 760px) 100vw, 36vw" : "(max-width: 1100px) 100vw, 50vw"}
        src="/loanpulse-risk-field.png"
      />
      <div className="risk-field-shade" />
      <div className="risk-field-scan" />
      <span className="risk-node node-a" />
      <span className="risk-node node-b" />
      <span className="risk-node node-c" />
      <figcaption>
        <span>{label}</span>
        <strong>{value}</strong>
        <small><i /> Model and evidence layers synchronized</small>
      </figcaption>
    </figure>
  );
}
