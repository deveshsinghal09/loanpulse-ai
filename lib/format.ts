export function formatMoneyCompact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const compact = (scaled: number, suffix: string) =>
    `${sign}₹${scaled.toFixed(1).replace(/\.0$/, "")}${suffix}`;

  if (absolute >= 10_000_000) return compact(absolute / 10_000_000, "Cr");
  if (absolute >= 100_000) return compact(absolute / 100_000, "L");
  if (absolute >= 1_000) return compact(absolute / 1_000, "K");
  return `${sign}₹${Math.round(absolute)}`;
}

export const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function percentagePoints(value: number) {
  const points = value * 100;
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)} pp`;
}
