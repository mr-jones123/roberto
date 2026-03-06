import { hashSync } from "bcryptjs";
import Database from "better-sqlite3";

import { INCIDENT_ROLE } from "../contracts/incident-command.js";
import { getDbPath } from "./migrate.js";

const SEED_USERS = [
  { id: "user-reporter-01", role: INCIDENT_ROLE.REPORTER, username: "reporter1", password: "pass123" },
  { id: "user-coord-01", role: INCIDENT_ROLE.COORDINATOR, username: "coord1", password: "pass123" },
  { id: "user-resp-01", role: INCIDENT_ROLE.RESPONDER, username: "resp1", password: "pass123" },
] as const;

const BCRYPT_ROUNDS = 10;

export const seedUsers = (): void => {
  const db = new Database(getDbPath());
  db.pragma("foreign_keys = ON");

  const insert = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password, role)
    VALUES (@id, @username, @password, @role)
  `);

  const seedAll = db.transaction(() => {
    for (const user of SEED_USERS) {
      insert.run({
        id: user.id,
        username: user.username,
        password: hashSync(user.password, BCRYPT_ROUNDS),
        role: user.role,
      });
    }
  });

  seedAll();
  db.close();

  process.stdout.write(`Seeded ${SEED_USERS.length} users\n`);
};

const isDirectExecution = process.argv[1]?.includes("seed-users");
if (isDirectExecution) {
  seedUsers();
}
