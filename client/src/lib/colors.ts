export function scoreColor(score: number): string {
  if (score < 0.3) return "#ef4444"
  if (score < 0.5) return "#f97316"
  if (score < 0.7) return "#eab308"
  if (score < 0.85) return "#22c55e"
  return "#10b981"
}

export function scoreLabel(score: number): string {
  if (score < 0.3) return "Critical"
  if (score < 0.5) return "Poor"
  if (score < 0.7) return "Moderate"
  if (score < 0.85) return "Good"
  return "Excellent"
}

export function formatPHP(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatPercentRaw(value: number): string {
  return `${value.toFixed(1)}%`
}
