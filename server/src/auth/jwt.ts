import jwt from "jsonwebtoken";

import type { IncidentRole } from "../contracts/incident-command.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "roberto-dev-secret";
const JWT_EXPIRY = "8h";

export type JwtPayload = {
  sub: string;
  role: IncidentRole;
  username: string;
};

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
};
