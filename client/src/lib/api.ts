import type {
  AnalysisResponse,
  City,
  CityDetail,
  ConnectionInviteRow,
  ConversationRow,
  EvacCenter,
  EvacCenterRow,
  HelpNodeRow,
  IncidentEventRow,
  IncidentNodeGuidanceRequest,
  IncidentNodeGuidanceResponse,
  IncidentRow,
  KpiResponse,
  LoginResponse,
  MessageRow,
  Meta,
  OsrmRouteResponse,
  Project,
  WeatherCurrent,
} from "./types"

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function authFetch<T>(url: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    const err = new Error(body.error ?? `Request failed: ${res.status}`)
    ;(err as Error & { status: number }).status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export function fetchCities(): Promise<City[]> {
  return fetchJson<City[]>("/api/cities")
}

export function fetchCity(id: string): Promise<CityDetail> {
  return fetchJson<CityDetail>(`/api/cities/${id}`)
}

export function fetchBoundaries(): Promise<GeoJSON.FeatureCollection> {
  return fetchJson<GeoJSON.FeatureCollection>("/api/boundaries")
}

export function fetchMeta(): Promise<Meta> {
  return fetchJson<Meta>("/api/meta")
}

export function fetchAllProjects(): Promise<Project[]> {
  return fetchJson<Project[]>("/api/projects")
}

export function fetchHazardZones(): Promise<GeoJSON.FeatureCollection> {
  return fetchJson<GeoJSON.FeatureCollection>("/api/hazard")
}

export function fetchAnalysis(
  id: string,
  apiKey: string,
  audience: "public" | "coordinator" | "responder" = "public",
): Promise<AnalysisResponse> {
  return fetch(`/api/cities/${id}/analysis?audience=${audience}`, {
    headers: { "X-Gemini-Key": apiKey },
  }).then((res) => {
    if (!res.ok) return res.json() as Promise<AnalysisResponse>
    return res.json() as Promise<AnalysisResponse>
  })
}

// --- Incident Command API ---

export function loginUser(username: string, password: string): Promise<LoginResponse> {
  return fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then(async (res) => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
      throw new Error(body.error ?? "Login failed")
    }
    return res.json() as Promise<LoginResponse>
  })
}

export function createIncident(
  token: string,
  data: { title: string; description: string; latitude: number; longitude: number },
): Promise<{ incident: IncidentRow }> {
  return authFetch("/api/incidents", token, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export function fetchIncidents(token: string): Promise<{ incidents: IncidentRow[] }> {
  return authFetch("/api/incidents", token)
}

export function fetchIncidentDetail(
  token: string,
  id: string,
): Promise<{ incident: IncidentRow; events: unknown[] }> {
  return authFetch(`/api/incidents/${id}`, token)
}

export function fetchEvacCenters(): Promise<{ centers: EvacCenterRow[] }> {
  return fetchJson("/api/evac-centers")
}

export function fetchNearestEvacCenters(
  lat: number,
  lng: number,
  limit = 6,
): Promise<{ centers: EvacCenter[] }> {
  return fetchJson(`/api/evac-centers/nearest?lat=${lat}&lng=${lng}&limit=${limit}`)
}

export function fetchRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  profile: "foot" | "driving" | "bike" = "foot",
): Promise<OsrmRouteResponse> {
  return fetchJson(`/api/route?profile=${profile}&from=${fromLng},${fromLat}&to=${toLng},${toLat}`)
}

export function fetchCurrentWeather(lat: number, lng: number): Promise<WeatherCurrent> {
  return fetchJson(`/api/weather/current?lat=${lat}&lng=${lng}`)
}

export function fetchIncidentNodeGuidance(
  payload: IncidentNodeGuidanceRequest,
  apiKey?: string,
): Promise<IncidentNodeGuidanceResponse> {
  return fetch("/api/incidents/node-guidance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && apiKey.trim() !== "" ? { "X-Gemini-Key": apiKey.trim() } : {}),
    },
    body: JSON.stringify(payload),
  }).then(async (res) => {
    const body = await res.json().catch(() => ({})) as IncidentNodeGuidanceResponse & { error?: string }
    if (!res.ok) {
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }
    return body
  })
}

export function verifyIncident(
  token: string,
  id: string,
  version: number,
): Promise<{ incident: IncidentRow }> {
  return authFetch(`/api/incidents/${id}/verify`, token, {
    method: "PATCH",
    body: JSON.stringify({ version }),
  })
}

export function prioritizeIncident(
  token: string,
  id: string,
  priority: number,
  version: number,
): Promise<{ incident: IncidentRow }> {
  return authFetch(`/api/incidents/${id}/prioritize`, token, {
    method: "PATCH",
    body: JSON.stringify({ priority, version }),
  })
}

export function assignIncident(
  token: string,
  id: string,
  responderId: string,
  version: number,
): Promise<{ incident: IncidentRow }> {
  return authFetch(`/api/incidents/${id}/assign`, token, {
    method: "PATCH",
    body: JSON.stringify({ responderId, version }),
  })
}

export function resolveIncident(
  token: string,
  id: string,
  note: string,
  version: number,
): Promise<{ incident: IncidentRow }> {
  return authFetch(`/api/incidents/${id}/resolve`, token, {
    method: "PATCH",
    body: JSON.stringify({ note, version }),
  })
}

export function rejectIncident(
  token: string,
  id: string,
  reason: string,
  version: number,
): Promise<{ incident: IncidentRow }> {
  return authFetch(`/api/incidents/${id}/reject`, token, {
    method: "PATCH",
    body: JSON.stringify({ reason, version }),
  })
}

export function fetchKpi(token: string): Promise<KpiResponse> {
  return authFetch("/api/kpi", token)
}

export function fetchIncidentEvents(
  token: string,
  incidentId: string,
): Promise<{ events: IncidentEventRow[] }> {
  return authFetch(`/api/incidents/${incidentId}`, token).then(
    (res) => ({ events: (res as { events: IncidentEventRow[] }).events })
  )
}

// --- Node Connection Chat API ---

// Nodes
export function registerNode(
  token: string,
  data: { latitude: number; longitude: number },
): Promise<{ node: HelpNodeRow }> {
  return authFetch("/api/nodes", token, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export function fetchNearbyNodes(
  token: string,
  lat: number,
  lng: number,
  radiusKm = 10,
): Promise<{ nodes: HelpNodeRow[] }> {
  return authFetch(`/api/nodes/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`, token)
}

export function fetchNode(token: string, id: string): Promise<{ node: HelpNodeRow }> {
  return authFetch(`/api/nodes/${id}`, token)
}

// Invites
export function createInvite(
  token: string,
  recipientNodeId: string,
): Promise<{ invite: ConnectionInviteRow }> {
  return authFetch("/api/invites", token, {
    method: "POST",
    body: JSON.stringify({ recipient_node_id: recipientNodeId }),
  })
}

export function fetchInvites(token: string): Promise<{ invites: ConnectionInviteRow[] }> {
  return authFetch("/api/invites", token)
}

export function respondToInvite(
  token: string,
  id: string,
  action: "accepted" | "rejected",
  version: number,
): Promise<{ invite: ConnectionInviteRow; conversation?: ConversationRow }> {
  return authFetch(`/api/invites/${id}/respond`, token, {
    method: "PATCH",
    body: JSON.stringify({ action, version }),
  })
}

export function cancelInvite(
  token: string,
  id: string,
  version: number,
): Promise<{ invite: ConnectionInviteRow }> {
  return authFetch(`/api/invites/${id}/cancel`, token, {
    method: "PATCH",
    body: JSON.stringify({ version }),
  })
}

// Conversations
export function fetchConversations(token: string): Promise<{ conversations: ConversationRow[] }> {
  return authFetch("/api/conversations", token)
}

export function fetchMessages(
  token: string,
  conversationId: string,
  before?: string,
): Promise<{ messages: MessageRow[] }> {
  const url = before
    ? `/api/conversations/${conversationId}/messages?before=${before}`
    : `/api/conversations/${conversationId}/messages`
  return authFetch(url, token)
}

export function sendMessage(
  token: string,
  conversationId: string,
  clientMsgId: string,
  body: string,
): Promise<{ message: MessageRow }> {
  return authFetch(`/api/conversations/${conversationId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ client_msg_id: clientMsgId, body }),
  })
}

// Catch-up
export function fetchInvitesCatchup(
  token: string,
  since: string,
): Promise<{ invites: ConnectionInviteRow[] }> {
  return authFetch(`/api/invites/catchup?since=${encodeURIComponent(since)}`, token)
}

export function fetchConversationsCatchup(
  token: string,
  since: string,
): Promise<{ messages: MessageRow[] }> {
  return authFetch(`/api/conversations/catchup?since=${encodeURIComponent(since)}`, token)
}
