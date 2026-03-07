import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashSync } from "bcryptjs";
import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { signToken } from "../auth/jwt.js";
import { IncidentStore } from "../db/incident-store.js";
import { InviteEngine } from "../lifecycle/invite-engine.js";
import { EventBus } from "../realtime/event-bus.js";
import { createNodesRouter } from "./nodes.js";
import { createChatRouter } from "./chat.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(CURRENT_DIR, "../db/schema.sql");

const USER1 = { id: "user-reporter-01", username: "reporter1", role: "reporter" as const };
const USER2 = { id: "user-reporter-02", username: "reporter2", role: "reporter" as const };
const COORD = { id: "user-coord-01", username: "coord1", role: "coordinator" as const };

const buildApp = (store: IncidentStore) => {
  const inviteEngine = new InviteEngine(store);
  const bus = new EventBus();
  const app = express();
  app.use(express.json());
  app.use("/api/nodes", createNodesRouter(store, bus));
  app.use("/api", createChatRouter(store, inviteEngine, bus));
  return app;
};

const seedUsers = (store: IncidentStore) => {
  const insert = store.getDb().prepare(`
    INSERT INTO users (id, username, password, role)
    VALUES (@id, @username, @password, @role)
  `);
  for (const u of [USER1, USER2, COORD]) {
    insert.run({ ...u, password: hashSync("pass123", 4) });
  }
};

const tokenFor = (user: { id: string; role: string; username: string }) =>
  signToken({ sub: user.id, role: user.role as "reporter", username: user.username });

describe("Chat API", () => {
  let store: IncidentStore;
  let app: express.Express;
  let token1: string;
  let token2: string;

  beforeEach(() => {
    store = new IncidentStore(":memory:");
    store.getDb().exec(readFileSync(SCHEMA_PATH, "utf-8"));
    seedUsers(store);
    app = buildApp(store);
    token1 = tokenFor(USER1);
    token2 = tokenFor(USER2);
  });

  afterEach(() => {
    store.close();
  });

  it("POST /api/nodes creates node, returns 201", async () => {
    const res = await request(app)
      .post("/api/nodes")
      .set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5995, longitude: 120.9842 });

    expect(res.status).toBe(201);
    expect(res.body.node.id).toBeDefined();
    expect(res.body.node.latitude).toBe(14.5995);
  });

  it("GET /api/nodes/nearby returns nearby nodes", async () => {
    await request(app)
      .post("/api/nodes")
      .set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5995, longitude: 120.9842 });

    const res = await request(app)
      .get("/api/nodes/nearby?lat=14.5995&lng=120.9842")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/invites creates invite, returns 201", async () => {
    const n1 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5995, longitude: 120.9842 });
    const n2 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token2}`)
      .send({ latitude: 14.6, longitude: 120.98 });

    const res = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${token1}`)
      .send({ recipient_node_id: n2.body.node.id });

    expect(res.status).toBe(201);
    expect(res.body.invite.status).toBe("pending");
  });

  it("GET /api/invites returns invites for user's node", async () => {
    await request(app).post("/api/nodes").set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5, longitude: 120.9 });

    const res = await request(app)
      .get("/api/invites")
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.invites)).toBe(true);
  });

  it("PATCH /api/invites/:id/respond accept returns conversation", async () => {
    const n1 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5, longitude: 120.9 });
    const n2 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token2}`)
      .send({ latitude: 14.6, longitude: 120.98 });
    const inv = await request(app).post("/api/invites").set("Authorization", `Bearer ${token1}`)
      .send({ recipient_node_id: n2.body.node.id });

    const res = await request(app)
      .patch(`/api/invites/${inv.body.invite.id}/respond`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ action: "accepted", version: 1 });

    expect(res.status).toBe(200);
    expect(res.body.invite.status).toBe("accepted");
    expect(res.body.conversation).toBeDefined();
    expect(res.body.conversation.id).toBeDefined();
  });

  it("POST /api/conversations/:id/messages sends message, returns 201", async () => {
    const n1 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5, longitude: 120.9 });
    const n2 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token2}`)
      .send({ latitude: 14.6, longitude: 120.98 });
    const inv = await request(app).post("/api/invites").set("Authorization", `Bearer ${token1}`)
      .send({ recipient_node_id: n2.body.node.id });
    const accept = await request(app)
      .patch(`/api/invites/${inv.body.invite.id}/respond`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ action: "accepted", version: 1 });
    const conversationId = accept.body.conversation.id;

    const res = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${token1}`)
      .send({ client_msg_id: "msg-1", body: "Hello neighbor!" });

    expect(res.status).toBe(201);
    expect(res.body.message.body).toBe("Hello neighbor!");
    expect(res.body.message.sender_id).toBe(USER1.id);
  });

  it("GET /api/conversations/:id/messages returns messages", async () => {
    const n1 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5, longitude: 120.9 });
    const n2 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token2}`)
      .send({ latitude: 14.6, longitude: 120.98 });
    const inv = await request(app).post("/api/invites").set("Authorization", `Bearer ${token1}`)
      .send({ recipient_node_id: n2.body.node.id });
    const accept = await request(app)
      .patch(`/api/invites/${inv.body.invite.id}/respond`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ action: "accepted", version: 1 });
    const cid = accept.body.conversation.id;

    await request(app).post(`/api/conversations/${cid}/messages`)
      .set("Authorization", `Bearer ${token1}`)
      .send({ client_msg_id: "msg-a", body: "First" });

    const res = await request(app)
      .get(`/api/conversations/${cid}/messages`)
      .set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].body).toBe("First");
  });

  it("unauthenticated request returns 401", async () => {
    const res = await request(app).get("/api/invites");
    expect(res.status).toBe(401);
  });

  it("non-participant reading messages returns 403", async () => {
    const n1 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5, longitude: 120.9 });
    const n2 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token2}`)
      .send({ latitude: 14.6, longitude: 120.98 });
    const inv = await request(app).post("/api/invites").set("Authorization", `Bearer ${token1}`)
      .send({ recipient_node_id: n2.body.node.id });
    const accept = await request(app)
      .patch(`/api/invites/${inv.body.invite.id}/respond`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ action: "accepted", version: 1 });
    const cid = accept.body.conversation.id;

    const coordToken = tokenFor(COORD);
    const res = await request(app)
      .get(`/api/conversations/${cid}/messages`)
      .set("Authorization", `Bearer ${coordToken}`);

    expect(res.status).toBe(403);
  });

  it("idempotency: same client_msg_id twice returns same message", async () => {
    const n1 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token1}`)
      .send({ latitude: 14.5, longitude: 120.9 });
    const n2 = await request(app).post("/api/nodes").set("Authorization", `Bearer ${token2}`)
      .send({ latitude: 14.6, longitude: 120.98 });
    const inv = await request(app).post("/api/invites").set("Authorization", `Bearer ${token1}`)
      .send({ recipient_node_id: n2.body.node.id });
    const accept = await request(app)
      .patch(`/api/invites/${inv.body.invite.id}/respond`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ action: "accepted", version: 1 });
    const cid = accept.body.conversation.id;

    const first = await request(app)
      .post(`/api/conversations/${cid}/messages`)
      .set("Authorization", `Bearer ${token1}`)
      .send({ client_msg_id: "dedup-1", body: "Hello" });

    const second = await request(app)
      .post(`/api/conversations/${cid}/messages`)
      .set("Authorization", `Bearer ${token1}`)
      .send({ client_msg_id: "dedup-1", body: "Hello" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.message.id).toBe(second.body.message.id);
  });
});
