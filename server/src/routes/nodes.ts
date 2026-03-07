import { randomUUID } from "node:crypto";
import { Router } from "express";

import { requireAuth, requireRole } from "../auth/middleware.js";
import { INCIDENT_ROLE } from "../contracts/incident-command.js";
import type { IncidentStore } from "../db/incident-store.js";
import type { EventBus } from "../realtime/event-bus.js";

const paramId = (params: Record<string, unknown>): string => params.id as string;

export const createNodesRouter = (store: IncidentStore, _bus: EventBus): Router => {
  const router = Router();

  router.get(
    "/nearby",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radiusKm = req.query.radius_km !== undefined ? Number(req.query.radius_km) : 5;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: "Missing or invalid query params: lat, lng" });
        return;
      }

      if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
        res.status(400).json({ error: "Invalid query param: radius_km must be a positive number" });
        return;
      }

      const nodes = store.listNearbyNodes(lat, lng, radiusKm);
      res.json({ nodes });
    }
  );

  router.post(
    "/",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const { latitude, longitude } = req.body as Record<string, unknown>;

      if (
        typeof latitude !== "number" || !Number.isFinite(latitude) ||
        typeof longitude !== "number" || !Number.isFinite(longitude)
      ) {
        res.status(400).json({ error: "Missing or invalid fields: latitude, longitude" });
        return;
      }

      const existing = store.getUserNode(req.user!.id);
      if (existing) {
        res.status(201).json({ node: existing });
        return;
      }

      const node = store.createHelpNode({
        id: randomUUID(),
        user_id: req.user!.id,
        latitude,
        longitude,
      });

      res.status(201).json({ node });
    }
  );

  router.get(
    "/:id",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const node = store.getHelpNode(paramId(req.params));

      if (!node) {
        res.status(404).json({ error: "Node not found" });
        return;
      }

      res.json({ node });
    }
  );

  return router;
};
