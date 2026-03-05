export const PROJECT_STATUS = {
  COMPLETED: "Completed",
  ON_GOING: "On-Going",
  NOT_YET_STARTED: "Not Yet Started"
} as const;

type KnownProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];
type StatusBreakdown = Partial<Record<KnownProjectStatus, number>> & Record<string, number>;

export type Project = {
  id: string;
  name: string;
  city_norm: string;
  latitude: number;
  longitude: number;
  status: KnownProjectStatus | (string & {});
  progress: number;
  category: string;
  contractor: string;
  budget: number;
};

export type City = {
  id: string;
  name: string;
  city_norm: string;
  effective_coverage_score: number;
  raw_coverage_ratio: number;
  avg_progress: number;
  total_high_hazard_area_km2: number;
  raw_covered_area_km2: number;
  project_count: number;
  status_breakdown: StatusBreakdown;
  budget_total_php: number;
};

export type GeoJsonGeometry = {
  type: string;
  coordinates?: unknown;
};

export type GeoJsonFeature = {
  type: "Feature";
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown>;
};

export type CityBoundaries = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
} & Record<string, unknown>;

export type Meta = {
  version: string;
  generated_at: string;
  buffer_radius_m: number;
  crs_computation: string;
  crs_storage: string;
  total_projects: number;
  total_cities: number;
  data_sources: Record<string, string>;
  scoring_formula: string;
} & Record<string, unknown>;

export type AnalysisResponse = {
  analysis: string | null;
  error?: string;
};

export type HazardZones = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
} & Record<string, unknown>;

export type DataBundle = {
  cities: City[];
  projects: Project[];
  boundaries: CityBoundaries;
  hazardZones: HazardZones;
  meta: Meta;
};
