import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createGeocodeRouter } from "./geocode.js";

const ORIGINAL_MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
const ORIGINAL_VITE_MAPBOX_ACCESS_TOKEN = process.env.VITE_MAPBOX_ACCESS_TOKEN;

const buildApp = () => {
  const app = express();
  app.use("/api/geocode", createGeocodeRouter());
  return app;
};

describe("Geocode API", () => {
  beforeEach(() => {
    delete process.env.MAPBOX_ACCESS_TOKEN;
    delete process.env.VITE_MAPBOX_ACCESS_TOKEN;
  });

  afterEach(() => {
    process.env.MAPBOX_ACCESS_TOKEN = ORIGINAL_MAPBOX_ACCESS_TOKEN;
    process.env.VITE_MAPBOX_ACCESS_TOKEN = ORIGINAL_VITE_MAPBOX_ACCESS_TOKEN;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("GET /api/geocode/search returns 400 for short query", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/geocode/search?q=ab");

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("at least 3 characters");
  });

  it("GET /api/geocode/search returns 503 when Mapbox token is missing", async () => {
    const app = buildApp();
    const response = await request(app).get("/api/geocode/search?q=Quezon City");

    expect(response.status).toBe(503);
    expect(response.body.code).toBe("ConfigError");
  });

  it("GET /api/geocode/search proxies Mapbox and maps response", async () => {
    const app = buildApp();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            id: "address.123",
            text: "Ayala Avenue",
            place_name: "Ayala Avenue, Makati, Metro Manila, Philippines",
            center: [121.0244, 14.5547],
            place_type: ["address"],
            relevance: 0.97,
          },
        ],
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .get("/api/geocode/search?q=Ayala&limit=3&proximity=120.98,14.60")
      .set("X-Mapbox-Token", "test-token");

    expect(response.status).toBe(200);
    expect(response.body.features).toHaveLength(1);
    expect(response.body.features[0]).toEqual({
      id: "address.123",
      name: "Ayala Avenue",
      place_name: "Ayala Avenue, Makati, Metro Manila, Philippines",
      latitude: 14.5547,
      longitude: 121.0244,
      place_type: ["address"],
      relevance: 0.97,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(typeof url).toBe("string");
    expect(url).toContain("Ayala.json");
    expect(url).toContain("access_token=test-token");
    expect(url).toContain("limit=3");
    expect(url).toContain("proximity=120.98%2C14.6");
  });
});
