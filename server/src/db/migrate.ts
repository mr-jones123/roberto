import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(CURRENT_DIR, "schema.sql");

export const getDbPath = (): string => {
  return path.resolve(CURRENT_DIR, "../../../incidents.db");
};

export const migrate = (): void => {
  const dbPath = getDbPath();
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  db.close();

  process.stdout.write(`Migration complete: ${dbPath}\n`);
};

const isDirectExecution = process.argv[1]?.includes("migrate");
if (isDirectExecution) {
  migrate();
}
