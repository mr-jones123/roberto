import { Router } from "express";

import { requireAuth } from "../auth/middleware.js";
import type { IncidentStore } from "../db/incident-store.js";

export type KpiResponse = {
  total_incidents: number;
  by_status: Record<string, number>;
  avg_acknowledge_time_ms: number | null;
  avg_assignment_latency_ms: number | null;
  resolution_rate: number;
  avg_resolution_time_ms: number | null;
};

type EventTimestampRow = {
  incident_id: string;
  created_at: string;
  new_status: string | null;
  action: string;
};

export const createKpiRouter = (store: IncidentStore): Router => {
  const router = Router();

  router.use(requireAuth);

  router.get("/", (_req, res) => {
    const db = store.getDb();

    const incidents = store.listIncidents();
    const totalIncidents = incidents.length;

    const byStatus: Record<string, number> = {};
    for (const inc of incidents) {
      byStatus[inc.status] = (byStatus[inc.status] ?? 0) + 1;
    }

    const events = db
      .prepare(
        `SELECT incident_id, created_at, new_status, action
         FROM incident_events
         WHERE action IN ('created', 'transition')
         ORDER BY incident_id, created_at ASC`
      )
      .all() as EventTimestampRow[];

    const eventsByIncident = new Map<string, EventTimestampRow[]>();
    for (const ev of events) {
      const list = eventsByIncident.get(ev.incident_id);
      if (list) {
        list.push(ev);
      } else {
        eventsByIncident.set(ev.incident_id, [ev]);
      }
    }

    const ackTimes: number[] = [];
    const assignLatencies: number[] = [];
    const resolutionTimes: number[] = [];

    for (const [, incEvents] of eventsByIncident) {
      let pingTime: number | null = null;
      let verifiedTime: number | null = null;
      let assignedTime: number | null = null;
      let resolvedTime: number | null = null;

      for (const ev of incEvents) {
        const ts = new Date(ev.created_at).getTime();

        if (ev.action === "created" && ev.new_status === "PING") {
          pingTime = ts;
        } else if (ev.new_status === "VERIFIED") {
          verifiedTime = ts;
        } else if (ev.new_status === "ASSIGNED") {
          assignedTime = ts;
        } else if (ev.new_status === "RESOLVED") {
          resolvedTime = ts;
        }
      }

      if (pingTime !== null && verifiedTime !== null) {
        ackTimes.push(verifiedTime - pingTime);
      }

      if (verifiedTime !== null && assignedTime !== null) {
        assignLatencies.push(assignedTime - verifiedTime);
      }

      if (pingTime !== null && resolvedTime !== null) {
        resolutionTimes.push(resolvedTime - pingTime);
      }
    }

    const avg = (arr: number[]): number | null =>
      arr.length === 0 ? null : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    const resolvedCount = byStatus["RESOLVED"] ?? 0;
    const resolutionRate =
      totalIncidents === 0 ? 0 : Math.round((resolvedCount / totalIncidents) * 10000) / 100;

    const kpi: KpiResponse = {
      total_incidents: totalIncidents,
      by_status: byStatus,
      avg_acknowledge_time_ms: avg(ackTimes),
      avg_assignment_latency_ms: avg(assignLatencies),
      resolution_rate: resolutionRate,
      avg_resolution_time_ms: avg(resolutionTimes),
    };

    res.json(kpi);
  });

  return router;
};
