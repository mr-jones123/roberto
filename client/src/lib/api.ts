import type { AnalysisResponse, City, CityDetail, Meta, Project } from "./types"

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
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
