import type { JSX } from "react"
import { scoreColor } from "../lib/colors"
import { useLocale } from "../lib/locale"
import type { City } from "../lib/types"

type Props = {
  hazardZones: GeoJSON.FeatureCollection | null
  cities: City[]
  onClose: () => void
}

const SEVERITY = [
  { level: 3, color: "#ef4444" },
  { level: 2, color: "#f97316" },
  { level: 1, color: "#eab308" },
] as const

export function HazardSidebar({ hazardZones, cities, onClose }: Props): JSX.Element {
  const { t, locale } = useLocale()
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
  const metroExposureGap = Math.max(0, 1 - overallCoverage)

  const totalProjects = cities.reduce((sum, c) => sum + c.project_count, 0)
  const weightedProgress = totalProjects > 0
    ? cities.reduce((sum, c) => sum + c.avg_progress * c.project_count, 0) / totalProjects
    : 0
  const metroReadinessGap = Math.max(0, 1 - weightedProgress / 100)

  const criticalCities = cities.filter((c) => c.effective_coverage_score < 0.5)
  const uncoveredArea = Math.max(0, totalHazardArea - totalCoveredArea)
  const ongoingProjects = cities.reduce((sum, c) => sum + (c.status_breakdown["On-Going"] ?? 0), 0)

  const metroMeaningNow = locale === "tl"
    ? [
        `May ${totalHazardArea.toFixed(1)} km2 na high flood-hazard area ang Metro Manila sa ${cities.length} lungsod.`,
        `Sakop ng flood-control projects ang ${(overallCoverage * 100).toFixed(0)}% ng lawak na ito, kaya may ${uncoveredArea.toFixed(1)} km2 pa na kulang sa malapit na proteksyon.`,
        criticalCities.length > 0
          ? `${criticalCities.map((c) => c.name).join(" at ")} ${criticalCities.length > 1 ? "ay may" : "ay may"} mas mababa sa 50% coverage - sila ang may pinakamataas na panganib.`
          : "Walang lungsod na mas mababa sa 50% coverage, pero may natitira pa ring gaps sa ilang lugar.",
        ongoingProjects > 0
          ? `${ongoingProjects} proyekto pa ang ginagawa (${weightedProgress.toFixed(0)}% average completion). Hangga't hindi pa tapos ang mga ito, limitado pa ang proteksiyong naibibigay.`
          : `Tapos na ang lahat ng ${totalProjects} proyekto, pero walang imprastrakturang ganap na flood-proof sa matitinding event.`,
        "Tatlong pangunahing flood system ang tumatama sa metro: Marikina-Pasig River (silangan), Tullahan River (hilaga), at tidal surge ng Manila Bay (kanluran). Alamin kung alin ang pangunahing risk sa lungsod mo.",
      ].join(" ")
    : [
        `Metro Manila has ${totalHazardArea.toFixed(1)} km2 of high flood-hazard area across ${cities.length} cities.`,
        `Flood-control projects cover ${(overallCoverage * 100).toFixed(0)}% of that area, leaving ${uncoveredArea.toFixed(1)} km2 without nearby protection.`,
        criticalCities.length > 0
          ? `${criticalCities.map((c) => c.name).join(" and ")} ${criticalCities.length > 1 ? "have" : "has"} less than 50% coverage - residents there face the highest risk.`
          : "No city is below 50% coverage, but gaps remain in several areas.",
        ongoingProjects > 0
          ? `${ongoingProjects} projects are still under construction (${weightedProgress.toFixed(0)}% average completion). Until these finish, their protection is partial.`
          : `All ${totalProjects} projects are complete, but no infrastructure is flood-proof against extreme events.`,
        "Three major flood systems affect the metro: the Marikina-Pasig River (east), the Tullahan River (north), and Manila Bay tidal surges (west). Know which one affects your city.",
      ].join(" ")

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
            {t("hazard.title")}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {totalZones} {t("common.zones")} &middot; {totalHazardArea.toFixed(1)} km&sup2; {t("common.total")}
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
          <MetricCard label={t("hazard.highHazardArea")} value={`${totalHazardArea.toFixed(1)} km²`} />
          <MetricCard label={t("hazard.coveredArea")} value={`${totalCoveredArea.toFixed(1)} km²`} />
          <MetricCard label={t("hazard.exposureGap")} value={`${(metroExposureGap * 100).toFixed(1)}%`} />
          <MetricCard label={t("hazard.readinessGap")} value={`${(metroReadinessGap * 100).toFixed(1)}%`} />
          <div className="col-span-2 rounded-lg bg-[#0f172a] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("hazard.overallCoverage")}</p>
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

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-[#334155] px-4 py-3">
          <div className="mb-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-200">
              {t("hazard.whatItMeans")}
            </h3>
            <p className="text-sm leading-6 text-rose-50">{metroMeaningNow}</p>
          </div>
        </div>
        <div className="border-b border-[#334155] px-4 py-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("hazard.severityDistribution")}
          </h3>
          <div className="space-y-2">
            {SEVERITY.map(({ level, color }) => {
              const count = severityCounts[level] ?? 0
              const levelKey = level === 3 ? "high" : level === 2 ? "medium" : "low"
              return (
                <div key={level}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="flex-1 text-xs text-slate-300">{t(`severity.${levelKey}`)}</span>
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
                    <p className="mt-0.5 text-[10px] text-slate-500">{t(`severity.${levelKey}Desc`)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("hazard.severeRanking")}
          </h3>
        </div>
        <div className="border-b border-[#334155]/50 px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("hazard.top3Highest")}</p>
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
                {city.total_high_hazard_area_km2.toFixed(2)} km&sup2; {t("hazard.severeArea")}
              </p>
            </div>
            <p className="text-xs font-mono font-medium text-red-300">
              {city.total_high_hazard_area_km2.toFixed(2)}
            </p>
          </div>
        ))}

        <div className="border-b border-[#334155]/50 px-4 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t("hazard.top3Lowest")}</p>
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
                {city.total_high_hazard_area_km2.toFixed(2)} km&sup2; {t("hazard.severeArea")}
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
