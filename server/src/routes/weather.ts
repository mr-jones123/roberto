import { Router } from "express";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const CACHE_CONTROL_VALUE = "public, max-age=180";

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

const parseCoordinate = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
};

const parseNumericField = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
};

export const createWeatherRouter = (): Router => {
  const router = Router();

  router.get("/current", async (req, res) => {
    const latitude = parseCoordinate(req.query.lat, -90, 90);
    const longitude = parseCoordinate(req.query.lng, -180, 180);

    if (latitude === null || longitude === null) {
      res.status(400).json({ error: "Invalid coordinates. Expected query params: lat, lng" });
      return;
    }

    const apiUrl = `${OPEN_METEO_BASE}?latitude=${latitude}&longitude=${longitude}&timezone=auto&current=temperature_2m,apparent_temperature,precipitation,rain,wind_speed_10m,weather_code,is_day`;

    try {
      const upstream = await fetch(apiUrl, {
        headers: {
          "User-Agent": "roberto-weather-proxy/1.0",
        },
      });

      if (!upstream.ok) {
        res.status(502).json({ error: `Weather provider returned ${upstream.status}` });
        return;
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
        res.status(502).json({ error: "Weather provider payload missing current conditions" });
        return;
      }

      const temperature = parseNumericField(current.temperature_2m);
      const feelsLike = parseNumericField(current.apparent_temperature);
      const precipitation = parseNumericField(current.precipitation);
      const rain = parseNumericField(current.rain);
      const windSpeed = parseNumericField(current.wind_speed_10m);
      const weatherCode = parseNumericField(current.weather_code);

      if (temperature === null || feelsLike === null || precipitation === null || rain === null || windSpeed === null || weatherCode === null) {
        res.status(502).json({ error: "Weather provider payload missing required weather fields" });
        return;
      }

      const roundedCode = Math.round(weatherCode);
      res.setHeader("Cache-Control", CACHE_CONTROL_VALUE);
      res.json({
        source: "Open-Meteo",
        location: {
          lat: latitude,
          lng: longitude,
        },
        current: {
          observed_at: typeof current.time === "string" ? current.time : new Date().toISOString(),
          temperature_c: temperature,
          feels_like_c: feelsLike,
          precipitation_mm: precipitation,
          rain_mm: rain,
          wind_kph: windSpeed,
          weather_code: roundedCode,
          weather_label: WEATHER_CODE_LABELS[roundedCode] ?? "Unknown conditions",
          is_day: current.is_day === 1,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown weather proxy error";
      console.error("[Weather] Proxy failed:", message);
      res.status(502).json({ error: "Weather service unavailable" });
    }
  });

  return router;
};
