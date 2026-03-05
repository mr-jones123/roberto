import { Router } from "express";

import type { DataStore } from "../data-store.js";

const CACHE_CONTROL_VALUE = "public, max-age=3600";

export const createMetaRouter = (dataStore: DataStore): Router => {
  const router = Router();

  router.get("/", (_req, res) => {
    res.setHeader("Cache-Control", CACHE_CONTROL_VALUE);
    res.json(dataStore.getMeta());
  });

  return router;
};
