import { Router } from "express";

import { haversineKm } from "../lib/haversine.js";
import type { IncidentStore } from "../db/incident-store.js";
import type { EvacCenterRow, FacilityType } from "../db/incident-store.js";

const VALID_FACILITY_TYPES = new Set<FacilityType>([
  "evacuation_center", "school", "hospital", "fire_station", "police_station",
]);
const HAVERSINE_PRESELECT_COUNT = 10;
const MAPBOX_MATRIX_BASE = "https://api.mapbox.com/directions-matrix/v1/mapbox/walking";

type EvacCenterWithDistance = EvacCenterRow & {
  distance_km: number;
  eta_minutes: number | null;
};

type MapboxMatrixResponse = {
  durations?: Array<Array<number | null>>;
};

const serializeCenter = (center: EvacCenterRow): EvacCenterRow => ({
  id: center.id,
  name: center.name,
  type: center.type,
  latitude: center.latitude,
  longitude: center.longitude,
  phone: center.phone,
  landline: center.landline,
  capacity: center.capacity,
  current_load: center.current_load,
  status: center.status,
  created_at: center.created_at,
  updated_at: center.updated_at,
});

const serializeCenterWithDistance = (center: EvacCenterWithDistance): EvacCenterWithDistance => ({
  ...serializeCenter(center),
  distance_km: center.distance_km,
  eta_minutes: center.eta_minutes,
});

const getMapboxToken = (headerValue: unknown): string | null => {
  if (typeof headerValue === "string" && headerValue.trim() !== "") {
    return headerValue.trim();
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!token || token.trim() === "") return null;
  return token.trim();
};

const fetchEtaMinutes = async (
  originLat: number,
  originLng: number,
  candidates: EvacCenterWithDistance[],
  token: string,
): Promise<Array<number | null> | null> => {
  if (candidates.length === 0) return [];

  const coordinates = [`${originLng},${originLat}`];
  for (const candidate of candidates) {
    coordinates.push(`${candidate.longitude},${candidate.latitude}`);
  }

  const destinations = candidates
    .map((_, index) => index + 1)
    .join(";");

  const url = `${MAPBOX_MATRIX_BASE}/${coordinates.join(";")}?sources=0&destinations=${destinations}&annotations=duration&access_token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "roberto-incident-command/1.0",
      },
    });
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as MapboxMatrixResponse;
    const row = data.durations?.[0];
    if (!row || row.length < candidates.length) {
      return null;
    }

    return candidates.map((_, index) => {
      const durationSeconds = row[index];
      if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds)) return null;
      return Math.max(1, Math.round(durationSeconds / 60));
    });
  } catch {
    return null;
  }
};

const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

export const createEvacCentersRouter = (store: IncidentStore): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    const typeParam = req.query.type as string | undefined;
    const type = typeParam && VALID_FACILITY_TYPES.has(typeParam as FacilityType)
      ? typeParam as FacilityType
      : undefined;

    const centers = store.listEvacCenters(type).map(serializeCenter);
    res.json({ centers });
  });

  router.get("/nearest", async (req, res) => {
    const lat = Number.parseFloat(req.query.lat as string);
    const lng = Number.parseFloat(req.query.lng as string);
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 6, 20);
    const typeParam = req.query.type as string | undefined;
    const type = typeParam && VALID_FACILITY_TYPES.has(typeParam as FacilityType)
      ? typeParam as FacilityType
      : undefined;

    if (!isValidCoordinate(lat, lng)) {
      res.status(400).json({ error: "Invalid coordinates" });
      return;
    }

    const centers = store.listEvacCenters(type);
    const withDistance: EvacCenterWithDistance[] = centers.map((center) => ({
      ...center,
      distance_km: haversineKm(lat, lng, center.latitude, center.longitude),
      eta_minutes: null,
    }));

    const sortedByDistance = withDistance.sort((a, b) => a.distance_km - b.distance_km);
    const preselectCount = Math.min(Math.max(limit, HAVERSINE_PRESELECT_COUNT), sortedByDistance.length);
    const preselected = sortedByDistance.slice(0, preselectCount);

    const mapboxToken = getMapboxToken(req.headers["x-mapbox-token"]);

    if (mapboxToken && preselected.length > 0) {
        const etaMinutes = await fetchEtaMinutes(lat, lng, preselected, mapboxToken);
        if (etaMinutes && etaMinutes.length === preselected.length) {
          for (let index = 0; index < preselected.length; index += 1) {
            const candidate = preselected[index];
            if (!candidate) continue;
            candidate.eta_minutes = etaMinutes[index] ?? null;
          }

        preselected.sort((a, b) => {
          const aEta = a.eta_minutes;
          const bEta = b.eta_minutes;
          if (aEta != null && bEta != null) {
            return aEta - bEta;
          }
          if (aEta != null) return -1;
          if (bEta != null) return 1;
          return a.distance_km - b.distance_km;
        });
      }
    }

    const nearest = preselected.slice(0, limit).map(serializeCenterWithDistance);

    res.json({ centers: nearest });
  });

  return router;
};
