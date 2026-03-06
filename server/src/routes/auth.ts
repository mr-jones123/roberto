import { compareSync } from "bcryptjs";
import { Router } from "express";

import { signToken } from "../auth/jwt.js";
import type { IncidentStore } from "../db/incident-store.js";

export const createAuthRouter = (store: IncidentStore): Router => {
  const router = Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    const user = store.getUserByUsername(username);

    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = compareSync(password, user.password);

    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signToken({
      sub: user.id,
      role: user.role,
      username: user.username,
    });

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        username: user.username,
      },
    });
  });

  return router;
};
