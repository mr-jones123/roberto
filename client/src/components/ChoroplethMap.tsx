import L from "leaflet"
import { useEffect, useRef } from "react"
import type React from "react"
import { GeoJSON, MapContainer, Marker, Pane, Popup, TileLayer } from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import "react-leaflet-cluster/dist/assets/MarkerCluster.css"
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css"
import type { GeoJSON as GeoJSONLayer } from "leaflet"
import { formatPHP, scoreColor } from "../lib/colors"
import type { City, EvacCenterRow, IncidentRow, Project } from "../lib/types"
import { IncidentMapLayers } from "./IncidentMapLayers"

type FeatureLayer = L.Path & { feature: GeoJSON.Feature }

const HAZARD_COLORS: Record<number, string> = {
  1: "#93c5fd",
  2: "#3b82f6",
  3: "#1e3a8a",
}

const PROJECT_STATUS_COLORS: Record<string, string> = {
  Completed: "#22c55e",
  "On-Going": "#f59e0b",
  "Not Yet Started": "#94a3b8",
}

const DOT_SIZE = 10

const PROJECT_ICONS: Record<string, L.DivIcon> = {}

function getProjectIcon(status: string): L.DivIcon {
  const cached = PROJECT_ICONS[status]
  if (cached) return cached
  const fill = PROJECT_STATUS_COLORS[status] ?? "#94a3b8"
  const icon = L.divIcon({
    className: "roberto-dot",
    html: `<span style="background:${fill};border-color:#0f172a"></span>`,
    iconSize: L.point(DOT_SIZE, DOT_SIZE, true),
    iconAnchor: L.point(DOT_SIZE / 2, DOT_SIZE / 2, true),
    popupAnchor: [0, -(DOT_SIZE / 2 + 2)],
    tooltipAnchor: [0, -(DOT_SIZE / 2)],
  })
  PROJECT_ICONS[status] = icon
  return icon
}

const DEFAULT_STATUS_STYLE: React.CSSProperties = { background: "#94a3b820", color: "#94a3b8" }

const STATUS_LABEL_BG: Record<string, React.CSSProperties> = {
  Completed: { background: "#22c55e20", color: "#22c55e" },
  "On-Going": { background: "#f59e0b20", color: "#f59e0b" },
  "Not Yet Started": DEFAULT_STATUS_STYLE,
}

type Props = {
  boundaries: GeoJSON.FeatureCollection | null
  hazardZones: GeoJSON.FeatureCollection | null
  allProjects: Project[]
  cities: City[]
  selectedCityId: string | null
  onSelectCity: (id: string) => void
  showHazard: boolean
  showProjects: boolean
  incidents?: IncidentRow[]
  showIncidents?: boolean
  evacCenters?: EvacCenterRow[]
  showEvacCenters?: boolean
}

function getCityScore(cities: City[], cityNorm: string): number {
  return cities.find((c) => c.city_norm === cityNorm)?.effective_coverage_score ?? 0
}

function createClusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount()
  let size = 36
  let className = "roberto-cluster roberto-cluster--sm"

  if (count >= 100) {
    size = 48
    className = "roberto-cluster roberto-cluster--lg"
  } else if (count >= 30) {
    size = 42
    className = "roberto-cluster roberto-cluster--md"
  }

  return L.divIcon({
    html: `<span>${count}</span>`,
    className,
    iconSize: L.point(size, size, true),
  })
}

export function ChoroplethMap({
  boundaries, hazardZones, allProjects, cities,
  selectedCityId, onSelectCity, showHazard, showProjects,
  incidents = [], showIncidents = false,
  evacCenters = [], showEvacCenters = false,
}: Props): React.JSX.Element | null {
  const geoJsonRef = useRef<GeoJSONLayer | null>(null)

  const selectedCity = cities.find((c) => c.id === selectedCityId)

  useEffect(() => {
    if (!geoJsonRef.current) return
    geoJsonRef.current.eachLayer((layer) => {
      const featureLayer = layer as FeatureLayer
      const cityNorm = featureLayer.feature.properties?.city_norm as string
      const isSelected = selectedCity?.city_norm === cityNorm
      featureLayer.setStyle({
        weight: isSelected ? 3 : 1,
        color: isSelected ? "#f8fafc" : "#334155",
        fillOpacity: isSelected ? 0.85 : 0.7,
      })
    })
  }, [selectedCityId, selectedCity])

  if (!boundaries) return null

  return (
    <MapContainer
      center={[14.5995, 120.9842]}
      zoom={11}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Pane name="boundaries" style={{ zIndex: 400 }}>
        <GeoJSON
          ref={geoJsonRef}
          data={boundaries}
          style={(feature) => {
            const cityNorm = feature?.properties?.city_norm as string
            const score = getCityScore(cities, cityNorm)
            const isSelected = selectedCity?.city_norm === cityNorm
            return {
              fillColor: scoreColor(score),
              fillOpacity: isSelected ? 0.85 : 0.7,
              color: isSelected ? "#f8fafc" : "#334155",
              weight: isSelected ? 3 : 1,
            }
          }}
          onEachFeature={(feature, layer) => {
            const cityNorm = feature.properties?.city_norm as string
            const name = feature.properties?.admin3Name_en as string ?? cityNorm
            const score = getCityScore(cities, cityNorm)
            layer.bindTooltip(`${name}: ${(score * 100).toFixed(1)}%`, {
              sticky: true,
              className: "!bg-slate-800 !text-slate-50 !border-slate-600 !text-sm",
            })
            layer.on("click", () => {
              const city = cities.find((c) => c.city_norm === cityNorm)
              if (city) onSelectCity(city.id)
            })
          }}
        />
      </Pane>

      {showHazard && hazardZones && (
        <Pane name="hazard" style={{ zIndex: 410 }}>
          <GeoJSON
            key="hazard"
            data={hazardZones}
            style={(feature) => {
              const varLevel = (feature?.properties?.var_level as number) ?? 1
              return {
                fillColor: HAZARD_COLORS[varLevel] ?? "#3b82f6",
                fillOpacity: 0.45,
                color: HAZARD_COLORS[varLevel] ?? "#3b82f6",
                weight: 1,
              }
            }}
          />
        </Pane>
      )}

      {showProjects && (
        <Pane name="projects" style={{ zIndex: 450 }}>
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
            iconCreateFunction={createClusterIcon}
          >
            {allProjects.map((p, idx) => (
              <Marker
                key={`${p.id}-${idx}`}
                position={[p.latitude, p.longitude]}
                icon={getProjectIcon(p.status)}
                eventHandlers={{
                  add(e) {
                    const marker = e.target as L.Marker
                    if (!marker.getTooltip()) {
                      marker.bindTooltip(p.name, {
                        direction: "top",
                        offset: [0, -4],
                        className: "roberto-tooltip",
                      })
                    }
                  },
                }}
              >
                <Popup className="roberto-popup" pane="popupPane" maxWidth={320} minWidth={260}>
                  <ProjectPopupContent project={p} />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </Pane>
      )}

      <IncidentMapLayers
        incidents={incidents}
        showIncidents={showIncidents}
        evacCenters={evacCenters}
        showEvacCenters={showEvacCenters}
      />
    </MapContainer>
  )
}

function ProjectPopupContent({ project: p }: { project: Project }) {
  const statusStyle = STATUS_LABEL_BG[p.status] ?? DEFAULT_STATUS_STYLE

  return (
    <div className="roberto-popup-inner">
      <div className="text-sm font-semibold leading-snug text-slate-100 mb-2">
        {p.name}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={statusStyle}
        >
          {p.status}
        </span>
        <span className="text-xs font-mono text-slate-300">
          {p.progress.toFixed(1)}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <PopupField label="Budget" value={formatPHP(p.budget)} />
        <PopupField label="City" value={p.city_norm} />
        <PopupField label="Category" value={p.category} />
        <PopupField label="ID" value={p.id} />
        <div className="col-span-2">
          <PopupField label="Contractor" value={p.contractor} />
        </div>
      </div>
    </div>
  )
}

function PopupField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500 uppercase tracking-wider text-[9px]">{label}</span>
      <div className="text-slate-200 leading-tight truncate" title={value}>{value}</div>
    </div>
  )
}


