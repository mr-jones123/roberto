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

  subscribe(handler: EventHandler): void {
    this.handlers.add(handler);
  }

  unsubscribe(handler: EventHandler): void {
    this.handlers.delete(handler);
  }

  publish(event: SSEEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
