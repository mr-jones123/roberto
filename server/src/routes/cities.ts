import { Router } from "express";

import type { DataStore } from "../data-store.js";

const CACHE_CONTROL_VALUE = "public, max-age=3600";

export const createCitiesRouter = (dataStore: DataStore): Router => {
  const router = Router();

  router.get("/", (_req, res) => {
    res.setHeader("Cache-Control", CACHE_CONTROL_VALUE);
    res.json(dataStore.getCities());
  });

  router.get("/:cityId", (req, res) => {
    const city = dataStore.getCityById(req.params.cityId);

    if (city === undefined) {
      res.status(404).json({ error: "City not found" });
      return;
    }

    res.setHeader("Cache-Control", CACHE_CONTROL_VALUE);
    res.json({
      city,
      projects: dataStore.getProjectsForCity(city)
    });
  });

  router.get("/:cityId/projects", (req, res) => {
    const city = dataStore.getCityById(req.params.cityId);

    if (city === undefined) {
      res.status(404).json({ error: "City not found" });
      return;
    }

    res.setHeader("Cache-Control", CACHE_CONTROL_VALUE);
    res.json(dataStore.getProjectsForCity(city));
  });

  return router;
};
