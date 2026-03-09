import { Router } from "express";

import {
  ANALYSIS_AUDIENCES,
  generateCityAnalysis,
  generateIncidentNodeGuidance,
  type AnalysisAudience,
  type IncidentNodeContext,
  type NodeHazardContext,
  type NodeWeatherContext,
} from "../analysis-service.js";
import type { DataStore } from "../data-store.js";
import type { City, IncidentNodeGuidanceResponse } from "../types.js";

const CONFIDENCE_GATE_THRESHOLD = 0.58;
const OFFICIAL_DISCLAIMER =
  "Use this as guidance only. Follow PAGASA, NDRRMC/OCD, and your LGU for official instructions.";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

const HAZARD_LEVEL_LABELS: Record<NodeHazardContext["level"], string> = {
  0: "No mapped flood hazard zone",
  1: "Low flood hazard (Var 1)",
  2: "Medium flood hazard (Var 2)",
  3: "High flood hazard (Var 3)",
};

type IncidentContextInput = {
  title: string;
  status: string;
  priority: number | null;
  description: string | null;
};

type LngLat = [number, number];
type Ring = LngLat[];
type PolygonCoordinates = Ring[];
type MultiPolygonCoordinates = PolygonCoordinates[];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const parseBodyCoordinate = (value: unknown, min: number, max: number): number | null => {
  if (!isFiniteNumber(value) || value < min || value > max) {
    return null;
  }
  return value;
};

const parseNumericField = (value: unknown): number | null => {
  if (!isFiniteNumber(value)) {
    return null;
  }
  return value;
};

const resolveGeminiApiKey = (headerValue: unknown): string | null => {
  if (typeof headerValue === "string" && headerValue.trim() !== "") {
    return headerValue.trim();
  }

  const envKey = process.env.GEMINI_API_KEY;
  if (typeof envKey === "string" && envKey.trim() !== "") {
    return envKey.trim();
  }

  return null;
};

const toLngLat = (value: unknown): LngLat | null => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const lng = value[0];
  const lat = value[1];
  if (!isFiniteNumber(lng) || !isFiniteNumber(lat)) {
    return null;
  }

  return [lng, lat];
};

const toRing = (value: unknown): Ring | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const ring: Ring = [];
  for (const point of value) {
    const lngLat = toLngLat(point);
    if (lngLat === null) {
      return null;
    }
    ring.push(lngLat);
  }

  return ring.length >= 3 ? ring : null;
};

const toPolygonCoordinates = (value: unknown): PolygonCoordinates | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const polygon: PolygonCoordinates = [];
  for (const ringValue of value) {
    const ring = toRing(ringValue);
    if (ring === null) {
      return null;
    }
    polygon.push(ring);
  }

  return polygon.length > 0 ? polygon : null;
};

const toMultiPolygonCoordinates = (value: unknown): MultiPolygonCoordinates | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const multipolygon: MultiPolygonCoordinates = [];
  for (const polygonValue of value) {
    const polygon = toPolygonCoordinates(polygonValue);
    if (polygon === null) {
      return null;
    }
    multipolygon.push(polygon);
  }

  return multipolygon.length > 0 ? multipolygon : null;
};

const pointOnSegment = (point: LngLat, a: LngLat, b: LngLat): boolean => {
  const epsilon = 1e-9;
  const [px, py] = point;
  const [ax, ay] = a;
  const [bx, by] = b;

  const squaredLength = (bx - ax) ** 2 + (by - ay) ** 2;
  if (squaredLength < epsilon) {
    // Degenerate zero-length segment — only matches the exact point
    return Math.abs(px - ax) < epsilon && Math.abs(py - ay) < epsilon;
  }

  const cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay);
  if (Math.abs(cross) > epsilon) return false;

  const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
  if (dot < -epsilon) return false;
  if (dot - squaredLength > epsilon) return false;

  return true;
};

const pointInRing = (point: LngLat, ring: Ring): boolean => {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i]!;
    const b = ring[j]!;

    if (pointOnSegment(point, a, b)) {
      return true;
    }

    const [xi, yi] = a;
    const [xj, yj] = b;
    const intersects =
      (yi > point[1]) !== (yj > point[1])
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const pointInPolygon = (point: LngLat, polygon: PolygonCoordinates): boolean => {
  const outer = polygon[0];
  if (!outer || !pointInRing(point, outer)) {
    return false;
  }

  for (let i = 1; i < polygon.length; i += 1) {
    const hole = polygon[i];
    if (hole && pointInRing(point, hole)) {
      return false;
    }
  }

  return true;
};

const geometryContainsPoint = (
  geometry: { type?: unknown; coordinates?: unknown } | null,
  point: LngLat,
): boolean => {
  if (!geometry || typeof geometry.type !== "string") {
    return false;
  }

  if (geometry.type === "Polygon") {
    const polygon = toPolygonCoordinates(geometry.coordinates);
    return polygon !== null && pointInPolygon(point, polygon);
  }

  if (geometry.type === "MultiPolygon") {
    const multipolygon = toMultiPolygonCoordinates(geometry.coordinates);
    if (!multipolygon) {
      return false;
    }
    return multipolygon.some((polygon) => pointInPolygon(point, polygon));
  }

  return false;
};

const inferCityName = (dataStore: DataStore, point: LngLat): string | null => {
  const boundaries = dataStore.getBoundaries();
  const cities = dataStore.getCities();

  for (const feature of boundaries.features) {
    if (!geometryContainsPoint(feature.geometry, point)) {
      continue;
    }

    const cityNorm = typeof feature.properties.city_norm === "string"
      ? feature.properties.city_norm
      : null;
    if (cityNorm === null) {
      return null;
    }

    const match = cities.find((city) => city.city_norm.toUpperCase() === cityNorm.toUpperCase());
    return match?.name ?? cityNorm;
  }

  return null;
};

const inferHazardContext = (dataStore: DataStore, point: LngLat): NodeHazardContext => {
  const hazard = dataStore.getHazardZones();
  let level: NodeHazardContext["level"] = 0;

  for (const feature of hazard.features) {
    if (!geometryContainsPoint(feature.geometry, point)) {
      continue;
    }

    const rawLevel = feature.properties.var_level;
    if (rawLevel === 1 || rawLevel === 2 || rawLevel === 3) {
      level = Math.max(level, rawLevel) as NodeHazardContext["level"];
      if (level === 3) {
        break;
      }
    }
  }

  return {
    level,
    label: HAZARD_LEVEL_LABELS[level],
  };
};

const fetchCurrentWeatherContext = async (latitude: number, longitude: number): Promise<NodeWeatherContext | null> => {
  const apiUrl = `${OPEN_METEO_BASE}?latitude=${latitude}&longitude=${longitude}&timezone=auto&current=temperature_2m,apparent_temperature,precipitation,rain,wind_speed_10m,weather_code,is_day`;

  try {
    const upstream = await fetch(apiUrl, {
      headers: {
        "User-Agent": "roberto-analysis/1.0",
      },
    });

    if (!upstream.ok) {
      return null;
    }

    const payload = await upstream.json() as {
      current?: {
        time?: unknown;
        temperature_2m?: unknown;
        apparent_temperature?: unknown;
        precipitation?: unknown;
        rain?: unknown;
        wind_speed_10m?: unknown;
        weather_code?: unknown;
        is_day?: unknown;
      };
    };

    const current = payload.current;
    if (!current) {
      return null;
    }

    const temperature = parseNumericField(current.temperature_2m);
    const feelsLike = parseNumericField(current.apparent_temperature);
    const precipitation = parseNumericField(current.precipitation);
    const rain = parseNumericField(current.rain);
    const windSpeed = parseNumericField(current.wind_speed_10m);
    const weatherCode = parseNumericField(current.weather_code);

    if (
      temperature === null
      || feelsLike === null
      || precipitation === null
      || rain === null
      || windSpeed === null
      || weatherCode === null
    ) {
      return null;
    }

    const roundedCode = Math.round(weatherCode);

    return {
      observed_at: typeof current.time === "string" ? current.time : new Date().toISOString(),
      temperature_c: temperature,
      feels_like_c: feelsLike,
      precipitation_mm: precipitation,
      rain_mm: rain,
      wind_kph: windSpeed,
      weather_code: roundedCode,
      weather_label: WEATHER_CODE_LABELS[roundedCode] ?? "Unknown conditions",
      is_day: current.is_day === 1,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown weather context error";
    console.error("[Analysis] Weather enrichment failed:", message);
    return null;
  }
};

const parseIncidentContext = (value: unknown): IncidentContextInput => {
  if (!isRecord(value)) {
    return {
      title: "Incident report",
      status: "PING",
      priority: null,
      description: null,
    };
  }

  const title = typeof value.title === "string" && value.title.trim() !== ""
    ? value.title.trim()
    : "Incident report";
  const status = typeof value.status === "string" && value.status.trim() !== ""
    ? value.status.trim()
    : "PING";
  const priority = isFiniteNumber(value.priority) ? value.priority : null;
  const description = typeof value.description === "string" && value.description.trim() !== ""
    ? value.description.trim()
    : null;

  return { title, status, priority, description };
};

const buildNodeFallbackGuidance = (context: IncidentNodeContext): IncidentNodeGuidanceResponse["guidance"] => {
  const cityText = context.city ? `${context.city}` : "this area";
  const weather = context.weather;
  const weatherLine = weather
    ? `Current weather is ${weather.weather_label.toLowerCase()}, ${weather.temperature_c.toFixed(1)}°C, with ${weather.precipitation_mm.toFixed(1)} mm precipitation and ${weather.wind_kph.toFixed(1)} kph wind.`
    : "Current weather details are unavailable, so prepare conservatively for sudden rainfall changes.";

  const whatThisMeans = [
    `This ${context.incident.status.toLowerCase()} incident is in ${cityText}, where mapped hazard is ${context.hazard.label.toLowerCase()}.`,
    weatherLine,
    context.hazard.level >= 2
      ? "Runoff and drainage stress can escalate quickly here during sustained rain."
      : "Localized flooding is still possible if rain bands persist or drains are blocked.",
  ].join(" ");

  const actions: string[] = [];

  if (context.hazard.level === 3) {
    actions.push("Move people and valuables to higher ground now, especially at ground-floor level.");
  } else if (context.hazard.level === 2) {
    actions.push("Prepare for rapid water rise in low streets; stage evacuation items near exits.");
  } else {
    actions.push("Keep access paths and drainage points clear to reduce localized flooding risk.");
  }

  if (weather && (weather.rain_mm >= 2 || weather.precipitation_mm >= 2 || weather.weather_code >= 80)) {
    actions.push("Treat current rain as an escalation trigger and check the nearest safe route immediately.");
  } else {
    actions.push("Review your nearest evacuation center and safest route before conditions worsen.");
  }

  if (context.incident.priority !== null && context.incident.priority >= 4) {
    actions.push("Prioritize this report in local coordination channels and confirm responder assignment status.");
  } else if (context.incident.status !== "RESOLVED") {
    actions.push("Share timestamped updates every 15-30 minutes until the incident is stabilized.");
  } else {
    actions.push("Continue light monitoring for re-flooding and keep communication channels open.");
  }

  actions.push("Follow PAGASA and your LGU advisories for official warnings and evacuation orders.");

  return {
    what_this_means: whatThisMeans,
    what_you_can_do_now: actions.slice(0, 5),
  };
};

const parseAudience = (value: unknown): AnalysisAudience => {
  if (typeof value === "string" && ANALYSIS_AUDIENCES.includes(value as AnalysisAudience)) {
    return value as AnalysisAudience;
  }
  return "public";
};

const formatPct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const formatKm2 = (value: number): string => `${value.toFixed(2)} km2`;

const buildFallbackGuidance = (city: City, audience: AnalysisAudience): string => {
  const uncoveredArea = Math.max(city.total_high_hazard_area_km2 - city.raw_covered_area_km2, 0);
  const coverage = formatPct(city.effective_coverage_score);
  const readiness = `${city.avg_progress.toFixed(1)}%`;

  const riskLine =
    city.effective_coverage_score < 0.5
      ? "Coverage remains fragile, so sudden heavy rain can still overwhelm exposed zones."
      : city.effective_coverage_score < 0.75
        ? "Coverage is improving but there are still meaningful gaps in exposed areas."
        : "Coverage is relatively stronger, but preparedness is still needed for intense events.";

  const audienceActions: Record<AnalysisAudience, string[]> = {
    public: [
      "Prepare a go-bag and family communication plan tonight.",
      "Track rainfall and flood bulletins from PAGASA and your city LGU every few hours.",
      "Identify your nearest safe evacuation route before conditions worsen.",
    ],
    coordinator: [
      "Pre-position response teams and supplies near high-exposure barangays.",
      "Set clear trigger points for pre-evacuation and public advisories.",
      "Synchronize updates with barangay officials every operational cycle.",
    ],
    responder: [
      "Prioritize reconnaissance in low-coverage and high-hazard pockets first.",
      "Validate route passability before dispatching assets.",
      "Maintain short handoff loops with evacuation centers and command.",
    ],
  };

  return [
    `${city.name} currently has ${coverage} effective flood-protection coverage over high-hazard zones.`,
    `About ${formatKm2(uncoveredArea)} of high-hazard area remains outside current practical protection coverage.`,
    `Average project progress is ${readiness}. ${riskLine}`,
    "",
    `Recommended actions for ${audience}:`,
    `- ${audienceActions[audience].join("\n- ")}`,
  ].join("\n");
};

export const createAnalysisRouter = (dataStore: DataStore): Router => {
  const router = Router();

  router.get("/cities/:cityId/analysis", async (req, res) => {
    const apiKey = resolveGeminiApiKey(req.headers["x-gemini-key"]);
    const audience = parseAudience(req.query.audience);

    if (apiKey === null) {
      res.status(400).json({
        analysis: null,
        error: "Gemini API key required. Provide X-Gemini-Key or set GEMINI_API_KEY on the server.",
      });
      return;
    }

    const city = dataStore.getCityById(req.params.cityId);

    if (city === undefined) {
      res.status(404).json({ analysis: null, error: "City not found" });
      return;
    }

    const projects = dataStore.getProjectsForCity(city);
    const result = await generateCityAnalysis(city, projects, apiKey, audience);
    const confidenceScore = result.confidenceScore;
    const gateTriggered =
      result.text === null
      || result.error !== null
      || confidenceScore === null
      || confidenceScore < CONFIDENCE_GATE_THRESHOLD;

    if (gateTriggered) {
      res.json({
        analysis: buildFallbackGuidance(city, audience),
        source: "fallback",
        audience,
        confidence_level: "fallback",
        confidence_score: confidenceScore ?? 0,
        gated: true,
        disclaimer: OFFICIAL_DISCLAIMER,
        model_error: result.error ?? undefined,
      });
      return;
    }

    res.json({
      analysis: result.text,
      source: "ai",
      audience,
      confidence_level: result.confidenceLevel,
      confidence_score: confidenceScore,
      gated: false,
      disclaimer: OFFICIAL_DISCLAIMER,
      error: result.error ?? undefined,
    });
  });

  router.post("/incidents/node-guidance", async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const latitude = parseBodyCoordinate(body.latitude, -90, 90);
    const longitude = parseBodyCoordinate(body.longitude, -180, 180);

    if (latitude === null || longitude === null) {
      res.status(400).json({
        error: "Invalid location context. Expected numeric latitude and longitude in request body.",
      });
      return;
    }

    const point: LngLat = [longitude, latitude];
    const city = inferCityName(dataStore, point);
    const hazard = inferHazardContext(dataStore, point);
    const weather = await fetchCurrentWeatherContext(latitude, longitude);
    const incident = parseIncidentContext(body.incident);
    const context: IncidentNodeContext = {
      latitude,
      longitude,
      city,
      hazard,
      weather,
      incident,
    };

    const fallbackGuidance = buildNodeFallbackGuidance(context);
    const apiKey = resolveGeminiApiKey(req.headers["x-gemini-key"]);

    if (apiKey === null) {
      const fallbackResponse: IncidentNodeGuidanceResponse = {
        source: "fallback",
        confidence_level: "fallback",
        confidence_score: 0,
        gated: true,
        disclaimer: OFFICIAL_DISCLAIMER,
        guidance: fallbackGuidance,
        context: {
          city,
          hazard,
          weather,
        },
        model_error: "Gemini API key missing (header/env)",
      };
      res.json(fallbackResponse);
      return;
    }

    const aiResult = await generateIncidentNodeGuidance(context, apiKey);
    const confidenceScore = aiResult.confidenceScore;
    const gateTriggered =
      aiResult.whatThisMeans === null
      || aiResult.whatYouCanDoNow.length === 0
      || aiResult.error !== null
      || confidenceScore === null
      || confidenceScore < CONFIDENCE_GATE_THRESHOLD;

    if (gateTriggered) {
      const fallbackResponse: IncidentNodeGuidanceResponse = {
        source: "fallback",
        confidence_level: "fallback",
        confidence_score: confidenceScore ?? 0,
        gated: true,
        disclaimer: OFFICIAL_DISCLAIMER,
        guidance: fallbackGuidance,
        context: {
          city,
          hazard,
          weather,
        },
        model_error: aiResult.error ?? undefined,
      };
      res.json(fallbackResponse);
      return;
    }

    const aiResponse: IncidentNodeGuidanceResponse = {
      source: "ai",
      confidence_level: aiResult.confidenceLevel ?? "low",
      confidence_score: confidenceScore,
      gated: false,
      disclaimer: OFFICIAL_DISCLAIMER,
      guidance: {
        what_this_means: aiResult.whatThisMeans ?? fallbackGuidance.what_this_means,
        what_you_can_do_now: aiResult.whatYouCanDoNow,
      },
      context: {
        city,
        hazard,
        weather,
      },
      model_error: aiResult.error ?? undefined,
    };

    res.json(aiResponse);
  });

  return router;
};
