import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";

import type { IncidentRole, IncidentStatus } from "../contracts/incident-command.js";
import { getDbPath } from "./migrate.js";

export type UserRow = {
  id: string;
  username: string;
  password: string;
  role: IncidentRole;
  created_at: string;
};

export type IncidentRow = {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  priority: number | null;
  reporter_id: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type IncidentEventRow = {
  id: string;
  incident_id: string;
  actor_id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  payload: string | null;
  created_at: string;
};

export type AssignmentRow = {
  id: string;
  incident_id: string;
  responder_id: string;
  locked_by: string | null;
  status: "active" | "completed" | "released";
  created_at: string;
  updated_at: string;
};

export type EvacCenterRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number | null;
  current_load: number;
  status: "open" | "full" | "closed";
  created_at: string;
  updated_at: string;
};

export type CreateIncidentInput = {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  reporter_id: string;
};

export type AppendEventInput = {
  id: string;
  incident_id: string;
  actor_id: string;
  action: string;
  old_status?: string;
  new_status?: string;
  payload?: string;
};

export type CreateAssignmentInput = {
  id: string;
  incident_id: string;
  responder_id: string;
  locked_by?: string;
};

export type UpsertEvacCenterInput = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  current_load?: number;
  status?: "open" | "full" | "closed";
};

export class IncidentStore {
  private db: DatabaseType;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath ?? getDbPath());
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  createIncident(input: CreateIncidentInput): IncidentRow {
    const stmt = this.db.prepare(`
      INSERT INTO incidents (id, title, description, latitude, longitude, reporter_id)
      VALUES (@id, @title, @description, @latitude, @longitude, @reporter_id)
    `);
    stmt.run(input);
    return this.getIncident(input.id)!;
  }

  getIncident(id: string): IncidentRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM incidents WHERE id = ?");
    return stmt.get(id) as IncidentRow | undefined;
  }

  listIncidents(): IncidentRow[] {
    const stmt = this.db.prepare("SELECT * FROM incidents ORDER BY created_at DESC");
    return stmt.all() as IncidentRow[];
  }

  appendEvent(input: AppendEventInput): IncidentEventRow {
    const stmt = this.db.prepare(`
      INSERT INTO incident_events (id, incident_id, actor_id, action, old_status, new_status, payload)
      VALUES (@id, @incident_id, @actor_id, @action, @old_status, @new_status, @payload)
    `);
    stmt.run({
      id: input.id,
      incident_id: input.incident_id,
      actor_id: input.actor_id,
      action: input.action,
      old_status: input.old_status ?? null,
      new_status: input.new_status ?? null,
      payload: input.payload ?? null,
    });

    const row = this.db.prepare("SELECT * FROM incident_events WHERE id = ?").get(input.id);
    return row as IncidentEventRow;
  }

  listEvents(incidentId: string): IncidentEventRow[] {
    const stmt = this.db.prepare(
      "SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC"
    );
    return stmt.all(incidentId) as IncidentEventRow[];
  }

  createAssignment(input: CreateAssignmentInput): AssignmentRow {
    const stmt = this.db.prepare(`
      INSERT INTO assignments (id, incident_id, responder_id, locked_by)
      VALUES (@id, @incident_id, @responder_id, @locked_by)
    `);
    stmt.run({
      id: input.id,
      incident_id: input.incident_id,
      responder_id: input.responder_id,
      locked_by: input.locked_by ?? null,
    });

    return this.getAssignment(input.id)!;
  }

  getAssignment(id: string): AssignmentRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM assignments WHERE id = ?");
    return stmt.get(id) as AssignmentRow | undefined;
  }

  upsertEvacCenter(input: UpsertEvacCenterInput): EvacCenterRow {
    const stmt = this.db.prepare(`
      INSERT INTO evac_centers (id, name, latitude, longitude, capacity, current_load, status)
      VALUES (@id, @name, @latitude, @longitude, @capacity, @current_load, @status)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        capacity = excluded.capacity,
        current_load = excluded.current_load,
        status = excluded.status,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `);
    stmt.run({
      id: input.id,
      name: input.name,
      latitude: input.latitude,
      longitude: input.longitude,
      capacity: input.capacity ?? null,
      current_load: input.current_load ?? 0,
      status: input.status ?? "open",
    });

    const row = this.db.prepare("SELECT * FROM evac_centers WHERE id = ?").get(input.id);
    return row as EvacCenterRow;
  }

  listEvacCenters(): EvacCenterRow[] {
    const stmt = this.db.prepare("SELECT * FROM evac_centers ORDER BY name ASC");
    return stmt.all() as EvacCenterRow[];
  }

  getUserByUsername(username: string): UserRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM users WHERE username = ?");
    return stmt.get(username) as UserRow | undefined;
  }

  getUserById(id: string): UserRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(id) as UserRow | undefined;
  }

  getDb(): DatabaseType {
    return this.db;
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  close(): void {
    this.db.close();
  }
}
