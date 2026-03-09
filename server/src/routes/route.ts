import { Router } from "express";

const MAPBOX_DIRECTIONS_BASE = "https://api.mapbox.com/directions/v5";
const VALID_PROFILES = new Set(["foot", "driving", "bike"]);

type RouteProfile = "foot" | "driving" | "bike";

type MapboxDirectionsResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
  }>;
};

type ProxyRouteResponse = {
  code: "Ok" | "NoRoute";
  routes: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
  }>;
};

const isValidCoordPair = (s: string): boolean => {
  const parts = s.split(",");
  if (parts.length !== 2) return false;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  return (
    Number.isFinite(lng) && Number.isFinite(lat) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};

export const createRouteRouter = (): Router => {
  const router = Router();

  const mapProfileToMapbox = (profile: RouteProfile): string => {
    if (profile === "foot") return "mapbox/walking";
    if (profile === "bike") return "mapbox/cycling";
    return "mapbox/driving";
  };

  const getMapboxToken = (headerValue: unknown): string | null => {
    if (typeof headerValue === "string" && headerValue.trim() !== "") {
      return headerValue.trim();
    }

    const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!token || token.trim() === "") return null;
    return token.trim();
  };

  /**
   * GET /api/route?profile=foot&from=lng,lat&to=lng,lat
   *
   * Server-side proxy for Mapbox Directions to avoid CORS issues, enforce rate limits,
   * and allow swapping routing backends without client changes.
   */
  router.get("/", async (req, res) => {
    const profile = ((req.query.profile as string) ?? "foot") as RouteProfile;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    if (!from || !to) {
      res.status(400).json({ error: "Missing required query params: from, to (format: lng,lat)" });
      return;
    }

    if (!VALID_PROFILES.has(profile)) {
      res.status(400).json({ error: `Invalid profile: ${profile}. Must be one of: foot, driving, bike` });
      return;
    }

    if (!isValidCoordPair(from) || !isValidCoordPair(to)) {
      res.status(400).json({ error: "Invalid coordinates. Format: lng,lat (e.g. 120.98,14.60)" });
      return;
    }

    const mapboxToken = getMapboxToken(req.headers["x-mapbox-token"]);
    if (!mapboxToken) {
      res.status(503).json({
        error: "Routing service is not configured",
        code: "ConfigError",
      });
      return;
    }

    const mapboxProfile = mapProfileToMapbox(profile);
    const url = `${MAPBOX_DIRECTIONS_BASE}/${mapboxProfile}/${from};${to}?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(mapboxToken)}`;

    try {
      const mapboxRes = await fetch(url, {
        headers: {
          "User-Agent": "roberto-incident-command/1.0",
        },
      });

      if (!mapboxRes.ok) {
        res.status(502).json({
          error: "Routing service unavailable",
          code: "UpstreamError",
        });
        return;
      }

      const data = await mapboxRes.json() as MapboxDirectionsResponse;
      const routes = data.routes ?? [];
      const payload: ProxyRouteResponse = {
        code: routes.length > 0 ? "Ok" : "NoRoute",
        routes,
      };

      res.json(payload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown routing error";
      console.error("[Route] Mapbox proxy failed:", message);
      res.status(502).json({ error: "Routing service unavailable", code: "ProxyError" });
    }
  });

  return router;
};
