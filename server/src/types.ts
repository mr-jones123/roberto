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
  source?: "ai" | "fallback";
  audience?: "public" | "coordinator" | "responder";
  confidence_level?: "high" | "medium" | "low" | "fallback";
  confidence_score?: number;
  gated?: boolean;
  disclaimer?: string;
  model_error?: string;
};

export type IncidentNodeGuidanceResponse = {
  source: "ai" | "fallback";
  confidence_level: "high" | "medium" | "low" | "fallback";
  confidence_score: number;
  gated: boolean;
  disclaimer: string;
  guidance: {
    what_this_means: string;
    what_you_can_do_now: string[];
  };
  context: {
    city: string | null;
    hazard: {
      level: 0 | 1 | 2 | 3;
      label: string;
    };
    weather: {
      observed_at: string;
      temperature_c: number;
      feels_like_c: number;
      precipitation_mm: number;
      rain_mm: number;
      wind_kph: number;
      weather_code: number;
      weather_label: string;
      is_day: boolean;
    } | null;
  };
  model_error?: string;
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

export type FacilityType = "evacuation_center" | "school" | "hospital" | "fire_station" | "police_station";

export type EvacCenter = {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  phone: string | null;
  landline: string | null;
  distance_km: number;
  eta_minutes?: number | null;
};

export type EvacCenterRow = {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  phone: string | null;
  landline: string | null;
  capacity: number | null;
  current_load: number;
  status: "open" | "full" | "closed";
  created_at: string;
  updated_at: string;
};
