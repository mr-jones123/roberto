import type { IncidentRow } from "./types"

export type PingCluster = {
  id: string
  center: { lat: number; lng: number }
  members: IncidentRow[]
}

const EARTH_RADIUS_M = 6_371_000

/**
 * Haversine distance between two WGS84 points, returned in meters.
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Greedy single-linkage clustering of PING-status incidents within `radiusMeters`.
 *
 * Non-PING incidents are silently skipped. For each PING incident (in input
 * order), the first existing cluster whose centroid is within `radiusMeters` is
 * chosen; if none qualifies a new cluster is created. Centroids are recalculated
 * as the arithmetic mean of all member coordinates after each insertion.
 */
export function clusterPingIncidents(
  incidents: IncidentRow[],
  radiusMeters: number = 300,
): PingCluster[] {
  const clusters: PingCluster[] = []

  for (const incident of incidents) {
    if (incident.status !== "PING") continue

    let merged = false
    for (const cluster of clusters) {
      const d = distanceMeters(
        cluster.center.lat,
        cluster.center.lng,
        incident.latitude,
        incident.longitude,
      )
      if (d <= radiusMeters) {
        cluster.members.push(incident)
        const n = cluster.members.length
        cluster.center = {
          lat: cluster.members.reduce((s, m) => s + m.latitude, 0) / n,
          lng: cluster.members.reduce((s, m) => s + m.longitude, 0) / n,
        }
        merged = true
        break
      }
    }

    if (!merged) {
      clusters.push({
        id: `cluster-${clusters.length}`,
        center: { lat: incident.latitude, lng: incident.longitude },
        members: [incident],
      })
    }
  }

  return clusters
}

export function sortByDistanceFromPoint(
  incidents: IncidentRow[],
  lat: number,
  lng: number,
): IncidentRow[] {
  return [...incidents].sort(
    (a, b) =>
      distanceMeters(lat, lng, a.latitude, a.longitude) -
      distanceMeters(lat, lng, b.latitude, b.longitude),
  )
}
