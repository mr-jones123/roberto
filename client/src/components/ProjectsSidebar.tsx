import type { JSX } from "react"
import { formatPHP } from "../lib/colors"
import type { City, Project } from "../lib/types"
import { useLocale } from "../lib/locale"

type Props = {
  projects: Project[]
  cities: City[]
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  Completed: "#22c55e",
  "On-Going": "#3b82f6",
  "Not Yet Started": "#94a3b8",
}

export function ProjectsSidebar({ projects, cities, onClose }: Props): JSX.Element {
  const { t } = useLocale()
  const statusCounts: Record<string, number> = {}
  let totalBudget = 0
  let totalProgress = 0

  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1
    totalBudget += p.budget
    totalProgress += p.progress
  }

  const avgProgress = projects.length > 0 ? totalProgress / projects.length : 0
  const statusEntries = Object.entries(statusCounts)
  const totalCount = projects.length

  const sortedCities = [...cities].sort((a, b) => b.project_count - a.project_count)

  const projectStatusLabel = (status: string): string => {
    if (status === "Completed") return t("status.completed")
    if (status === "On-Going") return t("status.onGoing")
    if (status === "Not Yet Started") return t("status.notYetStarted")
    return status
  }

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t("projects.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {totalCount.toLocaleString()} {t("projects.label")} &middot; {formatPHP(totalBudget)}
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
          <MetricCard label={t("projects.totalProjects")} value={totalCount.toLocaleString()} />
          <MetricCard label={t("projects.avgCompletion")} value={`${avgProgress.toFixed(1)}%`} />
          <div className="col-span-2">
            <MetricCard label={t("projects.totalBudget")} value={formatPHP(totalBudget)} />
          </div>
        </div>
      </div>

      <div className="border-b border-[#334155] px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t("projects.statusBreakdown")}
        </h3>
        {totalCount > 0 && (
          <div className="flex h-3 overflow-hidden rounded-full bg-[#0f172a]">
            {statusEntries.map(([status, count]) => (
              <div
                key={status}
                className="h-full"
                style={{
                  width: `${(count / totalCount) * 100}%`,
                  backgroundColor: STATUS_COLORS[status] ?? "#64748b",
                }}
              />
            ))}
          </div>
        )}
        <div className="mt-2 space-y-1.5">
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[status] ?? "#64748b" }}
                />
                <span className="text-xs text-slate-400">{projectStatusLabel(status)}</span>
              </div>
              <span className="text-xs font-mono text-slate-300">
                {count.toLocaleString()} ({((count / totalCount) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("projects.byCity")}
          </h3>
        </div>
        {sortedCities.map((city, i) => (
          <div
            key={city.id}
            className="flex items-center gap-3 border-b border-[#334155]/50 px-4 py-2.5"
          >
            <span className="text-xs text-slate-500 w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{city.name}</p>
              <p className="text-[10px] text-slate-500">{formatPHP(city.budget_total_php)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-slate-300">{city.project_count}</p>
              <p className="text-[10px] text-slate-500">{t("projects.label")}</p>
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
