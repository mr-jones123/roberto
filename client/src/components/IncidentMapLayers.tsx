import { useMemo, type JSX } from "react"
import { Source, Layer } from "react-map-gl/mapbox"
import { toLngLat } from "../lib/map-utils"
import { clusterPingIncidents } from "../lib/cluster-utils"
import type { ClusterSelection, EvacCenterRow, IncidentRow } from "../lib/types"

export const INCIDENT_LAYER_ID = "incidents-circle"
export const EVAC_LAYER_ID = "evac-circle"
export const PING_CLUSTER_LAYER_ID = "ping-clusters-circle"
export const PING_CLUSTER_COUNT_ID = "ping-clusters-count"
export const PING_SINGLE_LAYER_ID = "ping-singles-circle"

type IncidentLayerProps = {
  incidents: IncidentRow[]
  showIncidents: boolean
  evacCenters: EvacCenterRow[]
  showEvacCenters: boolean
  onClusterSelect?: (selection: ClusterSelection) => void
}

function buildIncidentDisplayCoordinates(incidents: IncidentRow[]): Map<string, [number, number]> {
  const groups = new Map<string, IncidentRow[]>()
  const display = new Map<string, [number, number]>()

  for (const inc of incidents) {
    const key = `${inc.latitude.toFixed(6)},${inc.longitude.toFixed(6)}`
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(inc)
    } else {
      groups.set(key, [inc])
    }
  }

  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0]!
      display.set(only.id, toLngLat(only.latitude, only.longitude))
      continue
    }

    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id))
    const centerLat = sorted[0]!.latitude
    const centerLng = sorted[0]!.longitude
    const latRad = centerLat * (Math.PI / 180)
    const correction = Math.max(Math.cos(latRad), 0.25)
    const ringRadiusDeg = 0.00018 + Math.min(sorted.length, 8) * 0.00002

    for (let i = 0; i < sorted.length; i += 1) {
      const incident = sorted[i]!
      const angle = (2 * Math.PI * i) / sorted.length
      const latOffset = Math.sin(angle) * ringRadiusDeg
      const lngOffset = (Math.cos(angle) * ringRadiusDeg) / correction
      display.set(incident.id, [centerLng + lngOffset, centerLat + latOffset])
    }
  }

  return display
}

export function IncidentMapLayers({
  incidents,
  showIncidents,
  evacCenters,
  showEvacCenters,
}: IncidentLayerProps): JSX.Element {
  const incidentDisplayCoordinates = useMemo(
    () => buildIncidentDisplayCoordinates(incidents),
    [incidents],
  )

  const pingClusters = useMemo(
    () => clusterPingIncidents(incidents, 300),
    [incidents],
  )

  // Non-PING incidents rendered as normal circles
  const nonPingGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: incidents
      .filter((inc) => inc.status !== "PING")
      .map((inc) => {
        const coordinates = incidentDisplayCoordinates.get(inc.id) ?? toLngLat(inc.latitude, inc.longitude)
        return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates },
        properties: { id: inc.id, status: inc.status },
        }
      }),
  }), [incidents, incidentDisplayCoordinates])

  // Single-member clusters rendered as normal PING circles
  const singlePingGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: pingClusters
      .filter((c) => c.members.length === 1)
      .map((c) => {
        const inc = c.members[0]!
        const coordinates = incidentDisplayCoordinates.get(inc.id) ?? toLngLat(inc.latitude, inc.longitude)
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates },
          properties: { id: inc.id, status: "PING" },
        }
      }),
  }), [pingClusters, incidentDisplayCoordinates])

  // Multi-member clusters rendered as larger cluster markers
  const clusterGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: pingClusters
      .filter((c) => c.members.length > 1)
      .map((c) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: toLngLat(c.center.lat, c.center.lng) },
        properties: {
          clusterId: c.id,
          count: c.members.length,
          memberIds: JSON.stringify(c.members.map((m) => m.id)),
          centerLat: c.center.lat,
          centerLng: c.center.lng,
        },
      })),
  }), [pingClusters])

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
      {/* Non-PING incidents */}
      <Source id="incidents" type="geojson" data={nonPingGeoJSON}>
        <Layer
          id={INCIDENT_LAYER_ID}
          type="circle"
          layout={{ visibility: showIncidents ? "visible" : "none" }}
          paint={{
            "circle-radius": 8,
            "circle-color": [
              "match", ["get", "status"],
              "VERIFIED", "#3b82f6",
              "PRIORITIZED", "#f97316",
              "ASSIGNED", "#a855f7",
              "RESOLVED", "#4ade80",
              "#94a3b8",
            ],
            "circle-stroke-width": [
              "case",
              ["==", ["get", "status"], "RESOLVED"],
              2.6,
              2,
            ],
            "circle-stroke-color": [
              "case",
              ["==", ["get", "status"], "RESOLVED"],
              "#ecfccb",
              "#0f172a",
            ],
            "circle-opacity": 1,
            "circle-pitch-alignment": "viewport",
            "circle-pitch-scale": "viewport",
          }}
        />
      </Source>

      {/* Standalone PING incidents (single-member clusters) */}
      <Source id="ping-singles" type="geojson" data={singlePingGeoJSON}>
        <Layer
          id={PING_SINGLE_LAYER_ID}
          type="circle"
          layout={{ visibility: showIncidents ? "visible" : "none" }}
          paint={{
            "circle-radius": 8,
            "circle-color": "#ef4444",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#0f172a",
            "circle-opacity": 1,
            "circle-pitch-alignment": "viewport",
            "circle-pitch-scale": "viewport",
          }}
        />
      </Source>

      {/* Multi-member PING clusters */}
      <Source id="ping-clusters" type="geojson" data={clusterGeoJSON}>
        <Layer
          id={PING_CLUSTER_LAYER_ID}
          type="circle"
          layout={{ visibility: showIncidents ? "visible" : "none" }}
          paint={{
            "circle-radius": [
              "step", ["get", "count"],
              14,   // 2 members
              5, 18,  // 5+ members
              10, 22, // 10+ members
            ],
            "circle-color": "#ef4444",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#fca5a5",
            "circle-opacity": 1,
            "circle-pitch-alignment": "viewport",
            "circle-pitch-scale": "viewport",
          }}
        />
        <Layer
          id={PING_CLUSTER_COUNT_ID}
          type="symbol"
          layout={{
            visibility: showIncidents ? "visible" : "none",
            "text-field": ["concat", ["get", "count"]],
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": "#ffffff" }}
        />
      </Source>

      {/* Evac centers */}
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
