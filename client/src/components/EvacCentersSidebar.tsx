import type { JSX } from "react"
import type { EvacCenterRow } from "../lib/types"

type Props = {
  evacCenters: EvacCenterRow[]
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  evacuation_center: "Evacuation Center",
  school: "School",
  hospital: "Hospital",
  fire_station: "Fire Station",
  police_station: "Police Station",
}

const STATUS_COLORS: Record<string, string> = {
  open: "#22c55e",
  full: "#f97316",
  closed: "#ef4444",
}

export function EvacCentersSidebar({ evacCenters, onClose }: Props): JSX.Element {
  const statusCounts: Record<string, number> = { open: 0, full: 0, closed: 0 }
  const typeCounts: Record<string, number> = {}
  let totalCapacity = 0
  let totalLoad = 0

  for (const center of evacCenters) {
    statusCounts[center.status] = (statusCounts[center.status] ?? 0) + 1
    typeCounts[center.type] = (typeCounts[center.type] ?? 0) + 1
    totalCapacity += center.capacity ?? 0
    totalLoad += center.current_load
  }

  const occupancyRate = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0
  const statusEntries = Object.entries(statusCounts).filter(([, count]) => count > 0)
  const typeEntries = Object.entries(typeCounts).sort(([, a], [, b]) => b - a)

  const sortedCenters = [...evacCenters].sort((a, b) => {
    if (a.status !== b.status) {
      const order: Record<string, number> = { open: 0, full: 1, closed: 2 }
      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
    }
    return b.current_load - a.current_load
  })

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Evacuation Centers
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {evacCenters.length} centers &middot; {statusCounts.open} open
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="border-b border-[#334155] px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Total Capacity" value={totalCapacity.toLocaleString()} />
          <MetricCard label="Current Load" value={totalLoad.toLocaleString()} />
          <div className="col-span-2 rounded-lg bg-[#0f172a] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Occupancy Rate</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-[#1e293b] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(occupancyRate, 100)}%`,
                    backgroundColor:
                      occupancyRate > 80 ? "#ef4444" : occupancyRate > 50 ? "#f97316" : "#22c55e",
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-200">
                {occupancyRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[#334155] px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Availability
        </h3>
        <div className="space-y-1.5">
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[status] ?? "#64748b" }}
              />
              <span className="flex-1 text-xs text-slate-400 capitalize">{status}</span>
              <span className="text-xs font-mono text-slate-300">{count}</span>
            </div>
          ))}
        </div>

        <h3 className="mt-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          By Type
        </h3>
        <div className="space-y-1.5">
          {typeEntries.map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-xs text-slate-400">{TYPE_LABELS[type] ?? type}</span>
              <span className="text-xs font-mono text-slate-300">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            All Centers
          </h3>
        </div>
        {sortedCenters.map((center) => (
          <div
            key={center.id}
            className="border-b border-[#334155]/50 px-4 py-2.5"
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[center.status] ?? "#64748b" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{center.name}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">
                    {TYPE_LABELS[center.type] ?? center.type}
                  </span>
                  {center.capacity != null && (
                    <span className="text-[10px] text-slate-500">
                      &middot; {center.current_load}/{center.capacity}
                    </span>
                  )}
                </div>
              </div>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
                style={{
                  backgroundColor: (STATUS_COLORS[center.status] ?? "#64748b") + "20",
                  color: STATUS_COLORS[center.status] ?? "#64748b",
                }}
              >
                {center.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#0f172a] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  )
}
