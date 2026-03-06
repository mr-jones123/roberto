import type { NextFunction, Request, Response } from "express";

import { verifyToken } from "./jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        username: string;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;

  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice(7);
  const payload = verifyToken(token);

  if (payload === null) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.user = {
    id: payload.sub,
    role: payload.role,
    username: payload.username,
  };

  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Role '${req.user.role}' is not authorized. Required: ${roles.join(", ")}` });
      return;
    }

    next();
  };
};
