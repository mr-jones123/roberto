import { randomUUID } from "node:crypto";
import { Router } from "express";

import { requireAuth, requireRole } from "../auth/middleware.js";
import { INCIDENT_ROLE, INCIDENT_STATUS } from "../contracts/incident-command.js";
import type { IncidentStore } from "../db/incident-store.js";
import type { LifecycleEngine } from "../lifecycle/engine.js";

const paramId = (params: Record<string, unknown>): string => params.id as string;

export const createIncidentsRouter = (store: IncidentStore, engine: LifecycleEngine): Router => {
  const router = Router();

  router.use(requireAuth);

  router.post(
    "/",
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const { title, description, latitude, longitude } = req.body as Record<string, unknown>;

      if (
        typeof title !== "string" || title.trim() === "" ||
        typeof description !== "string" || description.trim() === "" ||
        typeof latitude !== "number" || !Number.isFinite(latitude) ||
        typeof longitude !== "number" || !Number.isFinite(longitude)
      ) {
        res.status(400).json({ error: "Missing or invalid fields: title, description, latitude, longitude" });
        return;
      }

      const incident = store.createIncident({
        id: randomUUID(),
        title: title.trim(),
        description: description.trim(),
        latitude,
        longitude,
        reporter_id: req.user!.id,
      });

      store.appendEvent({
        id: randomUUID(),
        incident_id: incident.id,
        actor_id: req.user!.id,
        action: "created",
        new_status: INCIDENT_STATUS.PING,
      });

      res.status(201).json({ incident });
    }
  );

  router.get("/", (_req, res) => {
    const incidents = store.listIncidents();
    res.json({ incidents });
  });

  router.get("/:id", (req, res) => {
    const incident = store.getIncident(paramId(req.params));

    if (!incident) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }

    const events = store.listEvents(incident.id);
    res.json({ incident, events });
  });

  router.patch(
    "/:id/verify",
    requireRole(INCIDENT_ROLE.COORDINATOR),
    (req, res) => {
      const { version } = req.body as Record<string, unknown>;

      if (typeof version !== "number") {
        res.status(400).json({ error: "Missing or invalid field: version" });
        return;
      }

      const result = engine.transition(
        paramId(req.params),
        INCIDENT_STATUS.VERIFIED,
        req.user!.id,
        version,
      );

      if (!result.ok) {
        res.status(result.code).json({ error: result.message });
        return;
      }

      res.json({ incident: result.incident });
    }
  );

  router.patch(
    "/:id/prioritize",
    requireRole(INCIDENT_ROLE.COORDINATOR),
    (req, res) => {
      const { priority, version } = req.body as Record<string, unknown>;

      if (typeof version !== "number") {
        res.status(400).json({ error: "Missing or invalid field: version" });
        return;
      }

      if (typeof priority !== "number" || !Number.isFinite(priority)) {
        res.status(400).json({ error: "Missing or invalid field: priority" });
        return;
      }

      const id = paramId(req.params);

      const result = engine.transition(
        id,
        INCIDENT_STATUS.PRIORITIZED,
        req.user!.id,
        version,
        { priority },
      );

      if (!result.ok) {
        res.status(result.code).json({ error: result.message });
        return;
      }

      store.getDb().prepare("UPDATE incidents SET priority = ? WHERE id = ?").run(priority, id);
      const updated = store.getIncident(id)!;

      res.json({ incident: updated });
    }
  );

  router.patch(
    "/:id/assign",
    requireRole(INCIDENT_ROLE.COORDINATOR),
    (req, res) => {
      const { responderId, version } = req.body as Record<string, unknown>;

      if (typeof version !== "number") {
        res.status(400).json({ error: "Missing or invalid field: version" });
        return;
      }

      if (typeof responderId !== "string" || responderId.trim() === "") {
        res.status(400).json({ error: "Missing or invalid field: responderId" });
        return;
      }

      const id = paramId(req.params);

      const result = engine.transition(
        id,
        INCIDENT_STATUS.ASSIGNED,
        req.user!.id,
        version,
        { responderId },
      );

      if (!result.ok) {
        res.status(result.code).json({ error: result.message });
        return;
      }

      store.createAssignment({
        id: randomUUID(),
        incident_id: id,
        responder_id: responderId,
      });

      res.json({ incident: result.incident });
    }
  );

  router.patch(
    "/:id/resolve",
    requireRole(INCIDENT_ROLE.RESPONDER),
    (req, res) => {
      const { note, version } = req.body as Record<string, unknown>;

      if (typeof version !== "number") {
        res.status(400).json({ error: "Missing or invalid field: version" });
        return;
      }

      if (typeof note !== "string" || note.trim() === "") {
        res.status(400).json({ error: "Missing or invalid field: note" });
        return;
      }

      const result = engine.transition(
        paramId(req.params),
        INCIDENT_STATUS.RESOLVED,
        req.user!.id,
        version,
        { note },
      );

      if (!result.ok) {
        res.status(result.code).json({ error: result.message });
        return;
      }

      res.json({ incident: result.incident });
    }
  );

  router.patch(
    "/:id/reject",
    requireRole(INCIDENT_ROLE.COORDINATOR),
    (req, res) => {
      const { reason, version } = req.body as Record<string, unknown>;

      if (typeof version !== "number") {
        res.status(400).json({ error: "Missing or invalid field: version" });
        return;
      }

      if (typeof reason !== "string" || reason.trim() === "") {
        res.status(400).json({ error: "Missing or invalid field: reason" });
        return;
      }

      const result = engine.transition(
        paramId(req.params),
        INCIDENT_STATUS.REJECTED,
        req.user!.id,
        version,
        { reason },
      );

      if (!result.ok) {
        res.status(result.code).json({ error: result.message });
        return;
      }

      res.json({ incident: result.incident });
    }
  );

  return router;
};
