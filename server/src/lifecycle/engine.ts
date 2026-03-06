import { randomUUID } from "node:crypto";

import type { Database as DatabaseType } from "better-sqlite3";

import type { IncidentStatus } from "../contracts/incident-command.js";
import { IncidentStore, type IncidentRow } from "../db/incident-store.js";
import { TRANSITION_GUARD } from "./transitions.js";

type InternalStore = {
  db: DatabaseType;
};

export type TransitionResult =
  | { ok: true; incident: IncidentRow }
  | { ok: false; code: 422 | 409; message: string };

class VersionConflictError extends Error {}

export class LifecycleEngine {
  private readonly store: IncidentStore;

  constructor(store: IncidentStore) {
    this.store = store;
  }

  transition(
    incidentId: string,
    toStatus: IncidentStatus,
    actorId: string,
    expectedVersion: number,
    payload?: Record<string, unknown>
  ): TransitionResult {
    const incident = this.store.getIncident(incidentId);

    if (!incident) {
      return {
        ok: false,
        code: 422,
        message: `Incident ${incidentId} was not found.`,
      };
    }

    if (incident.version !== expectedVersion) {
      return {
        ok: false,
        code: 409,
        message: `Version mismatch for incident ${incidentId}. Expected ${expectedVersion}, found ${incident.version}.`,
      };
    }

    const allowedTransitions = TRANSITION_GUARD[incident.status];
    if (!allowedTransitions.includes(toStatus)) {
      return {
        ok: false,
        code: 422,
        message: `Illegal transition from ${incident.status} to ${toStatus}.`,
      };
    }

    const db = (this.store as unknown as InternalStore).db;
    const serializedPayload = payload ? JSON.stringify(payload) : undefined;

    const updateStmt = db.prepare(`
      UPDATE incidents
      SET status = @status,
          version = version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = @id
        AND version = @version
    `);

    const executeTransition = db.transaction(() => {
      const updateResult = updateStmt.run({
        id: incidentId,
        status: toStatus,
        version: expectedVersion,
      });

      if (updateResult.changes !== 1) {
        throw new VersionConflictError(`Version mismatch for incident ${incidentId}.`);
      }

      this.store.appendEvent({
        id: randomUUID(),
        incident_id: incidentId,
        actor_id: actorId,
        action: "transition",
        old_status: incident.status,
        new_status: toStatus,
        payload: serializedPayload,
      });

      const updatedIncident = this.store.getIncident(incidentId);
      if (!updatedIncident) {
        throw new Error(`Incident ${incidentId} disappeared after transition.`);
      }

      return updatedIncident;
    });

    let updatedIncident: IncidentRow;
    try {
      updatedIncident = executeTransition();
    } catch (error: unknown) {
      if (error instanceof VersionConflictError) {
        return {
          ok: false,
          code: 409,
          message: error.message,
        };
      }

      const failureMessage = error instanceof Error ? error.message : "unknown error";

      return {
        ok: false,
        code: 422,
        message: `Failed to transition incident ${incidentId}: ${failureMessage}`,
      };
    }

    return { ok: true, incident: updatedIncident };
  }
}
