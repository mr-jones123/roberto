import { useEffect, useState, type JSX } from "react"
import { ChoroplethMap } from "./components/ChoroplethMap"
import { LayerToggle } from "./components/LayerToggle"
import { CityDetail } from "./components/CityDetail"
import { CityRanking } from "./components/CityRanking"
import { HazardSidebar } from "./components/HazardSidebar"
import { ProjectsSidebar } from "./components/ProjectsSidebar"
import { IncidentsSidebar } from "./components/IncidentsSidebar"
import { EvacCentersSidebar } from "./components/EvacCentersSidebar"
import { Methodology } from "./components/Methodology"
import { CoordinatorPanel } from "./components/incident/CoordinatorPanel"
import { LoginForm } from "./components/incident/LoginForm"
import { ReporterPanel } from "./components/incident/ReporterPanel"
import { ResponderPanel } from "./components/incident/ResponderPanel"
import { useCities } from "./hooks/useCities"
import { useCity } from "./hooks/useCity"
import { useAuth } from "./hooks/useAuth"
import { useIncidentStream } from "./hooks/useIncidentStream"
import { fetchEvacCenters } from "./lib/api"
import type { ActiveFilter, ClusterSelection, EvacCenterRow, IncidentRow, PendingConnection } from "./lib/types"
import { useLocale } from "./lib/locale"

type RouteTarget = {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  name: string
}

function App(): JSX.Element {
  const { cities, boundaries, hazardZones, allProjects, loading, error } = useCities()
  const { t, locale, setLocale } = useLocale()
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [showMethodology, setShowMethodology] = useState(false)
  const [showHazard, setShowHazard] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [show3D, setShow3D] = useState(false)
  const [showWater, setShowWater] = useState(false)
  const [showCoverage, setShowCoverage] = useState(true)
  const [showIncidents, setShowIncidents] = useState(false)
  const [showEvacCenters, setShowEvacCenters] = useState(false)
  const [incidentMode, setIncidentMode] = useState(false)
  const [reporterFloodContext, setReporterFloodContext] = useState(false)
  const [reporterWeatherContext, setReporterWeatherContext] = useState(false)
  const { detail, loading: detailLoading } = useCity(selectedCityId)
  const auth = useAuth()
  const { incidents } = useIncidentStream()
  const [evacCenters, setEvacCenters] = useState<EvacCenterRow[]>([])
  const [routeTarget, setRouteTarget] = useState<RouteTarget | null>(null)
  const [focusLocation, setFocusLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [focusIncident, setFocusIncident] = useState<IncidentRow | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [clusterSelection, setClusterSelection] = useState<ClusterSelection | null>(null)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>("coverage")
  const [pendingConnections, setPendingConnections] = useState<PendingConnection[]>([])

  const toggleFilter = (filter: ActiveFilter, currentlyActive: boolean, setShow: React.Dispatch<React.SetStateAction<boolean>>) => {
    const next = !currentlyActive
    setShow(next)
    if (next) {
      setActiveFilter(filter)
    } else if (activeFilter === filter) {
      setActiveFilter(null)
    }
  }

  useEffect(() => {
    fetchEvacCenters()
      .then((res) => setEvacCenters(res.centers))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!incidentMode) {
      setRouteTarget(null)
      setClusterSelection(null)
      setFocusIncident(null)
    }
  }, [incidentMode])

  useEffect(() => {
    if (incidentMode) {
      setSelectedCityId(null)
      setShowHazard(false)
      setShowProjects(false)
      setShowIncidents(false)
      setShowEvacCenters(false)
      setActiveFilter(null)
    }
  }, [incidentMode])

  const handleLogout = () => {
    setRouteTarget(null)
    setUserLocation(null)
    setReporterFloodContext(false)
    setReporterWeatherContext(false)
    auth.logout()
  }

  const isReporterIncidentView = incidentMode && auth.user?.role === "reporter"
  const effectiveShowHazard = isReporterIncidentView ? reporterFloodContext : showHazard
  const showCoverageOverlay = isReporterIncidentView
    ? reporterFloodContext
    : showCoverage
  const localeToggleLabel = locale === "en" ? "🇵🇭 Filipino" : "🇺🇸 English"

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] text-slate-50">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500 mx-auto" />
          <p className="text-slate-400">{t("app.loading")}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] text-slate-50">
        <div className="text-center">
          <p className="text-red-400 mb-2">{t("app.error")}</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  const renderIncidentSidebar = () => {
    if (!auth.isAuthenticated) {
      return <LoginForm onLogin={auth.login} />
    }

    const role = auth.user!.role
    if (role === "reporter") {
      return (
        <ReporterPanel
          token={auth.token!}
          userId={auth.user!.id}
          onLogout={handleLogout}
          onSelectFacility={(from, to, name) => setRouteTarget({ from, to, name })}
          onFocusPing={(lat, lng) => setFocusLocation({ lat, lng })}
          onUserLocationChange={(lat, lng) => setUserLocation({ lat, lng })}
          showFloodContext={reporterFloodContext}
          onToggleFloodContext={() => setReporterFloodContext((v) => !v)}
          showWeatherContext={reporterWeatherContext}
          onToggleWeatherContext={() => setReporterWeatherContext((v) => !v)}
          onConnectionsChange={setPendingConnections}
        />
      )
    }

    if (role === "coordinator") {
      return (
        <CoordinatorPanel
          token={auth.token!}
          onLogout={handleLogout}
          clusterSelection={clusterSelection}
          onClearCluster={() => setClusterSelection(null)}
        />
      )
    }

    return (
      <ResponderPanel
        token={auth.token!}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[#0f172a]">
      <header className="flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-50">{t("app.title")}</h1>
          <span className="text-xs text-slate-500">{t("app.subtitle")}</span>
        </div>
        <div className="flex items-center gap-2">
          {incidentMode ? (
            <>
              <button
                onClick={() => setIncidentMode(false)}
                className="rounded-lg border border-[#334155] px-2.5 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
              >
                {t("nav.backToAnalytics")}
              </button>
            </>
          ) : (
            <>
              <LayerToggle label={t("nav.coverage")} active={showCoverage} onToggle={() => toggleFilter("coverage", showCoverage, setShowCoverage)} color="#64748b" />
              <LayerToggle label={t("nav.hazard")} active={showHazard} onToggle={() => toggleFilter("hazard", showHazard, setShowHazard)} color="#3b82f6" />
              <LayerToggle label={t("nav.projects")} active={showProjects} onToggle={() => toggleFilter("projects", showProjects, setShowProjects)} color="#22c55e" />
              <LayerToggle label={t("nav.incidents")} active={showIncidents} onToggle={() => toggleFilter("incidents", showIncidents, setShowIncidents)} color="#ef4444" data-testid="toggle-incidents" />
              <LayerToggle label={t("nav.evacCenters")} active={showEvacCenters} onToggle={() => toggleFilter("evac_centers", showEvacCenters, setShowEvacCenters)} color="#10b981" data-testid="toggle-evac-centers" />
            </>
          )}
          <button
            onClick={() => setLocale(locale === "en" ? "tl" : "en")}
            className="rounded-lg border border-[#334155] px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-[#334155]"
          >
            {localeToggleLabel}
          </button>
          <button
            onClick={() => setIncidentMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              incidentMode
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-[#334155] text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${incidentMode ? "bg-amber-400" : "bg-slate-600"}`} />
            {t("nav.incidentCommand")}
          </button>
          {!incidentMode && (
            <button
              onClick={() => setShowMethodology(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
            >
              {t("nav.methodology")}
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {incidentMode && (
          <aside className="w-72 flex-shrink-0 border-r border-[#334155] overflow-hidden">
            {renderIncidentSidebar()}
          </aside>
        )}

        <main className="relative flex-1">
          <ChoroplethMap
            boundaries={boundaries}
            hazardZones={hazardZones}
            allProjects={allProjects}
            cities={cities}
            selectedCityId={selectedCityId}
            onSelectCity={incidentMode ? () => {} : setSelectedCityId}
            showHazard={effectiveShowHazard}
            show3D={show3D && effectiveShowHazard}
            showWater={showWater && show3D && effectiveShowHazard}
            showProjects={showProjects}
            showCoverageOverlay={showCoverageOverlay}
            incidents={incidents}
            showIncidents={showIncidents || incidentMode}
            evacCenters={evacCenters}
            showEvacCenters={showEvacCenters || incidentMode}
            routeFrom={routeTarget?.from ?? null}
            routeTo={routeTarget?.to ?? null}
            routeFacilityName={routeTarget?.name ?? null}
            focusLocation={focusLocation}
            focusIncident={focusIncident}
            userLocation={userLocation}
            onClusterSelect={setClusterSelection}
            onToggle3D={() => setShow3D((v) => !v)}
            onToggleWater={() => setShowWater((v) => !v)}
            pendingConnections={pendingConnections}
          />
        </main>

        {!incidentMode && (() => {
          let panel: JSX.Element | null = null

          switch (activeFilter) {
            case "coverage":
              if (selectedCityId && detail && !detailLoading) {
                panel = (
                  <CityDetail
                    city={detail.city}
                    projects={detail.projects}
                    onClose={() => setSelectedCityId(null)}
                  />
                )
              } else {
                panel = (
                  <CityRanking
                    cities={cities}
                    selectedCityId={selectedCityId}
                    onSelectCity={setSelectedCityId}
                  />
                )
              }
              break
            case "hazard":
              panel = (
                <HazardSidebar
                  hazardZones={hazardZones}
                  cities={cities}
                  onClose={() => { setShowHazard(false); setActiveFilter(null) }}
                />
              )
              break
            case "projects":
              panel = (
                <ProjectsSidebar
                  projects={allProjects}
                  cities={cities}
                  onClose={() => { setShowProjects(false); setActiveFilter(null) }}
                />
              )
              break
            case "incidents":
              panel = (
                <IncidentsSidebar
                  incidents={incidents}
                  onSelectIncident={(incident) => {
                    setFocusIncident({ ...incident })
                    setFocusLocation({ lat: incident.latitude, lng: incident.longitude })
                  }}
                  onClose={() => { setShowIncidents(false); setActiveFilter(null) }}
                />
              )
              break
            case "evac_centers":
              panel = (
                <EvacCentersSidebar
                  evacCenters={evacCenters}
                  onClose={() => { setShowEvacCenters(false); setActiveFilter(null) }}
                />
              )
              break
          }

          return panel ? (
            <aside className="w-96 flex-shrink-0 border-l border-[#334155] overflow-hidden">
              {panel}
            </aside>
          ) : null
        })()}
      </div>

      <footer className="border-t border-[#334155] bg-[#1e293b] px-4 py-1.5 text-center text-[11px] text-slate-500">
        {t("app.footer")}
      </footer>

      {showMethodology && <Methodology onClose={() => setShowMethodology(false)} />}
    </div>
  )
}

export default App
