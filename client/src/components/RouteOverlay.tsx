import { useEffect, useState, type JSX } from "react"
import type { LatLngTuple } from "leaflet"
import { Polyline, Tooltip } from "react-leaflet"
import { fetchRoute } from "../lib/api"

type Point = { lat: number; lng: number }

type Props = {
  from: Point | null
  to: Point | null
  facilityName: string | null
}

export function RouteOverlay({ from, to, facilityName }: Props): JSX.Element | null {
  const [positions, setPositions] = useState<LatLngTuple[] | null>(null)
  const [routeMeta, setRouteMeta] = useState<{ km: number; minutes: number } | null>(null)

  useEffect(() => {
    if (!from || !to) {
      setPositions(null)
      setRouteMeta(null)
      return
    }

    const controller = new AbortController()
    let aborted = false

    controller.signal.addEventListener("abort", () => {
      aborted = true
    })

    fetchRoute(from.lat, from.lng, to.lat, to.lng, "foot")
      .then((res) => {
        if (aborted) return

        const route = res.routes[0]
        if (!route || route.geometry.coordinates.length === 0) {
          setPositions(null)
          setRouteMeta(null)
          return
        }

        const nextPositions = route.geometry.coordinates.map(
          ([lng, lat]): LatLngTuple => [lat, lng],
        )

        setPositions(nextPositions)
        setRouteMeta({
          km: route.distance / 1000,
          minutes: Math.round(route.duration / 60),
        })
      })
      .catch(() => {
        if (aborted) return
        setPositions(null)
        setRouteMeta(null)
      })

    return () => {
      controller.abort()
    }
  }, [from, to])

  if (!positions || !routeMeta) return null

  const label = facilityName ?? "Facility"

  return (
    <Polyline positions={positions} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }}>
      <Tooltip sticky>
        {label} - {routeMeta.km.toFixed(1)} km · ~{routeMeta.minutes} min walk
      </Tooltip>
    </Polyline>
  )
}
