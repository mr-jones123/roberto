import type { IncidentRow } from "../db/incident-store.js";

export type SSEEvent = {
  type: "incident_created" | "incident_updated";
  incident: IncidentRow;
};

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
