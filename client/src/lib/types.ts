export type City = {
  id: string
  name: string
  city_norm: string
  effective_coverage_score: number
  raw_coverage_ratio: number
  avg_progress: number
  total_high_hazard_area_km2: number
  raw_covered_area_km2: number
  project_count: number
  status_breakdown: Record<string, number>
  budget_total_php: number
}

export type Project = {
  id: string
  name: string
  city_norm: string
  latitude: number
  longitude: number
  status: string
  progress: number
  category: string
  contractor: string
  budget: number
}

export type Meta = {
  version: string
  generated_at: string
  buffer_radius_m: number
  crs_computation: string
  crs_storage: string
  total_projects: number
  total_cities: number
  data_sources: Record<string, string>
  scoring_formula: string
}

export type AnalysisResponse = {
  analysis: string | null
  error?: string
}

export type CityDetail = {
  city: City
  projects: Project[]
}

export type WeatherCurrent = {
  source: string
  location: {
    lat: number
    lng: number
  }
  current: {
    observed_at: string
    temperature_c: number
    feels_like_c: number
    precipitation_mm: number
    rain_mm: number
    wind_kph: number
    weather_code: number
    weather_label: string
    is_day: boolean
  }
}

export type IncidentRow = {
  id: string
  title: string
  description: string
  latitude: number
  longitude: number
  status: string
  priority: number | null
  reporter_id: string
  version: number
  created_at: string
  updated_at: string
}

export type HelpNodeRow = {
  id: string
  user_id: string
  latitude: number
  longitude: number
  status: "active" | "inactive"
  created_at: string
  updated_at: string
}

export type InviteStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired"

export type ConnectionInviteRow = {
  id: string
  sender_node_id: string
  recipient_node_id: string
  status: InviteStatus
  version: number
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type ConversationRow = {
  id: string
  invite_id: string
  created_at: string
}

export type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  client_msg_id: string
  body: string
  created_at: string
}

export type SSEEvent =
  | { type: "incident_created"; incident: IncidentRow }
  | { type: "incident_updated"; incident: IncidentRow }
  | { type: "invite_created"; invite: ConnectionInviteRow }
  | { type: "invite_updated"; invite: ConnectionInviteRow; conversation?: ConversationRow }
  | { type: "message_created"; message: MessageRow; conversationId: string }

export type AuthUser = {
  id: string
  role: "reporter" | "coordinator" | "responder"
  username: string
}

export type LoginResponse = {
  token: string
  user: AuthUser
}

export type FacilityType = "evacuation_center" | "school" | "hospital" | "fire_station" | "police_station"

export type EvacCenter = {
  id: string
  name: string
  type: FacilityType
  latitude: number
  longitude: number
  distance_km: number
}

export type EvacCenterRow = {
  id: string
  name: string
  type: FacilityType
  latitude: number
  longitude: number
  capacity: number | null
  current_load: number
  status: "open" | "full" | "closed"
  created_at: string
  updated_at: string
}

export type OsrmRouteResponse = {
  code: "Ok" | "NoRoute" | "InvalidUrl" | "NoSegment"
  routes: Array<{
    distance: number
    duration: number
    geometry: {
      type: "LineString"
      coordinates: [number, number][]
    }
  }>
}

export type KpiResponse = {
  total_incidents: number
  by_status: Record<string, number>
  avg_acknowledge_time_ms: number | null
  avg_assignment_latency_ms: number | null
  resolution_rate: number
  avg_resolution_time_ms: number | null
}

export type IncidentEventRow = {
  id: string
  incident_id: string
  actor_id: string
  action: string
  old_status: string | null
  new_status: string | null
  payload: string | null
  created_at: string
}

export type ClusterSelection = {
  clickedLat: number
  clickedLng: number
  incidentIds: string[]
}

export type ActiveFilter = "coverage" | "hazard" | "projects" | "incidents" | "evac_centers"

export type PendingConnection = {
  from: [number, number] // [lng, lat]
  to: [number, number]   // [lng, lat]
}
