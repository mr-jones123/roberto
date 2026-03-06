import { Router } from "express";

import { generateCityAnalysis } from "../analysis-service.js";
import type { DataStore } from "../data-store.js";

export const createAnalysisRouter = (dataStore: DataStore): Router => {
  const router = Router();

  router.get("/cities/:cityId/analysis", async (req, res) => {
    const apiKey = req.headers["x-gemini-key"];

    if (typeof apiKey !== "string" || apiKey.trim() === "") {
      res.status(400).json({ analysis: null, error: "Gemini API key required. Enter your key in the UI." });
      return;
    }

    const city = dataStore.getCityById(req.params.cityId);

    if (city === undefined) {
      res.status(404).json({ analysis: null, error: "City not found" });
      return;
    }

    const projects = dataStore.getProjectsForCity(city);
    const result = await generateCityAnalysis(city, projects, apiKey);

    res.json({
      analysis: result.text,
      error: result.error ?? undefined
    });
  });

  return router;
};
