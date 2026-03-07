import type { JSX } from "react"

export function LayerToggle({ label, active, onToggle, color, "data-testid": testId }: {
  label: string
  active: boolean
  onToggle: () => void
  color: string
  "data-testid"?: string
}): JSX.Element {
  return (
    <button
      onClick={onToggle}
      data-testid={testId}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-transparent bg-white/10 text-slate-200"
          : "border-[#334155] text-slate-500 hover:text-slate-300"
      }`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active ? color : "#475569" }} />
      {label}
    </button>
  )
}
