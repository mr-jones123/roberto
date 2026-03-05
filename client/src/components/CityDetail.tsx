import { useState, type JSX } from "react"
import { scoreColor, scoreLabel, formatPercent, formatPercentRaw, formatPHP } from "../lib/colors"
import type { City, Project } from "../lib/types"
import { AIAnalysis } from "./AIAnalysis"

type Props = {
  city: City
  projects: Project[]
  onClose: () => void
}

type SortKey = "progress" | "budget"
type SortDir = "asc" | "desc"

export function CityDetail({ city, projects, onClose }: Props): JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>("progress")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1
    return (a[sortKey] - b[sortKey]) * mul
  })

  const statusEntries = Object.entries(city.status_breakdown)
  const totalStatusCount = statusEntries.reduce((s, [, v]) => s + v, 0)

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <h2 className="text-lg font-semibold">{city.name}</h2>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="text-3xl font-bold"
              style={{ color: scoreColor(city.effective_coverage_score) }}
            >
              {formatPercent(city.effective_coverage_score)}
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: scoreColor(city.effective_coverage_score) + "20",
                color: scoreColor(city.effective_coverage_score),
              }}
            >
              {scoreLabel(city.effective_coverage_score)}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <MetricCard label="Effective Coverage" value={formatPercent(city.effective_coverage_score)} />
            <MetricCard label="Raw Coverage" value={formatPercent(city.raw_coverage_ratio)} />
            <MetricCard label="Avg Progress" value={formatPercentRaw(city.avg_progress)} />
            <MetricCard label="High Hazard Area" value={`${city.total_high_hazard_area_km2.toFixed(2)} km²`} />
            <MetricCard label="Covered Area" value={`${city.raw_covered_area_km2.toFixed(2)} km²`} />
            <MetricCard label="Total Projects" value={city.project_count.toString()} />
            <div className="col-span-2">
              <MetricCard label="Total Budget" value={formatPHP(city.budget_total_php)} />
            </div>
          </div>

          {statusEntries.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Project Status
              </h3>
              <div className="flex h-3 overflow-hidden rounded-full bg-[#0f172a]">
                {statusEntries.map(([status, count]) => (
                  <div
                    key={status}
                    className="h-full"
                    style={{
                      width: `${(count / totalStatusCount) * 100}%`,
                      backgroundColor: status === "Completed" ? "#22c55e" : status === "On-Going" ? "#3b82f6" : "#94a3b8",
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {statusEntries.map(([status, count]) => (
                  <span key={status} className="text-xs text-slate-400">
                    <span
                      className="mr-1 inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: status === "Completed" ? "#22c55e" : status === "On-Going" ? "#3b82f6" : "#94a3b8",
                      }}
                    />
                    {status}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              AI Analysis
            </h3>
            <AIAnalysis cityId={city.id} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Projects ({projects.length})
            </h3>
            <div className="max-h-64 overflow-auto rounded-lg border border-[#334155]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0f172a] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th
                      className="cursor-pointer px-3 py-2 font-medium hover:text-slate-200"
                      onClick={() => toggleSort("progress")}
                    >
                      Progress {sortKey === "progress" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                    <th
                      className="cursor-pointer px-3 py-2 font-medium hover:text-slate-200"
                      onClick={() => toggleSort("budget")}
                    >
                      Budget {sortKey === "budget" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProjects.map((p) => (
                    <tr key={p.id} className="border-t border-[#334155]/50 hover:bg-[#334155]/30">
                      <td className="max-w-[160px] truncate px-3 py-2 text-slate-300" title={p.name}>
                        {p.name}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: p.status === "Completed" ? "#22c55e20" : "#3b82f620",
                            color: p.status === "Completed" ? "#22c55e" : "#3b82f6",
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-300">{p.progress.toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{formatPHP(p.budget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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
