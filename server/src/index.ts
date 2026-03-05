import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDataStore, loadDataBundle } from "./data-store.js";
import { createAnalysisRouter } from "./routes/analysis.js";
import { createBoundariesRouter } from "./routes/boundaries.js";
import { createCitiesRouter } from "./routes/cities.js";
import { createHazardRouter } from "./routes/hazard.js";
import { createMetaRouter } from "./routes/meta.js";
import { createProjectsRouter } from "./routes/projects.js";

dotenv.config();

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

const resolveDataDirectory = (): string => {
  return path.resolve(CURRENT_DIR, "../../data");
};

const resolveClientDist = (): string => {
  return path.resolve(CURRENT_DIR, "../../client/dist");
};

const parsePort = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? "3001", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3001;
  }

  return parsed;
};

const startServer = async (): Promise<void> => {
  const dataBundle = await loadDataBundle(resolveDataDirectory());
  const dataStore = createDataStore(dataBundle);

  const app = express();

  app.use(compression());

  if (process.env.NODE_ENV !== "production") {
    app.use(cors({ origin: "http://localhost:5173" }));
  }

  app.use("/api/cities", createCitiesRouter(dataStore));
  app.use("/api/projects", createProjectsRouter(dataStore));
  app.use("/api/boundaries", createBoundariesRouter(dataStore));
  app.use("/api/hazard", createHazardRouter(dataStore));
  app.use("/api/meta", createMetaRouter(dataStore));
  app.use("/api", createAnalysisRouter(dataStore));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const clientDistPath = resolveClientDist();
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDistPath, "index.html"), (err) => {
      if (err) next();
    });
  });

  const port = parsePort(process.env.PORT);
  app.listen(port, () => {
    process.stdout.write(`Server listening on port ${port}\n`);
  });
};

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(`Failed to start server: ${message}\n`);
  process.exit(1);
});
