import { Router } from "express";

const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const VALID_PROFILES = new Set(["foot", "driving", "bike"]);

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

  /**
   * GET /api/route?profile=foot&from=lng,lat&to=lng,lat
   *
   * Server-side proxy for OSRM to avoid CORS issues, enforce rate limits,
   * and allow swapping routing backends without client changes.
   */
  router.get("/", async (req, res) => {
    const profile = (req.query.profile as string) ?? "foot";
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

    const url = `${OSRM_BASE}/${profile}/${from};${to}?overview=full&geometries=geojson&generate_hints=false`;

    try {
      const osrmRes = await fetch(url, {
        headers: {
          "User-Agent": "roberto-incident-command/1.0",
        },
      });

      if (!osrmRes.ok) {
        res.status(osrmRes.status).json({
          error: `OSRM returned ${osrmRes.status}`,
          code: "UpstreamError",
        });
        return;
      }

      const data = await osrmRes.json();
      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown routing error";
      console.error("[Route] OSRM proxy failed:", message);
      res.status(502).json({ error: "Routing service unavailable", code: "ProxyError" });
    }
  });

  return router;
};
