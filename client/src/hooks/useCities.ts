import { useEffect, useState } from "react"
import { fetchAllProjects, fetchBoundaries, fetchCities, fetchHazardZones } from "../lib/api"
import type { City, Project } from "../lib/types"

type UseCitiesResult = {
  cities: City[]
  boundaries: GeoJSON.FeatureCollection | null
  hazardZones: GeoJSON.FeatureCollection | null
  allProjects: Project[]
  loading: boolean
  error: string | null
}

export function useCities(): UseCitiesResult {
  const [cities, setCities] = useState<City[]>([])
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null)
  const [hazardZones, setHazardZones] = useState<GeoJSON.FeatureCollection | null>(null)
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchCities(), fetchBoundaries(), fetchHazardZones(), fetchAllProjects()])
      .then(([c, b, h, p]) => {
        setCities(c)
        setBoundaries(b)
        setHazardZones(h)
        setAllProjects(p)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load data")
      })
      .finally(() => setLoading(false))
  }, [])

  return { cities, boundaries, hazardZones, allProjects, loading, error }
}
