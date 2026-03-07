import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { hashSync } from "bcryptjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { IncidentStore } from "../db/incident-store.js";
import { InviteEngine } from "./invite-engine.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(CURRENT_DIR, "../db/schema.sql");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const seedUser = (store: IncidentStore, id: string, username: string, role: string): void => {
  store.getDb().prepare(`
    INSERT INTO users (id, username, password, role)
    VALUES (@id, @username, @password, @role)
  `).run({ id, username, password: hashSync("pass123", 4), role });
};

const seedNode = (store: IncidentStore, nodeId: string, userId: string): void => {
  store.createHelpNode({ id: nodeId, user_id: userId, latitude: 14.5, longitude: 120.9 });
};

const createTestInvite = (
  store: IncidentStore,
  opts: { senderNodeId: string; recipientNodeId: string; expiresAt?: string },
) => {
  return store.createInvite({
    id: randomUUID(),
    sender_node_id: opts.senderNodeId,
    recipient_node_id: opts.recipientNodeId,
    expires_at: opts.expiresAt,
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InviteEngine", () => {
  let store: IncidentStore;
  let engine: InviteEngine;
  const userId1 = "user-1";
  const userId2 = "user-2";
  const nodeId1 = "node-1";
  const nodeId2 = "node-2";

  beforeEach(() => {
    store = new IncidentStore(":memory:");
    const schema = readFileSync(SCHEMA_PATH, "utf-8");
    store.getDb().exec(schema);

    seedUser(store, userId1, "reporter1", "reporter");
    seedUser(store, userId2, "reporter2", "reporter");
    seedNode(store, nodeId1, userId1);
    seedNode(store, nodeId2, userId2);

    engine = new InviteEngine(store);
  });

  afterEach(() => {
    store.close();
  });

  it("accept: pending -> accepted, creates conversation and increments version", () => {
    const invite = createTestInvite(store, { senderNodeId: nodeId1, recipientNodeId: nodeId2 });
    expect(invite.status).toBe("pending");
    expect(invite.version).toBe(1);

    const result = engine.transition(invite.id, "accepted", userId2, 1);
    expect(result.ok).toBe(true);

    if (!result.ok) throw new Error("unreachable");
    expect(result.invite.status).toBe("accepted");
    expect(result.invite.version).toBe(2);

    const conversation = store.getConversationByInviteId(invite.id);
    expect(conversation).toBeDefined();
    expect(store.isParticipant(conversation!.id, userId1)).toBe(true);
    expect(store.isParticipant(conversation!.id, userId2)).toBe(true);
  });

  it("reject: pending -> rejected", () => {
    const invite = createTestInvite(store, { senderNodeId: nodeId1, recipientNodeId: nodeId2 });

    const result = engine.transition(invite.id, "rejected", userId2, 1);
    expect(result.ok).toBe(true);

    if (!result.ok) throw new Error("unreachable");
    expect(result.invite.status).toBe("rejected");
    expect(result.invite.version).toBe(2);
    expect(store.getConversationByInviteId(invite.id)).toBeUndefined();
  });

  it("cancel: pending -> cancelled", () => {
    const invite = createTestInvite(store, { senderNodeId: nodeId1, recipientNodeId: nodeId2 });

    const result = engine.transition(invite.id, "cancelled", userId1, 1);
    expect(result.ok).toBe(true);

    if (!result.ok) throw new Error("unreachable");
    expect(result.invite.status).toBe("cancelled");
  });

  it("version mismatch returns 409", () => {
    const invite = createTestInvite(store, { senderNodeId: nodeId1, recipientNodeId: nodeId2 });

    const result = engine.transition(invite.id, "accepted", userId2, 99);
    expect(result.ok).toBe(false);

    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe(409);
    expect(result.message).toContain("Version mismatch");
  });

  it("cannot accept an already-accepted invite (422)", () => {
    const invite = createTestInvite(store, { senderNodeId: nodeId1, recipientNodeId: nodeId2 });

    const first = engine.transition(invite.id, "accepted", userId2, 1);
    expect(first.ok).toBe(true);

    const second = engine.transition(invite.id, "accepted", userId2, 2);
    expect(second.ok).toBe(false);

    if (second.ok) throw new Error("unreachable");
    expect(second.code).toBe(422);
    expect(second.message).toContain("Illegal transition");
  });

  it("expired invite returns 422 on accept attempt", () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const invite = createTestInvite(store, {
      senderNodeId: nodeId1,
      recipientNodeId: nodeId2,
      expiresAt: pastDate,
    });

    const result = engine.transition(invite.id, "accepted", userId2, 1);
    expect(result.ok).toBe(false);

    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe(422);
    expect(result.message).toContain("expired");

    const fresh = store.getInvite(invite.id);
    expect(fresh?.status).toBe("expired");
  });

  it("returns 422 for non-existent invite", () => {
    const result = engine.transition("does-not-exist", "accepted", userId2, 1);
    expect(result.ok).toBe(false);

    if (result.ok) throw new Error("unreachable");
    expect(result.code).toBe(422);
    expect(result.message).toContain("not found");
  });
});
