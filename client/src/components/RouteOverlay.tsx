import { useEffect, useMemo, useState, type JSX } from "react"
import { Source, Layer, Popup, useMap } from "react-map-gl/mapbox"
import { fetchRoute } from "../lib/api"

type Point = { lat: number; lng: number }

type Props = {
  from: Point | null
  to: Point | null
  facilityName: string | null
}

type RouteMeta = { km: number; minutes: number; midpoint: [number, number] }

export function RouteOverlay({ from, to, facilityName }: Props): JSX.Element | null {
  const [coordinates, setCoordinates] = useState<[number, number][] | null>(null)
  const [routeMeta, setRouteMeta] = useState<RouteMeta | null>(null)
  const maps = useMap()

  useEffect(() => {
    if (!from || !to) {
      setCoordinates(null)
      setRouteMeta(null)
      return
    }

    let cancelled = false

    fetchRoute(from.lat, from.lng, to.lat, to.lng, "foot")
      .then((res) => {
        if (cancelled) return
        const route = res.routes[0]
        if (!route || route.geometry.coordinates.length === 0) {
          setCoordinates(null)
          setRouteMeta(null)
          return
        }
        const coords = route.geometry.coordinates
        setCoordinates(coords)
        const midIdx = Math.floor(coords.length / 2)
        const mid = coords[midIdx]
        if (mid) {
          setRouteMeta({ km: route.distance / 1000, minutes: Math.round(route.duration / 60), midpoint: mid })
        }
      })
      .catch(() => {
        if (cancelled) return
        setCoordinates(null)
        setRouteMeta(null)
      })

    return () => { cancelled = true }
  }, [from, to])

  const routeGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!coordinates) return null
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "LineString", coordinates }, properties: {} }],
    }
  }, [coordinates])

  useEffect(() => {
    if (!routeGeoJSON) return
    const map = maps.current?.getMap()
    if (!map) return

    const layerId = "route-line"
    const dashCycle = 3.5
    let animationId = 0

    const animate = (time: number) => {
      const dashOffset = (time / 120) % dashCycle
      const leadDash = Math.max(0.01, dashOffset)
      const trailDash = Math.max(0.01, dashCycle - dashOffset)

      if (map.getLayer(layerId)) {
        map.setPaintProperty(layerId, "line-dasharray", [leadDash, 2, trailDash, 2])
      }

      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [maps, routeGeoJSON])

  if (!routeGeoJSON || !routeMeta) return null

  const label = facilityName ?? "Facility"

  return (
    <>
      <Source id="route" type="geojson" data={routeGeoJSON}>
        <Layer
          id="route-line"
          type="line"
          layout={{ "line-join": "round", "line-cap": "round" }}
          paint={{ "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.85, "line-dasharray": [0.01, 2, 3.49, 2] }}
        />
      </Source>
      <Popup
        longitude={routeMeta.midpoint[0]}
        latitude={routeMeta.midpoint[1]}
        closeButton={false}
        closeOnClick={false}
        anchor="bottom"
        offset={12}
      >
        <div className="text-xs font-medium text-slate-200 whitespace-nowrap">
          {label} — {routeMeta.km.toFixed(1)} km · ~{routeMeta.minutes} min walk
        </div>
      </Popup>
    </>
  )
}
