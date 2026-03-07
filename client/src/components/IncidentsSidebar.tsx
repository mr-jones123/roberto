import type { JSX } from "react"
import type { IncidentRow } from "../lib/types"
import { useLocale } from "../lib/locale"

type Props = {
  incidents: IncidentRow[]
  onSelectIncident?: (incident: IncidentRow) => void
  onClose: () => void
}

const STATUS_COLORS: Record<string, string> = {
  PING: "#f59e0b",
  VERIFIED: "#3b82f6",
  PRIORITIZED: "#8b5cf6",
  ASSIGNED: "#06b6d4",
  RESOLVED: "#22c55e",
  REJECTED: "#ef4444",
  STOOD_DOWN: "#64748b",
  DUPLICATE: "#94a3b8",
}

const ACTIVE_STATUSES = new Set(["PING", "VERIFIED", "PRIORITIZED", "ASSIGNED"])

export function IncidentsSidebar({ incidents, onSelectIncident, onClose }: Props): JSX.Element {
  const { t, locale } = useLocale()
  const statusCounts: Record<string, number> = {}
  for (const inc of incidents) {
    statusCounts[inc.status] = (statusCounts[inc.status] ?? 0) + 1
  }

  const activeCount = incidents.filter((i) => ACTIVE_STATUSES.has(i.status)).length
  const resolvedCount = statusCounts["RESOLVED"] ?? 0
  const resolutionRate =
    incidents.length > 0 ? ((resolvedCount / incidents.length) * 100).toFixed(1) : "0.0"

  const recentIncidents = [...incidents]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 15)

  const statusEntries = Object.entries(statusCounts).sort(([, a], [, b]) => b - a)

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t("incidents.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {incidents.length} {t("incidents.total").toLowerCase()} &middot; {activeCount} {t("incidents.active").toLowerCase()}
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
        <div className="grid grid-cols-3 gap-2">
          <MetricCard label={t("incidents.total")} value={incidents.length.toString()} />
          <MetricCard label={t("incidents.active")} value={activeCount.toString()} accent="#f59e0b" />
          <MetricCard label={t("incidents.resolved")} value={resolvedCount.toString()} accent="#22c55e" />
          <div className="col-span-3">
            <MetricCard label={t("incidents.resolutionRate")} value={`${resolutionRate}%`} />
          </div>
        </div>
      </div>

      <div className="border-b border-[#334155] px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t("incidents.byStatus")}
        </h3>
        <div className="space-y-1.5">
          {statusEntries.map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[status] ?? "#64748b" }}
              />
              <span className="flex-1 text-xs text-slate-400">{status}</span>
              <span className="text-xs font-mono text-slate-300">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("incidents.recentActivity")}
          </h3>
        </div>
        {recentIncidents.length === 0 ? (
          <p className="px-4 text-xs text-slate-500">{t("incidents.noIncidents")}</p>
        ) : (
          recentIncidents.map((inc) => (
            <button
              key={inc.id}
              type="button"
              onClick={() => onSelectIncident?.(inc)}
              className="w-full border-b border-[#334155]/50 px-4 py-2.5 text-left transition-colors hover:bg-[#334155]/40"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[inc.status] ?? "#64748b" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{inc.title}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: (STATUS_COLORS[inc.status] ?? "#64748b") + "20",
                        color: STATUS_COLORS[inc.status] ?? "#64748b",
                      }}
                    >
                      {inc.status}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatRelativeTime(inc.updated_at, t, locale)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-lg bg-[#0f172a] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold" style={{ color: accent ?? "#e2e8f0" }}>
        {value}
      </p>
    </div>
  )
}

function formatRelativeTime(dateStr: string, t: (key: string) => string, locale: "en" | "tl"): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t("incidents.justNow")
  if (minutes < 60) return locale === "tl" ? `${minutes} ${t("incidents.minutesAgo")}` : `${minutes}${t("incidents.minutesAgo")}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return locale === "tl" ? `${hours} ${t("incidents.hoursAgo")}` : `${hours}${t("incidents.hoursAgo")}`
  const days = Math.floor(hours / 24)
  return locale === "tl" ? `${days} ${t("incidents.daysAgo")}` : `${days}${t("incidents.daysAgo")}`
}
