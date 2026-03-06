import type { AnalysisResponse, City, CityDetail, EvacCenter, IncidentRow, LoginResponse, Meta, Project } from "./types"

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

export function fetchAnalysis(id: string, apiKey: string): Promise<AnalysisResponse> {
  return fetch(`/api/cities/${id}/analysis`, {
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

export function fetchNearestEvacCenters(
  lat: number,
  lng: number,
): Promise<{ centers: EvacCenter[] }> {
  return fetchJson(`/api/evac-centers/nearest?lat=${lat}&lng=${lng}&limit=3`)
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
