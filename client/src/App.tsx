import { useState, type JSX } from "react"
import { ChoroplethMap } from "./components/ChoroplethMap"
import { CityDetail } from "./components/CityDetail"
import { CityRanking } from "./components/CityRanking"
import { Methodology } from "./components/Methodology"
import { CoordinatorPanel } from "./components/incident/CoordinatorPanel"
import { LoginForm } from "./components/incident/LoginForm"
import { ReporterPanel } from "./components/incident/ReporterPanel"
import { useCities } from "./hooks/useCities"
import { useCity } from "./hooks/useCity"
import { useAuth } from "./hooks/useAuth"

function App(): JSX.Element {
  const { cities, boundaries, hazardZones, allProjects, loading, error } = useCities()
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [showMethodology, setShowMethodology] = useState(false)
  const [showHazard, setShowHazard] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [incidentMode, setIncidentMode] = useState(false)
  const { detail, loading: detailLoading } = useCity(selectedCityId)
  const auth = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] text-slate-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500 mx-auto" />
          <p className="text-slate-400">Loading Roberto...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] text-slate-50">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load data</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  const renderSidebar = () => {
    if (!incidentMode) {
      return (
        <CityRanking
          cities={cities}
          selectedCityId={selectedCityId}
          onSelectCity={setSelectedCityId}
        />
      )
    }

    if (!auth.isAuthenticated) {
      return <LoginForm onLogin={auth.login} />
    }

    const role = auth.user!.role
    if (role === "reporter") {
      return (
        <ReporterPanel
          token={auth.token!}
          userId={auth.user!.id}
          onLogout={auth.logout}
        />
      )
    }

    if (role === "coordinator") {
      return (
        <CoordinatorPanel
          token={auth.token!}
          onLogout={auth.logout}
        />
      )
    }

    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#1e293b] px-6 text-center">
        <p className="text-sm text-slate-400">Responder panel coming soon</p>
        <button
          onClick={auth.logout}
          className="mt-3 text-xs text-slate-500 hover:text-slate-300"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[#0f172a]">
      <header className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-50">Roberto</h1>
          <span className="text-xs text-slate-500">Metro Manila Flood Coverage</span>
        </div>
        <div className="flex items-center gap-2">
          {incidentMode ? (
            <button
              onClick={() => setIncidentMode(false)}
              className="rounded-lg border border-[#334155] px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
            >
              Back to Analytics
            </button>
          ) : (
            <>
              <LayerToggle label="Hazard" active={showHazard} onToggle={() => setShowHazard((v) => !v)} color="#3b82f6" />
              <LayerToggle label="Projects" active={showProjects} onToggle={() => setShowProjects((v) => !v)} color="#22c55e" />
            </>
          )}
          <button
            onClick={() => setIncidentMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              incidentMode
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-[#334155] text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${incidentMode ? "bg-amber-400" : "bg-slate-600"}`} />
            Incident Command
          </button>
          {!incidentMode && (
            <button
              onClick={() => setShowMethodology(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
            >
              Methodology
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 flex-shrink-0 border-r border-[#334155] overflow-hidden">
          {renderSidebar()}
        </aside>

        <main className="relative flex-1">
          <ChoroplethMap
            boundaries={boundaries}
            hazardZones={hazardZones}
            allProjects={allProjects}
            cities={cities}
            selectedCityId={selectedCityId}
            onSelectCity={setSelectedCityId}
            showHazard={showHazard}
            showProjects={showProjects}
          />
        </main>

        {selectedCityId && detail && !detailLoading && (
          <aside className="w-96 flex-shrink-0 border-l border-[#334155] overflow-hidden">
            <CityDetail
              city={detail.city}
              projects={detail.projects}
              onClose={() => setSelectedCityId(null)}
            />
          </aside>
        )}
      </div>

      <footer className="border-t border-[#334155] bg-[#1e293b] px-4 py-1.5 text-center text-[11px] text-slate-500">
        Flood hazard data &copy; NOAH (ODbL 1.0) | DPWH data via BetterGov.ph (CC0) | City boundaries via OCHA
      </footer>

      {showMethodology && <Methodology onClose={() => setShowMethodology(false)} />}
    </div>
  )
}

function LayerToggle({ label, active, onToggle, color }: {
  label: string
  active: boolean
  onToggle: () => void
  color: string
}) {
  return (
    <button
      onClick={onToggle}
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

export default App
