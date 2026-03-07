import { useMemo, type JSX } from "react"
import { Source, Layer } from "react-map-gl/mapbox"
import { toLngLat } from "../lib/map-utils"
import type { EvacCenterRow, IncidentRow } from "../lib/types"

export const INCIDENT_LAYER_ID = "incidents-circle"
export const EVAC_LAYER_ID = "evac-circle"

type IncidentLayerProps = {
  incidents: IncidentRow[]
  showIncidents: boolean
  evacCenters: EvacCenterRow[]
  showEvacCenters: boolean
}

export function IncidentMapLayers({
  incidents,
  showIncidents,
  evacCenters,
  showEvacCenters,
}: IncidentLayerProps): JSX.Element {
  const incidentsGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: incidents.map((inc) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: toLngLat(inc.latitude, inc.longitude) },
      properties: { id: inc.id, status: inc.status },
    })),
  }), [incidents])

  const evacGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: evacCenters.map((ec) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: toLngLat(ec.latitude, ec.longitude) },
      properties: { id: ec.id, type: ec.type },
    })),
  }), [evacCenters])

  return (
    <>
      <Source id="incidents" type="geojson" data={incidentsGeoJSON}>
        <Layer
          id={INCIDENT_LAYER_ID}
          type="circle"
          layout={{ visibility: showIncidents ? "visible" : "none" }}
          paint={{
            "circle-radius": 8,
            "circle-color": [
              "match", ["get", "status"],
              "PING", "#ef4444",
              "VERIFIED", "#3b82f6",
              "PRIORITIZED", "#f97316",
              "ASSIGNED", "#a855f7",
              "RESOLVED", "#22c55e",
              "#94a3b8",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#0f172a",
            "circle-opacity": 0.75,
            "circle-pitch-alignment": "viewport",
            "circle-pitch-scale": "viewport",
          }}
        />
      </Source>
      <Source id="evac-centers" type="geojson" data={evacGeoJSON}>
        <Layer
          id={EVAC_LAYER_ID}
          type="circle"
          layout={{ visibility: showEvacCenters ? "visible" : "none" }}
          paint={{
            "circle-radius": 12,
            "circle-color": [
              "match", ["get", "type"],
              "hospital", "#dc2626",
              "school", "#2563eb",
              "fire_station", "#ea580c",
              "police_station", "#1e3a8a",
              "evacuation_center", "#16a34a",
              "#16a34a",
            ],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.9,
            "circle-pitch-alignment": "viewport",
            "circle-pitch-scale": "viewport",
          }}
        />
      </Source>
    </>
  )
}
