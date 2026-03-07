import { randomUUID } from "node:crypto";
import { Router } from "express";

import { requireAuth, requireRole } from "../auth/middleware.js";
import { INCIDENT_ROLE } from "../contracts/incident-command.js";
import type { IncidentStore } from "../db/incident-store.js";
import type { InviteEngine } from "../lifecycle/invite-engine.js";
import type { EventBus } from "../realtime/event-bus.js";

const paramId = (params: Record<string, unknown>): string => params.id as string;

export const createChatRouter = (store: IncidentStore, inviteEngine: InviteEngine, bus: EventBus): Router => {
  const router = Router();

  // ---------------------------------------------------------------------------
  // Invites
  // ---------------------------------------------------------------------------

  router.post(
    "/invites",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const { recipient_node_id } = req.body as Record<string, unknown>;

      if (typeof recipient_node_id !== "string" || recipient_node_id.trim() === "") {
        res.status(400).json({ error: "Missing or invalid field: recipient_node_id" });
        return;
      }

      const senderNode = store.getUserNode(req.user!.id);
      if (!senderNode) {
        res.status(400).json({ error: "You must register a help node before sending invites" });
        return;
      }

      if (senderNode.id === recipient_node_id) {
        res.status(400).json({ error: "Cannot invite your own node" });
        return;
      }

      const recipientNode = store.getHelpNode(recipient_node_id);
      if (!recipientNode) {
        res.status(404).json({ error: "Recipient node not found" });
        return;
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const invite = store.createInvite({
        id: randomUUID(),
        sender_node_id: senderNode.id,
        recipient_node_id,
        expires_at: expiresAt,
      });

      bus.publish({ type: "invite_created", invite });

      res.status(201).json({ invite });
    }
  );

  router.get(
    "/invites",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const node = store.getUserNode(req.user!.id);
      if (!node) {
        res.json({ invites: [] });
        return;
      }

      const invites = store.listInvitesForNode(node.id);
      res.json({ invites });
    }
  );

  router.patch(
    "/invites/:id/respond",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const { action, version } = req.body as Record<string, unknown>;

      if (action !== "accepted" && action !== "rejected") {
        res.status(400).json({ error: "Missing or invalid field: action (must be 'accepted' or 'rejected')" });
        return;
      }

      if (typeof version !== "number") {
        res.status(400).json({ error: "Missing or invalid field: version" });
        return;
      }

      const invite = store.getInvite(paramId(req.params));
      if (!invite) {
        res.status(404).json({ error: "Invite not found" });
        return;
      }

      const recipientNode = store.getHelpNode(invite.recipient_node_id);
      if (!recipientNode || recipientNode.user_id !== req.user!.id) {
        res.status(403).json({ error: "Only the recipient can respond to this invite" });
        return;
      }

      const result = inviteEngine.transition(
        invite.id,
        action as "accepted" | "rejected",
        req.user!.id,
        version,
      );

      if (!result.ok) {
        res.status(result.code).json({ error: result.message });
        return;
      }

      let conversation;
      if (action === "accepted") {
        conversation = store.getConversationByInviteId(invite.id);
      }

      bus.publish({ type: "invite_updated", invite: result.invite, conversation });

      res.json({ invite: result.invite, ...(conversation ? { conversation } : {}) });
    }
  );

  router.patch(
    "/invites/:id/cancel",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const { version } = req.body as Record<string, unknown>;

      if (typeof version !== "number") {
        res.status(400).json({ error: "Missing or invalid field: version" });
        return;
      }

      const invite = store.getInvite(paramId(req.params));
      if (!invite) {
        res.status(404).json({ error: "Invite not found" });
        return;
      }

      const senderNode = store.getHelpNode(invite.sender_node_id);
      if (!senderNode || senderNode.user_id !== req.user!.id) {
        res.status(403).json({ error: "Only the sender can cancel this invite" });
        return;
      }

      const result = inviteEngine.transition(
        invite.id,
        "cancelled",
        req.user!.id,
        version,
      );

      if (!result.ok) {
        res.status(result.code).json({ error: result.message });
        return;
      }

      bus.publish({ type: "invite_updated", invite: result.invite });

      res.json({ invite: result.invite });
    }
  );

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  router.get(
    "/conversations",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const conversations = store.listConversationsForUser(req.user!.id);
      res.json({ conversations });
    }
  );

  router.get(
    "/conversations/:id/messages",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const conversationId = paramId(req.params);

      if (!store.isParticipant(conversationId, req.user!.id)) {
        res.status(403).json({ error: "You are not a participant of this conversation" });
        return;
      }

      const before = typeof req.query.before === "string" ? req.query.before : undefined;
      const limit = req.query.limit !== undefined ? Number(req.query.limit) : 50;

      const messages = store.listMessages(conversationId, { before, limit });
      res.json({ messages });
    }
  );

  router.post(
    "/conversations/:id/messages",
    requireAuth,
    requireRole(INCIDENT_ROLE.REPORTER),
    (req, res) => {
      const conversationId = paramId(req.params);

      if (!store.isParticipant(conversationId, req.user!.id)) {
        res.status(403).json({ error: "You are not a participant of this conversation" });
        return;
      }

      const { client_msg_id, body } = req.body as Record<string, unknown>;

      if (typeof client_msg_id !== "string" || client_msg_id.trim() === "") {
        res.status(400).json({ error: "Missing or invalid field: client_msg_id" });
        return;
      }

      if (typeof body !== "string" || body.trim() === "") {
        res.status(400).json({ error: "Missing or invalid field: body" });
        return;
      }

      const message = store.createMessage({
        id: randomUUID(),
        conversation_id: conversationId,
        sender_id: req.user!.id,
        client_msg_id: client_msg_id.trim(),
        body: body.trim(),
      });

      bus.publish({ type: "message_created", message, conversationId });

      res.status(201).json({ message });
    }
  );

  return router;
};
