import type { JSX } from "react"
import { scoreColor } from "../lib/colors"
import type { City } from "../lib/types"

type Props = {
  hazardZones: GeoJSON.FeatureCollection | null
  cities: City[]
  onClose: () => void
}

const SEVERITY = [
  { level: 3, label: "High (Var 3)", color: "#ef4444", desc: "Severe flooding" },
  { level: 2, label: "Medium (Var 2)", color: "#f97316", desc: "Moderate flooding" },
  { level: 1, label: "Low (Var 1)", color: "#eab308", desc: "Minor flooding" },
] as const

export function HazardSidebar({ hazardZones, cities, onClose }: Props): JSX.Element {
  const severityCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  if (hazardZones) {
    for (const f of hazardZones.features) {
      const level = f.properties?.var_level as number | undefined
      if (level != null && level in severityCounts) severityCounts[level] = (severityCounts[level] ?? 0) + 1
    }
  }
  const totalZones = Object.values(severityCounts).reduce((a, b) => a + b, 0)

  const totalHazardArea = cities.reduce((sum, c) => sum + c.total_high_hazard_area_km2, 0)
  const totalCoveredArea = cities.reduce((sum, c) => sum + c.raw_covered_area_km2, 0)
  const overallCoverage = totalHazardArea > 0 ? totalCoveredArea / totalHazardArea : 0

  const severeAreaDesc = [...cities].sort(
    (a, b) => b.total_high_hazard_area_km2 - a.total_high_hazard_area_km2,
  )
  const topSevereCities = severeAreaDesc.slice(0, 3)
  const lowestSevereCities = [...severeAreaDesc].reverse().slice(0, 3)

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Hazard Overview
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {totalZones} zones &middot; {totalHazardArea.toFixed(1)} km&sup2; total
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
          <MetricCard label="High Hazard Area" value={`${totalHazardArea.toFixed(1)} km\u00B2`} />
          <MetricCard label="Covered Area" value={`${totalCoveredArea.toFixed(1)} km\u00B2`} />
          <div className="col-span-2 rounded-lg bg-[#0f172a] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Overall Coverage</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-[#1e293b] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(overallCoverage * 100).toFixed(1)}%`,
                    backgroundColor: scoreColor(overallCoverage),
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-200">
                {(overallCoverage * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[#334155] px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Severity Distribution
        </h3>
        <div className="space-y-2">
          {SEVERITY.map(({ level, label, color, desc }) => {
            const count = severityCounts[level] ?? 0
            return (
              <div key={level}>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1 text-xs text-slate-300">{label}</span>
                  <span className="text-xs font-mono text-slate-400">{count}</span>
                </div>
                <div className="mt-1 ml-[18px]">
                  <div className="h-1.5 rounded-full bg-[#0f172a] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: color,
                        width: totalZones > 0 ? `${(count / totalZones) * 100}%` : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">{desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Severe Hazard Area Ranking
          </h3>
        </div>
        <div className="border-b border-[#334155]/50 px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top 3 Highest</p>
        </div>
        {topSevereCities.map((city, i) => (
          <div
            key={`${city.id}-high`}
            className="flex items-center gap-3 border-b border-[#334155]/50 px-4 py-2.5"
          >
            <span className="text-xs text-slate-500 w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{city.name}</p>
              <p className="text-[10px] text-slate-500">
                {city.total_high_hazard_area_km2.toFixed(2)} km&sup2; severe area
              </p>
            </div>
            <p className="text-xs font-mono font-medium text-red-300">
              {city.total_high_hazard_area_km2.toFixed(2)}
            </p>
          </div>
        ))}

        <div className="border-b border-[#334155]/50 px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Top 3 Lowest</p>
        </div>
        {lowestSevereCities.map((city, i) => (
          <div
            key={`${city.id}-low`}
            className="flex items-center gap-3 border-b border-[#334155]/50 px-4 py-2.5"
          >
            <span className="text-xs text-slate-500 w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-200 truncate">{city.name}</p>
              <p className="text-[10px] text-slate-500">
                {city.total_high_hazard_area_km2.toFixed(2)} km&sup2; severe area
              </p>
            </div>
            <p className="text-xs font-mono font-medium text-emerald-300">
              {city.total_high_hazard_area_km2.toFixed(2)}
            </p>
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
