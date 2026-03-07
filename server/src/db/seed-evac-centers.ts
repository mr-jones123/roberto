import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FacilityType } from "./incident-store.js";
import { IncidentStore } from "./incident-store.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));

type FacilitySeedData = {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  capacity: number;
  status: "open" | "full" | "closed";
};

export const seedEvacCenters = (): void => {
  const seedPath = path.resolve(CURRENT_DIR, "../../../data/evac-centers.json");
  const seedData = JSON.parse(readFileSync(seedPath, "utf-8")) as FacilitySeedData[];

  const store = new IncidentStore();

  for (const center of seedData) {
    store.upsertEvacCenter({
      id: center.id,
      name: center.name,
      type: center.type ?? "evacuation_center",
      latitude: center.latitude,
      longitude: center.longitude,
      capacity: center.capacity,
      status: center.status,
    });
  }

  store.close();
  process.stdout.write(`Seeded ${seedData.length} facilities\n`);
};

const isDirectExecution = process.argv[1]?.includes("seed-evac-centers");
if (isDirectExecution) {
  seedEvacCenters();
}
