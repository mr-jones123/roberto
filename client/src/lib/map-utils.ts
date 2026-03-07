/** Convert {lat, lng} to Mapbox [lng, lat] tuple. */
export function toLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat]
}

/** Convert {lat, lng} object to Mapbox LngLatLike. */
export function toLngLatObj(point: { lat: number; lng: number }): { lng: number; lat: number } {
  return { lng: point.lng, lat: point.lat }
}

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined

export const MAP_STYLE = "mapbox://styles/mapbox/dark-v11"

/** Metro Manila center in [lng, lat] order (Mapbox convention) */
export const DEFAULT_CENTER: [number, number] = [120.9842, 14.5995]

export const DEFAULT_ZOOM = 11

export const HAZARD_COLORS: Record<number, string> = {
  1: "#fde68a",
  2: "#fb923c",
  3: "#ef4444",
}

export const BUILDING_3D_COLOR = "#475569"

export const PROJECT_STATUS_COLORS: Record<string, string> = {
  Completed: "#22c55e",
  "On-Going": "#f59e0b",
  "Not Yet Started": "#94a3b8",
}

export const INCIDENT_STATUS_COLORS: Record<string, string> = {
  PING: "#ef4444",
  VERIFIED: "#3b82f6",
  PRIORITIZED: "#f97316",
  ASSIGNED: "#a855f7",
  RESOLVED: "#22c55e",
}

export type FacilityStyleDef = { symbol: string; color: string }

export const FACILITY_STYLES: Record<string, FacilityStyleDef> = {
  hospital: { symbol: "✚", color: "#dc2626" },
  school: { symbol: "S", color: "#2563eb" },
  fire_station: { symbol: "🔥", color: "#ea580c" },
  police_station: { symbol: "★", color: "#1e3a8a" },
  evacuation_center: { symbol: "⛺", color: "#16a34a" },
}
