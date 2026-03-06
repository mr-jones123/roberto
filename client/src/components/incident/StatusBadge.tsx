import type { JSX } from "react"

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  PING: { bg: "bg-amber-500/15", text: "text-amber-400" },
  VERIFIED: { bg: "bg-blue-500/15", text: "text-blue-400" },
  PRIORITIZED: { bg: "bg-orange-500/15", text: "text-orange-400" },
  ASSIGNED: { bg: "bg-purple-500/15", text: "text-purple-400" },
  RESOLVED: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  REJECTED: { bg: "bg-red-500/15", text: "text-red-400" },
  STOOD_DOWN: { bg: "bg-slate-500/15", text: "text-slate-400" },
}

const FALLBACK = { bg: "bg-slate-500/15", text: "text-slate-400" }

type Props = {
  status: string
  "data-testid"?: string
}

export function StatusBadge({ status, "data-testid": testId }: Props): JSX.Element {
  const style = STATUS_STYLES[status] ?? FALLBACK
  return (
    <span
      data-testid={testId}
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.bg} ${style.text}`}
    >
      {status}
    </span>
  )
}
