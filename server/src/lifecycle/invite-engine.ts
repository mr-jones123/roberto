import { randomUUID } from "node:crypto";

import type { InviteStatus, ConnectionInviteRow } from "../db/incident-store.js";
import { IncidentStore } from "../db/incident-store.js";
import { INVITE_TRANSITION_GUARD } from "./transitions.js";

export type InviteTransitionResult =
  | { ok: true; invite: ConnectionInviteRow }
  | { ok: false; code: 422 | 409; message: string };

export class InviteEngine {
  private readonly store: IncidentStore;

  constructor(store: IncidentStore) {
    this.store = store;
  }

  transition(
    inviteId: string,
    toStatus: InviteStatus,
    actorId: string,
    expectedVersion: number
  ): InviteTransitionResult {
    const invite = this.store.getInvite(inviteId);

    if (!invite) {
      return {
        ok: false,
        code: 422,
        message: `Invite ${inviteId} was not found.`,
      };
    }

    if (
      invite.status === "pending" &&
      invite.expires_at !== null &&
      new Date(invite.expires_at) <= new Date()
    ) {
      const expired = this.store.updateInviteStatus(
        inviteId,
        "expired",
        invite.version
      );
      if (expired) {
        this.store.appendEvent({
          id: randomUUID(),
          incident_id: inviteId,
          actor_id: actorId,
          action: "invite_transition",
          old_status: invite.status,
          new_status: "expired",
        });
      }
      return {
        ok: false,
        code: 422,
        message: "Invite has expired.",
      };
    }

    if (invite.version !== expectedVersion) {
      return {
        ok: false,
        code: 409,
        message: `Version mismatch for invite ${inviteId}. Expected ${expectedVersion}, found ${invite.version}.`,
      };
    }

    const allowed = INVITE_TRANSITION_GUARD[invite.status];
    if (!allowed.includes(toStatus)) {
      return {
        ok: false,
        code: 422,
        message: `Illegal transition from ${invite.status} to ${toStatus}.`,
      };
    }

    if (toStatus === "accepted") {
      return this.acceptInvite(invite, actorId, expectedVersion);
    }

    const updated = this.store.updateInviteStatus(
      inviteId,
      toStatus,
      expectedVersion
    );

    if (!updated) {
      return {
        ok: false,
        code: 409,
        message: `Version conflict for invite ${inviteId}.`,
      };
    }

    this.store.appendEvent({
      id: randomUUID(),
      incident_id: inviteId,
      actor_id: actorId,
      action: "invite_transition",
      old_status: invite.status,
      new_status: toStatus,
    });

    return { ok: true, invite: updated };
  }

  private acceptInvite(
    invite: ConnectionInviteRow,
    actorId: string,
    expectedVersion: number
  ): InviteTransitionResult {
    try {
      const result = this.store.transaction(() => {
        const updated = this.store.updateInviteStatus(
          invite.id,
          "accepted",
          expectedVersion
        );

        if (!updated) {
          throw new VersionConflictError(
            `Version conflict for invite ${invite.id}.`
          );
        }

        const senderNode = this.store.getHelpNode(invite.sender_node_id);
        const recipientNode = this.store.getHelpNode(invite.recipient_node_id);

        if (!senderNode || !recipientNode) {
          throw new Error(
            `Could not resolve nodes for invite ${invite.id}.`
          );
        }

        const conversationId = randomUUID();
        this.store.createConversation({
          id: conversationId,
          invite_id: invite.id,
        });

        this.store.addParticipant({
          id: randomUUID(),
          conversation_id: conversationId,
          user_id: senderNode.user_id,
        });

        this.store.addParticipant({
          id: randomUUID(),
          conversation_id: conversationId,
          user_id: recipientNode.user_id,
        });

        this.store.appendEvent({
          id: randomUUID(),
          incident_id: invite.id,
          actor_id: actorId,
          action: "invite_transition",
          old_status: invite.status,
          new_status: "accepted",
        });

        return updated;
      });

      return { ok: true, invite: result };
    } catch (error: unknown) {
      if (error instanceof VersionConflictError) {
        return { ok: false, code: 409, message: error.message };
      }

      const failureMessage =
        error instanceof Error ? error.message : "unknown error";
      return {
        ok: false,
        code: 422,
        message: `Failed to accept invite ${invite.id}: ${failureMessage}`,
      };
    }
  }
}

class VersionConflictError extends Error {}
