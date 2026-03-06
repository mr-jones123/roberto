import { Router } from "express";

import type { EventBus, EventHandler } from "../realtime/event-bus.js";

export const createEventsRouter = (bus: EventBus): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const handler: EventHandler = (event) => {
      res.write(`event: incident_update\ndata: ${JSON.stringify(event)}\n\n`);
    };

    bus.subscribe(handler);

    const pingInterval = setInterval(() => {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 30_000);

    req.on("close", () => {
      clearInterval(pingInterval);
      bus.unsubscribe(handler);
    });
  });

  return router;
};
