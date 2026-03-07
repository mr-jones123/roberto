import L from "leaflet"
import type React from "react"
import { CircleMarker, Marker, Pane, Popup } from "react-leaflet"
import type { EvacCenterRow, FacilityType, IncidentRow } from "../lib/types"

const INCIDENT_STATUS_COLORS: Record<string, string> = {
  PING: "#ef4444",
  VERIFIED: "#3b82f6",
  PRIORITIZED: "#f97316",
  ASSIGNED: "#a855f7",
  RESOLVED: "#22c55e",
}

const EVAC_STATUS_LABELS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#22c55e20", fg: "#22c55e" },
  full: { bg: "#f59e0b20", fg: "#f59e0b" },
  closed: { bg: "#ef444420", fg: "#ef4444" },
}

const FACILITY_STYLE: Record<FacilityType, { symbol: string; color: string }> = {
  hospital: { symbol: "✚", color: "#dc2626" },
  school: { symbol: "S", color: "#2563eb" },
  fire_station: { symbol: "🔥", color: "#ea580c" },
  police_station: { symbol: "★", color: "#1e3a8a" },
  evacuation_center: { symbol: "⛺", color: "#16a34a" },
}

const FACILITY_ICONS: Partial<Record<FacilityType, L.DivIcon>> = {}

function getFacilityIcon(type: FacilityType): L.DivIcon {
  const cached = FACILITY_ICONS[type]
  if (cached) return cached

  const style = FACILITY_STYLE[type]
  const icon = L.divIcon({
    className: "roberto-facility-marker",
    html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:${style.color};color:#ffffff;font-size:15px;font-weight:700;line-height:1;border:2.5px solid #ffffff;box-shadow:0 2px 10px rgba(0,0,0,0.4);">${style.symbol}</span>`,
    iconSize: L.point(32, 32, true),
    iconAnchor: L.point(16, 16, true),
    popupAnchor: [0, -18],
  })

  FACILITY_ICONS[type] = icon
  return icon
}

type IncidentLayerProps = {
  incidents: IncidentRow[]
  showIncidents: boolean
  evacCenters: EvacCenterRow[]
  showEvacCenters: boolean
}

export function IncidentMapLayers({
  incidents,
  showIncidents,
  evacCenters,
  showEvacCenters,
}: IncidentLayerProps): React.JSX.Element {
  return (
    <>
      {showIncidents && (
        <Pane name="incidents" style={{ zIndex: 460 }}>
          {incidents.map((inc) => (
            <CircleMarker
              key={inc.id}
              center={[inc.latitude, inc.longitude]}
              radius={8}
              className="roberto-incident-marker"
              pathOptions={{
                color: INCIDENT_STATUS_COLORS[inc.status] ?? "#94a3b8",
                fillColor: INCIDENT_STATUS_COLORS[inc.status] ?? "#94a3b8",
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Popup className="roberto-popup" pane="popupPane" maxWidth={300} minWidth={220}>
                <IncidentPopupContent incident={inc} />
              </Popup>
            </CircleMarker>
          ))}
        </Pane>
      )}

      {showEvacCenters && (
        <Pane name="evac-centers" style={{ zIndex: 470 }}>
          {evacCenters.map((ec) => (
            <Marker
              key={ec.id}
              position={[ec.latitude, ec.longitude]}
              icon={getFacilityIcon(ec.type)}
            >
              <Popup className="roberto-popup" pane="popupPane" maxWidth={280} minWidth={200}>
                <EvacPopupContent center={ec} />
              </Popup>
            </Marker>
          ))}
        </Pane>
      )}
    </>
  )
}

function IncidentPopupContent({ incident: inc }: { incident: IncidentRow }) {
  const color = INCIDENT_STATUS_COLORS[inc.status] ?? "#94a3b8"

  return (
    <div className="roberto-popup-inner">
      <div className="text-sm font-semibold leading-snug text-slate-100 mb-2">
        {inc.title}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: `${color}20`, color }}
        >
          {inc.status}
        </span>
        {inc.priority != null && (
          <span className="text-xs font-mono text-slate-400">
            P{inc.priority}
          </span>
        )}
      </div>
      {inc.description && (
        <p className="text-xs text-slate-300 leading-relaxed mb-2 line-clamp-3">
          {inc.description}
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <FieldCell label="Reported" value={formatTime(inc.created_at)} />
        <FieldCell label="Updated" value={formatTime(inc.updated_at)} />
      </div>
    </div>
  )
}

function EvacPopupContent({ center: ec }: { center: EvacCenterRow }) {
  const statusStyle = EVAC_STATUS_LABELS[ec.status] ?? { bg: "#94a3b820", fg: "#94a3b8" }
  const loadPct = ec.capacity ? Math.round((ec.current_load / ec.capacity) * 100) : null

  return (
    <div className="roberto-popup-inner">
      <div className="text-sm font-semibold leading-snug text-slate-100 mb-2">
        {ec.name}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: statusStyle.bg, color: statusStyle.fg }}
        >
          {ec.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <FieldCell
          label="Capacity"
          value={ec.capacity != null ? String(ec.capacity) : "N/A"}
        />
        <FieldCell label="Current Load" value={String(ec.current_load)} />
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

function FieldCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500 uppercase tracking-wider text-[9px]">{label}</span>
      <div className="text-slate-200 leading-tight truncate" title={value}>{value}</div>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}
