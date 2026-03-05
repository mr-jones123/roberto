import { readFile } from "node:fs/promises";
import path from "node:path";

import type { City, CityBoundaries, DataBundle, HazardZones, Meta, Project } from "./types.js";

const DATA_FILES = {
  cities: "cities.json",
  projects: "projects.json",
  boundaries: "city_boundaries.geojson",
  hazardZones: "hazard_zones.geojson",
  meta: "meta.json"
} as const;

type UnknownRecord = Record<string, unknown>;

export type DataStore = {
  getCities: () => City[];
  getCityById: (cityId: string) => City | undefined;
  getAllProjects: () => Project[];
  getProjectsForCity: (city: City) => Project[];
  getBoundaries: () => CityBoundaries;
  getHazardZones: () => HazardZones;
  getMeta: () => Meta;
};

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

const isNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const hasString = (record: UnknownRecord, key: string): boolean => {
  return typeof record[key] === "string";
};

const parseJsonFile = async (filePath: string): Promise<unknown> => {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as unknown;
};

const isProject = (value: unknown): value is Project => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasString(value, "id") &&
    hasString(value, "name") &&
    hasString(value, "city_norm") &&
    isNumber(value.latitude) &&
    isNumber(value.longitude) &&
    hasString(value, "status") &&
    isNumber(value.progress) &&
    hasString(value, "category") &&
    hasString(value, "contractor") &&
    isNumber(value.budget)
  );
};

const isStatusBreakdown = (value: unknown): value is City["status_breakdown"] => {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((entry) => isNumber(entry));
};

const isCity = (value: unknown): value is City => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasString(value, "id") &&
    hasString(value, "name") &&
    hasString(value, "city_norm") &&
    isNumber(value.effective_coverage_score) &&
    isNumber(value.raw_coverage_ratio) &&
    isNumber(value.avg_progress) &&
    isNumber(value.total_high_hazard_area_km2) &&
    isNumber(value.raw_covered_area_km2) &&
    isNumber(value.project_count) &&
    isStatusBreakdown(value.status_breakdown) &&
    isNumber(value.budget_total_php)
  );
};

const isBoundaries = (value: unknown): value is CityBoundaries => {
  if (!isRecord(value)) {
    return false;
  }

  return value.type === "FeatureCollection" && Array.isArray(value.features);
};

const isMeta = (value: unknown): value is Meta => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasString(value, "version") &&
    hasString(value, "generated_at") &&
    isNumber(value.buffer_radius_m) &&
    hasString(value, "crs_computation") &&
    hasString(value, "crs_storage") &&
    isNumber(value.total_projects) &&
    isNumber(value.total_cities) &&
    isRecord(value.data_sources) &&
    hasString(value, "scoring_formula")
  );
};

const ensureArray = <T>(value: unknown, guard: (entry: unknown) => entry is T, label: string): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  if (!value.every((entry) => guard(entry))) {
    throw new Error(`${label} has invalid entries`);
  }

  return value;
};

const isHazardZones = (value: unknown): value is HazardZones => {
  if (!isRecord(value)) {
    return false;
  }

  return value.type === "FeatureCollection" && Array.isArray(value.features);
};

export const loadDataBundle = async (dataDirectory: string): Promise<DataBundle> => {
  const [citiesRaw, projectsRaw, boundariesRaw, hazardRaw, metaRaw] = await Promise.all([
    parseJsonFile(path.join(dataDirectory, DATA_FILES.cities)),
    parseJsonFile(path.join(dataDirectory, DATA_FILES.projects)),
    parseJsonFile(path.join(dataDirectory, DATA_FILES.boundaries)),
    parseJsonFile(path.join(dataDirectory, DATA_FILES.hazardZones)),
    parseJsonFile(path.join(dataDirectory, DATA_FILES.meta))
  ]);

  const cities = ensureArray(citiesRaw, isCity, DATA_FILES.cities);
  const projects = ensureArray(projectsRaw, isProject, DATA_FILES.projects);

  if (!isBoundaries(boundariesRaw)) {
    throw new Error(`${DATA_FILES.boundaries} has invalid format`);
  }

  if (!isHazardZones(hazardRaw)) {
    throw new Error(`${DATA_FILES.hazardZones} has invalid format`);
  }

  if (!isMeta(metaRaw)) {
    throw new Error(`${DATA_FILES.meta} has invalid format`);
  }

  return {
    cities,
    projects,
    boundaries: boundariesRaw,
    hazardZones: hazardRaw,
    meta: metaRaw
  };
};

export const createDataStore = (data: DataBundle): DataStore => {
  const cityById = new Map(data.cities.map((city) => [city.id.toLowerCase(), city]));
  const projectsByCity = new Map<string, Project[]>();

  for (const project of data.projects) {
    const key = project.city_norm.toUpperCase();
    const existing = projectsByCity.get(key) ?? [];
    existing.push(project);
    projectsByCity.set(key, existing);
  }

  return {
    getCities: (): City[] => data.cities,
    getCityById: (cityId: string): City | undefined => cityById.get(cityId.toLowerCase()),
    getAllProjects: (): Project[] => data.projects,
    getProjectsForCity: (city: City): Project[] => projectsByCity.get(city.city_norm.toUpperCase()) ?? [],
    getBoundaries: (): CityBoundaries => data.boundaries,
    getHazardZones: (): HazardZones => data.hazardZones,
    getMeta: (): Meta => data.meta
  };
};
