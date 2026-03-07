import { Router } from "express";

import { haversineKm } from "../lib/haversine.js";
import type { IncidentStore } from "../db/incident-store.js";
import type { EvacCenterRow, FacilityType } from "../db/incident-store.js";

const VALID_FACILITY_TYPES = new Set<FacilityType>([
  "evacuation_center", "school", "hospital", "fire_station", "police_station",
]);

type EvacCenterWithDistance = EvacCenterRow & { distance_km: number };

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

    const centers = store.listEvacCenters(type);
    res.json({ centers });
  });

  router.get("/nearest", (req, res) => {
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
    }));

    const sorted = withDistance.sort((a, b) => a.distance_km - b.distance_km);
    const nearest = sorted.slice(0, limit);

    res.json({ centers: nearest });
  });

  return router;
};
