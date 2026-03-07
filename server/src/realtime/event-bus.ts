import type { ConnectionInviteRow, ConversationRow, IncidentRow, MessageRow } from "../db/incident-store.js";

export type SSEEvent =
  | { type: "incident_created"; incident: IncidentRow }
  | { type: "incident_updated"; incident: IncidentRow }
  | { type: "invite_created"; invite: ConnectionInviteRow }
  | { type: "invite_updated"; invite: ConnectionInviteRow; conversation?: ConversationRow }
  | { type: "message_created"; message: MessageRow; conversationId: string };

export type EventHandler = (event: SSEEvent) => void;

export class EventBus {
  private handlers: Set<EventHandler> = new Set();
  private userHandlers: Map<string, Set<EventHandler>> = new Map();

  subscribe(handler: EventHandler): void {
    this.handlers.add(handler);
  }

  unsubscribe(handler: EventHandler): void {
    this.handlers.delete(handler);
  }

  subscribeUser(userId: string, handler: EventHandler): void {
    const scopedHandlers = this.userHandlers.get(userId) ?? new Set<EventHandler>();
    scopedHandlers.add(handler);
    this.userHandlers.set(userId, scopedHandlers);
  }

  unsubscribeUser(userId: string, handler: EventHandler): void {
    const scopedHandlers = this.userHandlers.get(userId);
    if (!scopedHandlers) {
      return;
    }

    scopedHandlers.delete(handler);
    if (scopedHandlers.size === 0) {
      this.userHandlers.delete(userId);
    }
  }

  publish(event: SSEEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  publishToUser(userId: string, event: SSEEvent): void {
    const scopedHandlers = this.userHandlers.get(userId);
    if (!scopedHandlers) {
      return;
    }

    for (const handler of scopedHandlers) {
      handler(event);
    }
  }

  publishToUsers(userIds: string[], event: SSEEvent): void {
    const uniqueUserIds = new Set(userIds);
    for (const userId of uniqueUserIds) {
      this.publishToUser(userId, event);
    }
  }
}
