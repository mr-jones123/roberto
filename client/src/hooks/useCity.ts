import { useEffect, useState } from "react"
import { fetchCity } from "../lib/api"
import type { CityDetail } from "../lib/types"

type UseCityResult = {
  detail: CityDetail | null
  loading: boolean
  error: string | null
}

export function useCity(cityId: string | null): UseCityResult {
  const [detail, setDetail] = useState<CityDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cityId) {
      setDetail(null)
      return
    }

    setLoading(true)
    setError(null)

    fetchCity(cityId)
      .then(setDetail)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load city")
        setDetail(null)
      })
      .finally(() => setLoading(false))
  }, [cityId])

  return { detail, loading, error }
}
