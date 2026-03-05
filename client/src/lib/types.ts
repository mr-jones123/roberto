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
