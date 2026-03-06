import { useEffect, useState, type JSX } from "react"
import { fetchKpi } from "../../lib/api"
import type { KpiResponse } from "../../lib/types"

type Props = {
  token: string
}

function formatMs(ms: number | null): string {
  if (ms === null) return "\u2014"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-[#334155]/60 bg-[#0f172a]/60 px-3 py-2.5">
      <p className="text-lg font-bold tabular-nums text-slate-100">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p>}
    </div>
  )
}

export function KpiDashboard({ token }: Props): JSX.Element {
  const [kpi, setKpi] = useState<KpiResponse | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetchKpi(token).then(setKpi).catch(() => {})
  }, [token])

  if (!kpi) {
    return (
      <div className="border-b border-[#334155] px-4 py-3">
        <p className="text-[10px] text-slate-600">Loading metrics...</p>
      </div>
    )
  }

  const statusEntries = Object.entries(kpi.by_status).sort(([, a], [, b]) => b - a)

  return (
    <div className="border-b border-[#334155]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[#334155]/20"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Response Metrics
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-slate-600 transition-transform ${collapsed ? "" : "rotate-180"}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="Total Incidents" value={String(kpi.total_incidents)} />
            <KpiCard label="Resolution Rate" value={`${kpi.resolution_rate}%`} />
            <KpiCard label="Avg Ack Time" value={formatMs(kpi.avg_acknowledge_time_ms)} sub="PING → VERIFIED" />
            <KpiCard label="Avg Assign Latency" value={formatMs(kpi.avg_assignment_latency_ms)} sub="VERIFIED → ASSIGNED" />
            <KpiCard label="Avg Resolution" value={formatMs(kpi.avg_resolution_time_ms)} sub="PING → RESOLVED" />
            <div className="rounded-lg border border-[#334155]/60 bg-[#0f172a]/60 px-3 py-2.5">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {statusEntries.map(([status, count]) => (
                  <div key={status} className="flex items-center gap-1">
                    <span className="text-xs font-bold tabular-nums text-slate-200">{count}</span>
                    <span className="text-[9px] text-slate-500">{status}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">By Status</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
