import type { JSX } from "react"
import { scoreColor, formatPercent } from "../lib/colors"
import type { City } from "../lib/types"

type Props = {
  cities: City[]
  selectedCityId: string | null
  onSelectCity: (id: string) => void
}

export function CityRanking({ cities, selectedCityId, onSelectCity }: Props): JSX.Element {
  const totalProjects = cities.reduce((sum, c) => sum + c.project_count, 0)

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="border-b border-[#334155] px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          City Rankings
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {cities.length} cities &middot; {totalProjects.toLocaleString()} projects
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {cities.map((city, i) => {
          const isSelected = city.id === selectedCityId
          return (
            <button
              key={city.id}
              onClick={() => onSelectCity(city.id)}
              className={`flex w-full items-center gap-3 border-b border-[#334155]/50 px-4 py-3 text-left transition-colors hover:bg-[#334155]/50 ${
                isSelected ? "bg-[#334155]" : ""
              }`}
            >
              <span className="text-xs text-slate-500 w-5">{i + 1}</span>
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: scoreColor(city.effective_coverage_score) }}
              />
              <span className="flex-1 text-sm truncate">{city.name}</span>
              <span className="text-sm font-mono font-medium" style={{ color: scoreColor(city.effective_coverage_score) }}>
                {formatPercent(city.effective_coverage_score)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
