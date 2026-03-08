import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react"
import Map, { Source, Layer, Popup, Marker, NavigationControl } from "react-map-gl/mapbox"
import type { MapRef, MapMouseEvent } from "react-map-gl/mapbox"
import type { ExpressionSpecification, GeoJSONFeature, GeoJSONSource } from "mapbox-gl"
import { formatPHP, scoreColor } from "../lib/colors"
import { BUILDING_3D_COLOR, DEFAULT_CENTER, DEFAULT_ZOOM, HAZARD_COLORS, MAPBOX_TOKEN, MAP_STYLE, toLngLat } from "../lib/map-utils"
import type { City, ClusterSelection, EvacCenterRow, IncidentRow, PendingConnection, Project } from "../lib/types"
import {
  IncidentMapLayers,
  INCIDENT_LAYER_ID,
  EVAC_LAYER_ID,
  PING_CLUSTER_LAYER_ID,
  PING_SINGLE_LAYER_ID,
} from "./IncidentMapLayers"
import { LayerToggle } from "./LayerToggle"
import { RouteOverlay } from "./RouteOverlay"

type Props = {
  boundaries: GeoJSON.FeatureCollection | null
  hazardZones: GeoJSON.FeatureCollection | null
  allProjects: Project[]
  cities: City[]
  selectedCityId: string | null
  onSelectCity: (id: string) => void
  showHazard: boolean
  show3D?: boolean
  showWater?: boolean
  showProjects: boolean
  showCoverageOverlay?: boolean
  incidents?: IncidentRow[]
  showIncidents?: boolean
  evacCenters?: EvacCenterRow[]
  showEvacCenters?: boolean
  routeFrom?: { lat: number; lng: number } | null
  routeTo?: { lat: number; lng: number } | null
  routeFacilityName?: string | null
  focusLocation?: { lat: number; lng: number } | null
  userLocation?: { lat: number; lng: number } | null
  focusIncident?: IncidentRow | null
  onClusterSelect?: (selection: ClusterSelection) => void
  onToggle3D?: () => void
  onToggleWater?: () => void
  pendingConnections?: PendingConnection[]
}

type PopupInfo =
  | { type: "project"; lng: number; lat: number; project: Project }
  | { type: "incident"; lng: number; lat: number; incident: IncidentRow }
  | { type: "evac"; lng: number; lat: number; center: EvacCenterRow }

const GEMINI_STORAGE_KEY = "roberto-gemini-key"

const INTERACTIVE_LAYERS = [
  "boundaries-fill", "clusters", "unclustered-project",
  INCIDENT_LAYER_ID, PING_SINGLE_LAYER_ID, EVAC_LAYER_ID, PING_CLUSTER_LAYER_ID,
]

export function ChoroplethMap({
  boundaries, hazardZones, allProjects, cities,
  selectedCityId, onSelectCity, showHazard, showProjects,
  showCoverageOverlay = true,
  show3D = false,
  showWater = false,
  incidents = [], showIncidents = false,
  evacCenters = [], showEvacCenters = false,
  routeFrom = null, routeTo = null, routeFacilityName = null,
  focusLocation = null, userLocation = null,
  focusIncident = null,
  onClusterSelect = () => {},
  onToggle3D,
  onToggleWater,
  pendingConnections = [],
}: Props): JSX.Element | null {
  const mapRef = useRef<MapRef>(null)
  const [cursor, setCursor] = useState("auto")
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null)

  const selectedCity = cities.find((c) => c.id === selectedCityId)
  const selectedNorm = selectedCity?.city_norm ?? ""

  const projectsGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: allProjects.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: toLngLat(p.latitude, p.longitude) },
      properties: {
        id: p.id, name: p.name, status: p.status, progress: p.progress,
        category: p.category, contractor: p.contractor, budget: p.budget, city_norm: p.city_norm,
      },
    })),
  }), [allProjects])

  const boundaryColorExpr = useMemo((): ExpressionSpecification => {
    const pairs: string[] = []
    for (const city of cities) {
      pairs.push(city.city_norm, scoreColor(city.effective_coverage_score))
    }
    return ["match", ["get", "city_norm"], ...pairs, "#334155"] as ExpressionSpecification
  }, [cities])

  const connectionsGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: pendingConnections.map((conn, i) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [conn.from, conn.to],
      },
      properties: { id: `conn-${i}` },
    })),
  }), [pendingConnections])

  useEffect(() => {
    if (!pendingConnections.length) return
    const map = mapRef.current?.getMap()
    if (!map) return

    let animationId: number
    const animate = () => {
      const t = Math.sin(Date.now() / 500)
      const opacity = 0.3 + 0.7 * Math.abs(t)
      const width = 2 + 2 * Math.abs(t)
      if (map.getLayer("pending-connections-line")) {
        map.setPaintProperty("pending-connections-line", "line-opacity", opacity)
        map.setPaintProperty("pending-connections-line", "line-width", width)
      }
      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => cancelAnimationFrame(animationId)
  }, [pendingConnections])

  useEffect(() => {
    if (!showIncidents || incidents.length === 0) return
    const map = mapRef.current?.getMap()
    if (!map) return

    let animationId: number
    const animate = () => {
      const phase = (Math.sin(Date.now() / 380) + 1) / 2
      const unresolvedRadius = 8 + phase * 2.8
      const unresolvedOpacity = 0.92 + phase * 0.08
      const resolvedRadius = 10.5
      const resolvedOpacity = 1
      const pingRadius = 8 + phase * 3.4
      const pingStroke = 1.8 + phase * 1.2

      if (map.getLayer(INCIDENT_LAYER_ID)) {
        map.setPaintProperty(INCIDENT_LAYER_ID, "circle-radius", [
          "case",
          ["==", ["get", "status"], "RESOLVED"],
          resolvedRadius,
          unresolvedRadius,
        ])
        map.setPaintProperty(INCIDENT_LAYER_ID, "circle-opacity", [
          "case",
          ["==", ["get", "status"], "RESOLVED"],
          resolvedOpacity,
          unresolvedOpacity,
        ])
      }

      if (map.getLayer(PING_SINGLE_LAYER_ID)) {
        map.setPaintProperty(PING_SINGLE_LAYER_ID, "circle-radius", pingRadius)
        map.setPaintProperty(PING_SINGLE_LAYER_ID, "circle-stroke-width", pingStroke)
        map.setPaintProperty(PING_SINGLE_LAYER_ID, "circle-opacity", unresolvedOpacity)
      }

      if (map.getLayer(PING_CLUSTER_LAYER_ID)) {
        map.setPaintProperty(PING_CLUSTER_LAYER_ID, "circle-radius", [
          "step",
          ["get", "count"],
          14 + phase * 2,
          5,
          18 + phase * 2.5,
          10,
          22 + phase * 3,
        ])
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()
    return () => cancelAnimationFrame(animationId)
  }, [showIncidents, incidents.length])

  const handleClick = useCallback((event: MapMouseEvent) => {
    const feature = (event.features as GeoJSONFeature[] | undefined)?.[0]
    if (!feature?.layer) {
      setPopupInfo(null)
      return
    }

    const layerId = feature.layer.id

    if (layerId === "boundaries-fill") {
      const cityNorm = feature.properties?.city_norm
      if (typeof cityNorm !== "string") return
      const city = cities.find((c) => c.city_norm === cityNorm)
      if (city) onSelectCity(city.id)
      return
    }

    if (layerId === "clusters") {
      const clusterId = feature.properties?.cluster_id
      if (typeof clusterId !== "number") return
      const source = mapRef.current?.getSource("projects") as GeoJSONSource | undefined
      if (!source) return
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return
        if (feature.geometry.type !== "Point") return
        const lng = feature.geometry.coordinates[0]
        const lat = feature.geometry.coordinates[1]
        if (lng == null || lat == null) return
        mapRef.current?.easeTo({ center: [lng, lat], zoom, duration: 500 })
      })
      return
    }

    if (layerId === "unclustered-project") {
      const id = feature.properties?.id
      if (typeof id !== "string") return
      const project = allProjects.find((p) => p.id === id)
      if (!project) return
      setPopupInfo({ type: "project", lng: event.lngLat.lng, lat: event.lngLat.lat, project })
      return
    }

    if (layerId === INCIDENT_LAYER_ID || layerId === PING_SINGLE_LAYER_ID) {
      const id = feature.properties?.id
      if (typeof id !== "string") return
      const incident = incidents.find((inc) => inc.id === id)
      if (!incident) return
      setPopupInfo({ type: "incident", lng: event.lngLat.lng, lat: event.lngLat.lat, incident })
      return
    }

    if (layerId === EVAC_LAYER_ID) {
      const id = feature.properties?.id
      if (typeof id !== "string") return
      const center = evacCenters.find((ec) => ec.id === id)
      if (!center) return
      setPopupInfo({ type: "evac", lng: event.lngLat.lng, lat: event.lngLat.lat, center })
      return
    }

    if (layerId === PING_CLUSTER_LAYER_ID) {
      const raw = feature.properties?.memberIds
      const lat = feature.properties?.centerLat
      const lng = feature.properties?.centerLng
      if (typeof raw !== "string" || typeof lat !== "number" || typeof lng !== "number") return
      try {
        const ids = JSON.parse(raw) as string[]
        onClusterSelect({ clickedLat: lat, clickedLng: lng, incidentIds: ids })
      } catch {}
    }
  }, [cities, onSelectCity, allProjects, incidents, evacCenters, onClusterSelect])

  const handleMouseEnter = useCallback(() => setCursor("pointer"), [])
  const handleMouseLeave = useCallback(() => { setCursor("auto") }, [])

  useEffect(() => {
    if (!focusLocation) return
    mapRef.current?.flyTo({ center: toLngLat(focusLocation.lat, focusLocation.lng), zoom: 15, duration: 1200 })
  }, [focusLocation])

  useEffect(() => {
    if (!focusIncident) return
    const incident = incidents.find((inc) => inc.id === focusIncident.id) ?? focusIncident
    const [lng, lat] = toLngLat(incident.latitude, incident.longitude)
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 1000 })
    setPopupInfo({ type: "incident", lng, lat, incident })
  }, [focusIncident, incidents])

  const [mapLoaded, setMapLoaded] = useState(false)

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    if (!map.getLayer("building-3d")) {
      map.addLayer({
        id: "building-3d",
        source: "composite",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 14,
        filter: ["==", "extrude", "true"],
        layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": BUILDING_3D_COLOR,
          "fill-extrusion-height": [
            "interpolate", ["linear"], ["zoom"],
            14, 0, 14.05, ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate", ["linear"], ["zoom"],
            14, 0, 14.05, ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.75,
        },
      })
    }
    setMapLoaded(true)
  }, [])

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: show3D ? 60 : 0, duration: 800 })
  }, [show3D])

  useEffect(() => {
    if (!mapLoaded) return
    const map = mapRef.current?.getMap()
    if (!map) return
    if (map.getLayer("building-3d")) {
      map.setLayoutProperty("building-3d", "visibility", show3D ? "visible" : "none")
    }
  }, [show3D, mapLoaded])

  if (!boundaries) return null

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f172a] text-slate-50">
        <div className="text-center">
          <p className="text-red-400 mb-2">Map unavailable</p>
          <p className="text-sm text-slate-500">Mapbox access token is missing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={{ longitude: DEFAULT_CENTER[0], latitude: DEFAULT_CENTER[1], zoom: DEFAULT_ZOOM }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLE}
      interactiveLayerIds={INTERACTIVE_LAYERS}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onLoad={handleMapLoad}
      cursor={cursor}
    >
      <NavigationControl position="top-right" />

      <Source id="boundaries" type="geojson" data={boundaries}>
        <Layer
          id="boundaries-fill"
          type="fill"
          paint={{
            "fill-color": boundaryColorExpr,
            "fill-opacity": showCoverageOverlay
              ? ["case", ["==", ["get", "city_norm"], selectedNorm], 0.85, 0.7]
              : 0,
          }}
        />
        <Layer
          id="boundaries-outline"
          type="line"
          paint={{
            "line-color": showCoverageOverlay
              ? ["case", ["==", ["get", "city_norm"], selectedNorm], "#f8fafc", "#334155"]
              : "#475569",
            "line-width": showCoverageOverlay
              ? ["case", ["==", ["get", "city_norm"], selectedNorm], 3, 1]
              : ["case", ["==", ["get", "city_norm"], selectedNorm], 2, 1],
          }}
        />
      </Source>

      {hazardZones && (
        <Source id="hazard" type="geojson" data={hazardZones}>
          <Layer
            id="hazard-fill"
            type="fill"
            layout={{ visibility: showHazard ? "visible" : "none" }}
            paint={{
              "fill-color": [
                "match", ["get", "var_level"],
                1, HAZARD_COLORS[1], 2, HAZARD_COLORS[2], 3, HAZARD_COLORS[3], HAZARD_COLORS[2],
              ],
              "fill-opacity": 0.4,
            }}
          />
          <Layer
            id="hazard-outline"
            type="line"
            layout={{ visibility: showHazard ? "visible" : "none" }}
            paint={{
              "line-color": [
                "match", ["get", "var_level"],
                1, HAZARD_COLORS[1], 2, HAZARD_COLORS[2], 3, HAZARD_COLORS[3], HAZARD_COLORS[2],
              ],
              "line-opacity": 0.5,
              "line-width": 0.6,
            }}
          />
          <Layer
            id="hazard-water"
            type="fill-extrusion"
            layout={{ visibility: showWater ? "visible" : "none" }}
            paint={{
              "fill-extrusion-color": [
                "match", ["get", "var_level"],
                1, "#7dd3fc", 2, "#38bdf8", 3, "#0284c7", "#38bdf8",
              ],
              "fill-extrusion-height": [
                "match", ["get", "var_level"],
                1, 2, 2, 5, 3, 10, 2,
              ],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.55,
            }}
          />
        </Source>
      )}

      <Source
        id="projects"
        type="geojson"
        data={projectsGeoJSON}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        <Layer
          id="clusters"
          type="circle"
          filter={["has", "point_count"]}
          layout={{ visibility: showProjects ? "visible" : "none" }}
          paint={{
            "circle-color": "rgba(15, 23, 42, 0.85)",
            "circle-radius": ["step", ["get", "point_count"], 18, 30, 22, 100, 28],
            "circle-stroke-width": 2,
            "circle-stroke-color": "rgba(59, 130, 246, 0.6)",
          }}
        />
        <Layer
          id="cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            visibility: showProjects ? "visible" : "none",
            "text-field": ["concat", ["get", "point_count_abbreviated"]],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
          }}
          paint={{ "text-color": "#f8fafc" }}
        />
        <Layer
          id="unclustered-project"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          layout={{ visibility: showProjects ? "visible" : "none" }}
          paint={{
            "circle-color": [
              "match", ["get", "status"],
              "Completed", "#22c55e", "On-Going", "#f59e0b", "Not Yet Started", "#94a3b8", "#94a3b8",
            ],
            "circle-radius": 5,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#0f172a",
            "circle-opacity": 0.92,
          }}
        />
      </Source>

      <IncidentMapLayers
        incidents={incidents}
        showIncidents={showIncidents}
        evacCenters={evacCenters}
        showEvacCenters={showEvacCenters}
        onClusterSelect={onClusterSelect}
      />

      <RouteOverlay from={routeFrom} to={routeTo} facilityName={routeFacilityName} />

      {userLocation && (
        <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
          <div className="roberto-user-marker">
            <span className="roberto-user-marker__pulse" />
            <span className="roberto-user-marker__dot" />
          </div>
        </Marker>
      )}

      {popupInfo?.type === "project" && (
        <Popup
          longitude={popupInfo.lng} latitude={popupInfo.lat}
          closeButton closeOnClick={false} onClose={() => setPopupInfo(null)}
          maxWidth="320px" anchor="bottom" offset={12}
        >
          <ProjectPopupContent project={popupInfo.project} />
        </Popup>
      )}

      {popupInfo?.type === "incident" && (
        <Popup
          longitude={popupInfo.lng} latitude={popupInfo.lat}
          closeButton closeOnClick={false} onClose={() => setPopupInfo(null)}
          maxWidth="300px" anchor="bottom" offset={12}
        >
          <IncidentPopupContent incident={popupInfo.incident} />
        </Popup>
      )}

      {popupInfo?.type === "evac" && (
        <Popup
          longitude={popupInfo.lng} latitude={popupInfo.lat}
          closeButton closeOnClick={false} onClose={() => setPopupInfo(null)}
          maxWidth="280px" anchor="bottom" offset={12}
        >
          <EvacPopupContent center={popupInfo.center} />
        </Popup>
      )}

      {pendingConnections.length > 0 && (
        <Source id="pending-connections" type="geojson" data={connectionsGeoJSON}>
          <Layer
            id="pending-connections-line"
            type="line"
            paint={{
              "line-color": "#3b82f6",
              "line-width": 2,
              "line-opacity": 0.7,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}
    </Map>
    {showHazard && <HazardLegend />}
    {show3D && (
      <div className="absolute bottom-3 left-3 z-10 rounded-lg border border-purple-500/30 bg-purple-900/80 px-3 py-1.5 text-[11px] text-purple-200 backdrop-blur-sm">
        3D buildings are from Mapbox — hazard coloring is illustrative
      </div>
    )}
    {showHazard && onToggle3D && (
      <div className="absolute top-3 left-3 z-10 flex gap-1.5">
        <LayerToggle label="3D" active={show3D} onToggle={onToggle3D} color="#8b5cf6" />
        {show3D && onToggleWater && (
          <LayerToggle label="Water" active={showWater} onToggle={onToggleWater} color="#38bdf8" />
        )}
      </div>
    )}
    </div>
  )
}

const DEFAULT_STATUS_STYLE: React.CSSProperties = { background: "#94a3b820", color: "#94a3b8" }

const STATUS_LABEL_BG: Record<string, React.CSSProperties> = {
  Completed: { background: "#22c55e20", color: "#22c55e" },
  "On-Going": { background: "#f59e0b20", color: "#f59e0b" },
  "Not Yet Started": DEFAULT_STATUS_STYLE,
}

const INCIDENT_COLORS: Record<string, string> = {
  PING: "#ef4444", VERIFIED: "#3b82f6", PRIORITIZED: "#f97316",
  ASSIGNED: "#a855f7", RESOLVED: "#4ade80",
}

const EVAC_STATUS_LABELS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#22c55e20", fg: "#22c55e" },
  full: { bg: "#f59e0b20", fg: "#f59e0b" },
  closed: { bg: "#ef444420", fg: "#ef4444" },
}

function ProjectPopupContent({ project: p }: { project: Project }) {
  const statusStyle = STATUS_LABEL_BG[p.status] ?? DEFAULT_STATUS_STYLE
  return (
    <div>
      <div className="text-sm font-semibold leading-snug text-slate-100 mb-2">{p.name}</div>
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={statusStyle}>{p.status}</span>
        <span className="text-xs font-mono text-slate-300">{p.progress.toFixed(1)}%</span>
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

function IncidentPopupContent({ incident: inc }: { incident: IncidentRow }) {
  void GEMINI_STORAGE_KEY
  const color = INCIDENT_COLORS[inc.status] ?? "#94a3b8"

  return (
    <div>
      <div className="text-sm font-semibold leading-snug text-slate-100 mb-2">{inc.title}</div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: `${color}20`, color }}
        >{inc.status}</span>
        {inc.priority != null && <span className="text-xs font-mono text-slate-400">P{inc.priority}</span>}
      </div>
      {inc.description && (
        <p className="text-xs text-slate-300 leading-relaxed mb-2 line-clamp-3">{inc.description}</p>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <PopupField label="Reported" value={formatTime(inc.created_at)} />
        <PopupField label="Updated" value={formatTime(inc.updated_at)} />
      </div>
    </div>
  )
}

function EvacPopupContent({ center: ec }: { center: EvacCenterRow }) {
  const statusStyle = EVAC_STATUS_LABELS[ec.status] ?? { bg: "#94a3b820", fg: "#94a3b8" }
  const loadPct = ec.capacity ? Math.round((ec.current_load / ec.capacity) * 100) : null

  return (
    <div>
      <div className="text-sm font-semibold leading-snug text-slate-100 mb-2">{ec.name}</div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: statusStyle.bg, color: statusStyle.fg }}
        >{ec.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <PopupField label="Capacity" value={ec.capacity != null ? String(ec.capacity) : "N/A"} />
        <PopupField label="Current Load" value={String(ec.current_load)} />
        {loadPct != null && (
          <div className="col-span-2">
            <span className="text-slate-500 uppercase tracking-wider text-[9px]">Utilization</span>
            <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(loadPct, 100)}%`,
                  background: loadPct >= 90 ? "#ef4444" : loadPct >= 70 ? "#f59e0b" : "#22c55e",
                }}
              />
            </div>
            <div className="text-slate-300 text-[10px] mt-0.5">{loadPct}%</div>
          </div>
        )}
      </div>
    </div>
  )
}

function HazardLegend(): JSX.Element {
  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-lg border border-slate-600/50 bg-slate-900/90 px-3 py-2.5 backdrop-blur-sm">
      <div className="text-[11px] font-semibold text-slate-200 mb-1.5">Hazard Level</div>
      {([
        [HAZARD_COLORS[1], "Low"],
        [HAZARD_COLORS[2], "Medium"],
        [HAZARD_COLORS[3], "High"],
      ] as const).map(([color, label]) => (
        <div key={label} className="flex items-center gap-2 py-0.5">
          <span className="h-3 w-4 rounded-sm" style={{ backgroundColor: color, opacity: 0.85 }} />
          <span className="text-[11px] text-slate-300">{label}</span>
        </div>
      ))}
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

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}
