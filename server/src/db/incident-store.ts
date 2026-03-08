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

export type FacilityType = "evacuation_center" | "school" | "hospital" | "fire_station" | "police_station";

export type EvacCenterRow = {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  phone: string | null;
  landline: string | null;
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

export type AppendInviteEventInput = {
  id: string;
  invite_id: string;
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
  type?: FacilityType;
  latitude: number;
  longitude: number;
  phone?: string;
  landline?: string;
  capacity?: number;
  current_load?: number;
  status?: "open" | "full" | "closed";
};

// ---------------------------------------------------------------------------
// Node Connection & Chat domain — Row types
// ---------------------------------------------------------------------------

export type HelpNodeStatus = "active" | "inactive";

export type HelpNodeRow = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  status: HelpNodeStatus;
  created_at: string;
  updated_at: string;
};

export type InviteStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired";

export type ConnectionInviteRow = {
  id: string;
  sender_node_id: string;
  recipient_node_id: string;
  status: InviteStatus;
  version: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationRow = {
  id: string;
  invite_id: string;
  created_at: string;
};

export type ConversationParticipantRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_msg_id: string;
  body: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Node Connection & Chat domain — Input types
// ---------------------------------------------------------------------------

export type CreateHelpNodeInput = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
};

export type CreateInviteInput = {
  id: string;
  sender_node_id: string;
  recipient_node_id: string;
  expires_at?: string;
};

export type CreateConversationInput = {
  id: string;
  invite_id: string;
};

export type AddParticipantInput = {
  id: string;
  conversation_id: string;
  user_id: string;
};

export type CreateMessageInput = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_msg_id: string;
  body: string;
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

  appendInviteEvent(input: AppendInviteEventInput): void {
    const stmt = this.db.prepare(`
      INSERT INTO invite_events (id, invite_id, actor_id, action, old_status, new_status, payload)
      VALUES (@id, @invite_id, @actor_id, @action, @old_status, @new_status, @payload)
    `);
    stmt.run({
      id: input.id,
      invite_id: input.invite_id,
      actor_id: input.actor_id,
      action: input.action,
      old_status: input.old_status ?? null,
      new_status: input.new_status ?? null,
      payload: input.payload ?? null,
    });
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
      INSERT INTO evac_centers (id, name, type, latitude, longitude, phone, landline, capacity, current_load, status)
      VALUES (@id, @name, @type, @latitude, @longitude, @phone, @landline, @capacity, @current_load, @status)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        phone = excluded.phone,
        landline = excluded.landline,
        capacity = excluded.capacity,
        current_load = excluded.current_load,
        status = excluded.status,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `);
    stmt.run({
      id: input.id,
      name: input.name,
      type: input.type ?? "evacuation_center",
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone ?? null,
      landline: input.landline ?? null,
      capacity: input.capacity ?? null,
      current_load: input.current_load ?? 0,
      status: input.status ?? "open",
    });

    const row = this.db.prepare("SELECT * FROM evac_centers WHERE id = ?").get(input.id);
    return row as EvacCenterRow;
  }

  listEvacCenters(type?: FacilityType): EvacCenterRow[] {
    if (type) {
      const stmt = this.db.prepare("SELECT * FROM evac_centers WHERE type = ? ORDER BY name ASC");
      return stmt.all(type) as EvacCenterRow[];
    }
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

  updatePriority(incidentId: string, priority: number): void {
    const stmt = this.db.prepare("UPDATE incidents SET priority = ? WHERE id = ?");
    stmt.run(priority, incidentId);
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

  createHelpNode(input: CreateHelpNodeInput): HelpNodeRow {
    const stmt = this.db.prepare(`
      INSERT INTO help_nodes (id, user_id, latitude, longitude)
      VALUES (@id, @user_id, @latitude, @longitude)
    `);
    stmt.run(input);
    return this.getHelpNode(input.id)!;
  }

  getHelpNode(id: string): HelpNodeRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM help_nodes WHERE id = ?");
    return stmt.get(id) as HelpNodeRow | undefined;
  }

  listNearbyNodes(lat: number, lng: number, radiusKm: number): HelpNodeRow[] {
    const KM_PER_DEG_LAT = 111;
    const dLat = radiusKm / KM_PER_DEG_LAT;
    const dLng = radiusKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

    const stmt = this.db.prepare(`
      SELECT * FROM help_nodes
      WHERE latitude BETWEEN @minLat AND @maxLat
        AND longitude BETWEEN @minLng AND @maxLng
        AND status = 'active'
      ORDER BY created_at DESC
    `);
    return stmt.all({
      minLat: lat - dLat,
      maxLat: lat + dLat,
      minLng: lng - dLng,
      maxLng: lng + dLng,
    }) as HelpNodeRow[];
  }

  getUserNode(userId: string): HelpNodeRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM help_nodes WHERE user_id = ?");
    return stmt.get(userId) as HelpNodeRow | undefined;
  }

  createInvite(input: CreateInviteInput): ConnectionInviteRow {
    const stmt = this.db.prepare(`
      INSERT INTO connection_invites (id, sender_node_id, recipient_node_id, expires_at)
      VALUES (@id, @sender_node_id, @recipient_node_id, @expires_at)
    `);
    stmt.run({
      id: input.id,
      sender_node_id: input.sender_node_id,
      recipient_node_id: input.recipient_node_id,
      expires_at: input.expires_at ?? null,
    });
    return this.getInvite(input.id)!;
  }

  getInvite(id: string): ConnectionInviteRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM connection_invites WHERE id = ?");
    return stmt.get(id) as ConnectionInviteRow | undefined;
  }

  listInvitesForNode(nodeId: string): ConnectionInviteRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM connection_invites
      WHERE sender_node_id = @nodeId OR recipient_node_id = @nodeId
      ORDER BY created_at DESC
    `);
    return stmt.all({ nodeId }) as ConnectionInviteRow[];
  }

  listInvitesSince(nodeId: string, since: string): ConnectionInviteRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM connection_invites
      WHERE (sender_node_id = @nodeId OR recipient_node_id = @nodeId)
        AND updated_at > @since
      ORDER BY updated_at ASC
    `);
    return stmt.all({ nodeId, since }) as ConnectionInviteRow[];
  }

  hasPendingInvite(nodeIdA: string, nodeIdB: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM connection_invites
      WHERE status = 'pending'
        AND (
          (sender_node_id = @nodeIdA AND recipient_node_id = @nodeIdB)
          OR
          (sender_node_id = @nodeIdB AND recipient_node_id = @nodeIdA)
        )
      LIMIT 1
    `);
    return stmt.get({ nodeIdA, nodeIdB }) !== undefined;
  }

  updateInviteStatus(
    id: string,
    status: InviteStatus,
    expectedVersion: number
  ): ConnectionInviteRow | null {
    const stmt = this.db.prepare(`
      UPDATE connection_invites
      SET status = @status,
          version = version + 1,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = @id AND version = @expectedVersion
    `);
    const result = stmt.run({ id, status, expectedVersion });
    if (result.changes === 0) return null;
    return this.getInvite(id)!;
  }

  createConversation(input: CreateConversationInput): ConversationRow {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, invite_id)
      VALUES (@id, @invite_id)
    `);
    stmt.run(input);
    return this.getConversation(input.id)!;
  }

  getConversation(id: string): ConversationRow | undefined {
    const stmt = this.db.prepare("SELECT * FROM conversations WHERE id = ?");
    return stmt.get(id) as ConversationRow | undefined;
  }

  getConversationByInviteId(inviteId: string): ConversationRow | undefined {
    return this.db.prepare("SELECT * FROM conversations WHERE invite_id = ?").get(inviteId) as ConversationRow | undefined;
  }

  addParticipant(input: AddParticipantInput): ConversationParticipantRow {
    const stmt = this.db.prepare(`
      INSERT INTO conversation_participants (id, conversation_id, user_id)
      VALUES (@id, @conversation_id, @user_id)
    `);
    stmt.run(input);
    const row = this.db.prepare("SELECT * FROM conversation_participants WHERE id = ?").get(input.id);
    return row as ConversationParticipantRow;
  }

  isParticipant(conversationId: string, userId: string): boolean {
    const stmt = this.db.prepare(
      "SELECT 1 FROM conversation_participants WHERE conversation_id = @conversationId AND user_id = @userId"
    );
    return stmt.get({ conversationId, userId }) !== undefined;
  }

  listConversationsForUser(userId: string): ConversationRow[] {
    const stmt = this.db.prepare(`
      SELECT c.* FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id = ?
      ORDER BY c.created_at DESC
    `);
    return stmt.all(userId) as ConversationRow[];
  }

  listParticipantUserIds(conversationId: string): string[] {
    const stmt = this.db.prepare(`
      SELECT user_id FROM conversation_participants
      WHERE conversation_id = @conversationId
    `);
    const rows = stmt.all({ conversationId }) as Array<{ user_id: string }>;
    return rows.map((row) => row.user_id);
  }

  createMessage(input: CreateMessageInput): MessageRow {
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO messages (id, conversation_id, sender_id, client_msg_id, body)
      VALUES (@id, @conversation_id, @sender_id, @client_msg_id, @body)
    `);
    insertStmt.run(input);

    const selectStmt = this.db.prepare(
      "SELECT * FROM messages WHERE conversation_id = @conversation_id AND client_msg_id = @client_msg_id"
    );
    return selectStmt.get({
      conversation_id: input.conversation_id,
      client_msg_id: input.client_msg_id,
    }) as MessageRow;
  }

  listMessages(
    conversationId: string,
    opts?: { before?: string; limit?: number }
  ): MessageRow[] {
    const limit = opts?.limit ?? 50;

    if (opts?.before) {
      const stmt = this.db.prepare(`
        SELECT * FROM messages
        WHERE conversation_id = @conversationId AND id < @before
        ORDER BY id DESC
        LIMIT @limit
      `);
      return stmt.all({ conversationId, before: opts.before, limit }) as MessageRow[];
    }

    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = @conversationId
      ORDER BY id DESC
      LIMIT @limit
    `);
    return stmt.all({ conversationId, limit }) as MessageRow[];
  }

  listMessagesSince(conversationIds: string[], since: string): MessageRow[] {
    const uniqueConversationIds = [...new Set(conversationIds)];
    if (uniqueConversationIds.length === 0) {
      return [];
    }

    const placeholders = uniqueConversationIds.map((_, index) => `@conversationId${index}`).join(", ");
    const params: Record<string, unknown> = { since };

    for (const [index, conversationId] of uniqueConversationIds.entries()) {
      params[`conversationId${index}`] = conversationId;
    }

    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id IN (${placeholders})
        AND created_at > @since
      ORDER BY created_at ASC
    `);

    return stmt.all(params) as MessageRow[];
  }
}
