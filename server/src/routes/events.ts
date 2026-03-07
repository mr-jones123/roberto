import { Router } from "express";

import { verifyToken } from "../auth/jwt.js";
import type { EventBus, EventHandler } from "../realtime/event-bus.js";

const getTokenFromRequest = (authorization: string | undefined, queryToken: unknown): string | null => {
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    const headerToken = authorization.slice(7).trim();
    if (headerToken !== "") {
      return headerToken;
    }
  }

  if (typeof queryToken === "string" && queryToken.trim() !== "") {
    return queryToken.trim();
  }

  return null;
};

export const createEventsRouter = (bus: EventBus): Router => {
  const router = Router();

  router.get("/", (req, res) => {
    const token = getTokenFromRequest(req.headers.authorization, req.query.token);
    let userId: string | null = null;

    if (token !== null) {
      const payload = verifyToken(token);
      if (payload === null) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
      userId = payload.sub;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const handler: EventHandler = (event) => {
      res.write(`event: incident_update\ndata: ${JSON.stringify(event)}\n\n`);
    };

    bus.subscribe(handler);
    if (userId) {
      bus.subscribeUser(userId, handler);
    }

    const pingInterval = setInterval(() => {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 30_000);

    req.on("close", () => {
      clearInterval(pingInterval);
      bus.unsubscribe(handler);
      if (userId) {
        bus.unsubscribeUser(userId, handler);
      }
    });
  });

  return router;
};
