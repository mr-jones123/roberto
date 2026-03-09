import { Router } from "express";

const MAPBOX_GEOCODING_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MIN_QUERY_LENGTH = 3;

type MapboxFeature = {
  id: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
  place_type?: string[];
  relevance?: number;
};

type MapboxGeocodeResponse = {
  features?: MapboxFeature[];
};

type GeocodeFeature = {
  id: string;
  name: string;
  place_name: string;
  latitude: number;
  longitude: number;
  place_type: string[];
  relevance: number | null;
};

type ProxyGeocodeResponse = {
  query: string;
  features: GeocodeFeature[];
};

type ProximityPoint = {
  lng: number;
  lat: number;
};

const getMapboxToken = (headerValue: unknown): string | null => {
  if (typeof headerValue === "string" && headerValue.trim() !== "") {
    return headerValue.trim();
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.VITE_MAPBOX_ACCESS_TOKEN;
  if (!token || token.trim() === "") return null;
  return token.trim();
};

const parseProximity = (value: unknown): ProximityPoint | null => {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split(",");
  if (parts.length !== 2) {
    return null;
  }

  const lng = Number(parts[0]);
  const lat = Number(parts[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lng, lat };
};

const normalizeLimit = (value: unknown): number => {
  if (typeof value !== "string") {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(parsed, MAX_LIMIT));
};

const mapFeature = (feature: MapboxFeature): GeocodeFeature | null => {
  if (!Array.isArray(feature.center) || feature.center.length < 2) {
    return null;
  }

  const lng = feature.center[0];
  const lat = feature.center[1];

  if (typeof lng !== "number" || !Number.isFinite(lng) || typeof lat !== "number" || !Number.isFinite(lat)) {
    return null;
  }

  const fallbackName = typeof feature.place_name === "string" && feature.place_name.trim() !== ""
    ? feature.place_name.trim()
    : "Unknown place";
  const name = typeof feature.text === "string" && feature.text.trim() !== ""
    ? feature.text.trim()
    : fallbackName;
  const placeName = typeof feature.place_name === "string" && feature.place_name.trim() !== ""
    ? feature.place_name.trim()
    : name;
  const placeType = Array.isArray(feature.place_type)
    ? feature.place_type.filter((entry): entry is string => typeof entry === "string")
    : [];
  const relevance = typeof feature.relevance === "number" && Number.isFinite(feature.relevance)
    ? feature.relevance
    : null;

  return {
    id: feature.id,
    name,
    place_name: placeName,
    latitude: lat,
    longitude: lng,
    place_type: placeType,
    relevance,
  };
};

export const createGeocodeRouter = (): Router => {
  const router = Router();

  router.get("/search", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (query.length < MIN_QUERY_LENGTH) {
      res.status(400).json({
        error: `Query must be at least ${MIN_QUERY_LENGTH} characters`,
      });
      return;
    }

    const proximityRaw = req.query.proximity;
    const proximity = proximityRaw === undefined ? null : parseProximity(proximityRaw);
    if (proximityRaw !== undefined && !proximity) {
      res.status(400).json({ error: "Invalid proximity. Format must be lng,lat" });
      return;
    }

    const mapboxToken = getMapboxToken(req.headers["x-mapbox-token"]);
    if (!mapboxToken) {
      res.status(503).json({
        error: "Geocoding service is not configured",
        code: "ConfigError",
      });
      return;
    }

    const params = new URLSearchParams({
      access_token: mapboxToken,
      autocomplete: "true",
      country: "PH",
      language: "en",
      limit: String(normalizeLimit(req.query.limit)),
      types: "address,place,locality,neighborhood,poi",
    });

    if (proximity) {
      params.set("proximity", `${proximity.lng},${proximity.lat}`);
    }

    const url = `${MAPBOX_GEOCODING_BASE}/${encodeURIComponent(query)}.json?${params.toString()}`;

    try {
      const mapboxRes = await fetch(url, {
        headers: {
          "User-Agent": "roberto-incident-command/1.0",
        },
      });

      if (!mapboxRes.ok) {
        res.status(502).json({
          error: "Geocoding service unavailable",
          code: "UpstreamError",
        });
        return;
      }

      const data = await mapboxRes.json() as MapboxGeocodeResponse;
      const features = (data.features ?? [])
        .map(mapFeature)
        .filter((feature): feature is GeocodeFeature => feature !== null);

      const payload: ProxyGeocodeResponse = {
        query,
        features,
      };

      res.json(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown geocoding error";
      console.error("[Geocode] Mapbox proxy failed:", message);
      res.status(502).json({ error: "Geocoding service unavailable", code: "ProxyError" });
    }
  });

  return router;
};
