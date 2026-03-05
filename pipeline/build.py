"""
Roberto Build Pipeline — Pre-computes spatial coverage scores for Metro Manila.

Scoring: EffectiveCoverage = (raw_covered_area / total_high_hazard_area) * (avg_progress / 100)
where raw_covered_area = area of (unioned 500m project buffers INTERSECT city Var=3 hazard zone)
All area math in EPSG:32651 (UTM 51N). Storage/display in EPSG:4326.
"""

import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from shapely.ops import unary_union
from shapely.validation import make_valid

warnings.filterwarnings("ignore", category=FutureWarning)

BUFFER_RADIUS_M = 500
BUFFER_SEGMENTS = 16  # polygon approximation quality for buffer circles
CRS_UTM = "EPSG:32651"  # UTM Zone 51N — Metro Manila's native projection
CRS_WGS84 = "EPSG:4326"

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"

PARQUET_PATH = PROJECT_ROOT.parent / "dpwh_transparency_data.parquet"
BOUNDARIES_PATH = PROJECT_ROOT.parent / "ncr_boundaries.geojson"
HAZARD_PATH = PROJECT_ROOT.parent / "Flood" / "25yr" / "MetroManila.zip"

CITY_NORM_MAP = {
    "CITY OF MANILA": "MANILA",
    "MANILA": "MANILA",
    "QUEZON CITY": "QUEZON",
    "CITY OF QUEZON": "QUEZON",
    "CALOOCAN CITY": "CALOOCAN",
    "CITY OF CALOOCAN": "CALOOCAN",
    "PARANAQUE CITY": "PARANAQUE",
    "CITY OF PARANAQUE": "PARANAQUE",
    "CITY OF PARAÑAQUE": "PARANAQUE",
    "PASIG CITY": "PASIG",
    "CITY OF PASIG": "PASIG",
    "TAGUIG CITY": "TAGUIG",
    "CITY OF TAGUIG": "TAGUIG",
    "MALABON CITY": "MALABON",
    "CITY OF MALABON": "MALABON",
    "NAVOTAS CITY": "NAVOTAS",
    "CITY OF NAVOTAS": "NAVOTAS",
    "VALENZUELA CITY": "VALENZUELA",
    "CITY OF VALENZUELA": "VALENZUELA",
    "MARIKINA CITY": "MARIKINA",
    "CITY OF MARIKINA": "MARIKINA",
    "MAKATI CITY": "MAKATI",
    "CITY OF MAKATI": "MAKATI",
    "LAS PIÑAS CITY": "LAS PINAS",
    "LAS PINAS CITY": "LAS PINAS",
    "CITY OF LAS PIÑAS": "LAS PINAS",
    "CITY OF LAS PINAS": "LAS PINAS",
    "PASAY CITY": "PASAY",
    "CITY OF PASAY": "PASAY",
    "MUNTINLUPA CITY": "MUNTINLUPA",
    "CITY OF MUNTINLUPA": "MUNTINLUPA",
    "PATEROS": "PATEROS",
    "MUNICIPALITY OF PATEROS": "PATEROS",
    "SAN JUAN CITY": "SAN JUAN",
    "CITY OF SAN JUAN": "SAN JUAN",
    "MANDALUYONG CITY": "MANDALUYONG",
    "CITY OF MANDALUYONG": "MANDALUYONG",
}

EXPECTED_CITIES = {
    "MANILA",
    "QUEZON",
    "CALOOCAN",
    "PARANAQUE",
    "PASIG",
    "TAGUIG",
    "MALABON",
    "NAVOTAS",
    "VALENZUELA",
    "MARIKINA",
    "MAKATI",
    "LAS PINAS",
    "PASAY",
    "MUNTINLUPA",
    "PATEROS",
    "SAN JUAN",
    "MANDALUYONG",
}


def log(msg: str) -> None:
    print(f"[roberto] {msg}", flush=True)


def load_projects() -> gpd.GeoDataFrame:
    log("Loading DPWH parquet...")
    df = pd.read_parquet(PARQUET_PATH)
    log(f"  Total records: {len(df):,}")

    df["region"] = df["location"].apply(
        lambda loc: loc.get("region", "") if isinstance(loc, dict) else ""
    )
    df = df[df["region"] == "National Capital Region"].copy()
    log(f"  NCR records: {len(df):,}")

    df = df[df["category"].str.contains("Flood", case=False, na=False)].copy()
    log(f"  NCR flood projects: {len(df):,}")

    terminated_mask = df["status"].str.lower() == "terminated"
    n_terminated = terminated_mask.sum()
    df = df[~terminated_mask].copy()
    log(f"  Excluded {n_terminated} terminated projects, remaining: {len(df):,}")

    null_coords = df["latitude"].isna() | df["longitude"].isna()
    n_null = null_coords.sum()
    df = df[~null_coords].copy()
    log(f"  Dropped {n_null} null-coordinate projects, remaining: {len(df):,}")

    geometry = [Point(lon, lat) for lon, lat in zip(df["longitude"], df["latitude"])]
    gdf = gpd.GeoDataFrame(df, geometry=geometry, crs=CRS_WGS84)
    return gdf


def load_boundaries() -> gpd.GeoDataFrame:
    log("Loading NCR boundaries...")
    gdf = gpd.read_file(BOUNDARIES_PATH)
    log(f"  {len(gdf)} city boundaries loaded")

    if "city_norm" not in gdf.columns:
        raise ValueError("NCR boundaries missing 'city_norm' column")

    missing = EXPECTED_CITIES - set(gdf["city_norm"].unique())
    if missing:
        raise ValueError(f"Missing cities in boundaries: {missing}")

    return gdf


def load_hazard() -> gpd.GeoDataFrame:
    log("Loading NOAH hazard shapefile...")
    gdf = gpd.read_file(f"zip://{HAZARD_PATH}")
    log(
        f"  {len(gdf)} hazard polygons loaded, Var values: {sorted(gdf['Var'].unique())}"
    )
    return gdf


def assign_projects_to_cities(
    projects: gpd.GeoDataFrame,
    boundaries: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    log("Spatial join: assigning projects to cities...")

    if projects.crs != boundaries.crs:
        projects = projects.to_crs(boundaries.crs)

    joined = gpd.sjoin(
        projects, boundaries[["city_norm", "geometry"]], predicate="within"
    )
    n_unassigned = len(projects) - len(joined)
    log(
        f"  Assigned {len(joined):,} projects to cities ({n_unassigned} outside NCR boundaries)"
    )
    return joined


def compute_scores(
    projects: gpd.GeoDataFrame,
    boundaries: gpd.GeoDataFrame,
    hazard: gpd.GeoDataFrame,
) -> list[dict]:
    log("Computing scores per city...")

    boundaries_utm = boundaries.to_crs(CRS_UTM)
    hazard_utm = hazard.to_crs(CRS_UTM)
    projects_utm = projects.to_crs(CRS_UTM)

    hazard_high = hazard_utm[hazard_utm["Var"] == 3.0]
    if hazard_high.empty:
        raise ValueError("No Var=3.0 hazard polygons found")
    hazard_high_geom = make_valid(unary_union(hazard_high.geometry))

    cities_data = []

    for _, city_row in boundaries_utm.iterrows():
        city_name = city_row["city_norm"]
        city_geom = make_valid(city_row.geometry)

        city_hazard = city_geom.intersection(hazard_high_geom)
        total_high_hazard_area_m2 = city_hazard.area

        city_projects = projects_utm[projects_utm["city_norm"] == city_name]
        n_projects = len(city_projects)

        raw_covered_area_m2 = 0.0
        avg_progress = 0.0
        effective_score = 0.0

        if n_projects > 0 and total_high_hazard_area_m2 > 0:
            buffers = city_projects.geometry.buffer(
                BUFFER_RADIUS_M, resolution=BUFFER_SEGMENTS
            )
            buffered_union = make_valid(unary_union(buffers))

            covered = buffered_union.intersection(city_hazard)
            raw_covered_area_m2 = covered.area

            avg_progress = city_projects["progress"].mean()
            if pd.isna(avg_progress):
                avg_progress = 0.0

            raw_ratio = raw_covered_area_m2 / total_high_hazard_area_m2
            effective_score = raw_ratio * (avg_progress / 100.0)
            # Buffers can exceed hazard zone area, so cap at 1.0
            effective_score = min(effective_score, 1.0)

        status_counts = {}
        if n_projects > 0:
            status_counts = city_projects["status"].value_counts().to_dict()

        budget_sum = 0.0
        if n_projects > 0 and "budget" in city_projects.columns:
            budget_sum = city_projects["budget"].sum()
            if pd.isna(budget_sum):
                budget_sum = 0.0

        display_name = city_row.get("admin3Name_en", city_name.title())

        cities_data.append(
            {
                "id": city_name.lower().replace(" ", "_"),
                "name": display_name,
                "city_norm": city_name,
                "effective_coverage_score": round(effective_score, 4),
                "raw_coverage_ratio": round(
                    raw_covered_area_m2 / total_high_hazard_area_m2
                    if total_high_hazard_area_m2 > 0
                    else 0.0,
                    4,
                ),
                "avg_progress": round(avg_progress, 2),
                "total_high_hazard_area_km2": round(total_high_hazard_area_m2 / 1e6, 4),
                "raw_covered_area_km2": round(raw_covered_area_m2 / 1e6, 4),
                "project_count": n_projects,
                "status_breakdown": status_counts,
                "budget_total_php": round(budget_sum, 2),
            }
        )

        log(
            f"  {city_name}: score={effective_score:.4f}, projects={n_projects}, "
            f"hazard={total_high_hazard_area_m2 / 1e6:.2f}km2, covered={raw_covered_area_m2 / 1e6:.2f}km2"
        )

    cities_data.sort(key=lambda c: c["effective_coverage_score"])
    return cities_data


def build_projects_json(projects: gpd.GeoDataFrame) -> list[dict]:
    records = []
    for _, row in projects.iterrows():
        records.append(
            {
                "id": str(row.get("contractId", row.name)),
                "name": row.get("description", "Unknown"),
                "city_norm": row["city_norm"],
                "latitude": round(float(row["latitude"]), 6),
                "longitude": round(float(row["longitude"]), 6),
                "status": row.get("status", "Unknown"),
                "progress": round(float(row["progress"]), 2)
                if pd.notna(row.get("progress"))
                else 0.0,
                "category": row.get("category", ""),
                "contractor": row.get("contractor", ""),
                "budget": round(float(row["budget"]), 2)
                if pd.notna(row.get("budget"))
                else 0.0,
            }
        )
    return records


def simplify_boundaries(boundaries: gpd.GeoDataFrame) -> dict:
    simplified = boundaries.copy()
    # ~0.001 degrees ≈ 100m tolerance — good balance of detail vs file size for Leaflet
    simplified["geometry"] = simplified.geometry.simplify(0.001, preserve_topology=True)

    keep_cols = ["city_norm", "admin3Name_en", "admin3Pcode", "geometry"]
    existing_cols = [c for c in keep_cols if c in simplified.columns]
    simplified = simplified[existing_cols]

    return json.loads(simplified.to_json())


def simplify_hazard(hazard: gpd.GeoDataFrame, boundaries: gpd.GeoDataFrame) -> dict:
    ncr_extent = make_valid(unary_union(boundaries.geometry))
    clipped = hazard.copy()
    clipped["geometry"] = clipped.geometry.apply(
        lambda g: make_valid(g).intersection(ncr_extent)
    )
    clipped = clipped[~clipped.geometry.is_empty].copy()

    # topology=False + 0.005 degrees ≈ 500m to get from 72MB raw down to <5MB for web
    clipped["geometry"] = clipped.geometry.simplify(0.005, preserve_topology=False)
    clipped["geometry"] = clipped.geometry.apply(make_valid)

    clipped["var_level"] = clipped["Var"].astype(int)
    clipped = clipped[["var_level", "geometry"]]

    geojson_str = clipped.to_json()
    geojson = json.loads(geojson_str)

    def truncate_coords(obj: object) -> object:
        if isinstance(obj, float):
            return round(obj, 4)
        if isinstance(obj, list):
            return [truncate_coords(x) for x in obj]
        if isinstance(obj, dict):
            return {k: truncate_coords(v) for k, v in obj.items()}
        return obj

    geojson["features"] = [truncate_coords(f) for f in geojson["features"]]
    return geojson


def main() -> int:
    log("=" * 60)
    log("Roberto Build Pipeline")
    log("=" * 60)
    start_time = datetime.now(timezone.utc)

    for path, label in [
        (PARQUET_PATH, "DPWH parquet"),
        (BOUNDARIES_PATH, "NCR boundaries"),
        (HAZARD_PATH, "NOAH hazard shapefile"),
    ]:
        if not path.exists():
            log(f"ERROR: {label} not found at {path}")
            return 1

    projects = load_projects()
    boundaries = load_boundaries()
    hazard = load_hazard()

    projects = assign_projects_to_cities(projects, boundaries)
    cities_data = compute_scores(projects, boundaries, hazard)
    projects_json = build_projects_json(projects)
    boundaries_geojson = simplify_boundaries(boundaries)
    hazard_geojson = simplify_hazard(hazard, boundaries)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    cities_path = DATA_DIR / "cities.json"
    with open(cities_path, "w") as f:
        json.dump(cities_data, f, indent=2)
    log(f"Wrote {cities_path} ({len(cities_data)} cities)")

    projects_path = DATA_DIR / "projects.json"
    with open(projects_path, "w") as f:
        json.dump(projects_json, f, indent=2)
    log(f"Wrote {projects_path} ({len(projects_json)} projects)")

    boundaries_path = DATA_DIR / "city_boundaries.geojson"
    with open(boundaries_path, "w") as f:
        json.dump(boundaries_geojson, f, indent=2)
    log(f"Wrote {boundaries_path}")

    hazard_path = DATA_DIR / "hazard_zones.geojson"
    with open(hazard_path, "w") as f:
        json.dump(hazard_geojson, f, indent=2)
    hazard_size_mb = hazard_path.stat().st_size / 1e6
    log(f"Wrote {hazard_path} ({hazard_size_mb:.1f} MB)")

    meta = {
        "version": "1.0.0",
        "generated_at": start_time.isoformat(),
        "buffer_radius_m": BUFFER_RADIUS_M,
        "crs_computation": CRS_UTM,
        "crs_storage": CRS_WGS84,
        "total_projects": len(projects_json),
        "total_cities": len(cities_data),
        "data_sources": {
            "dpwh": "BetterGov.ph DPWH Transparency Dataset (CC0)",
            "hazard": "NOAH Metro Manila 25yr Flood Hazard (ODbL 1.0)",
            "boundaries": "OCHA Philippines Admin Boundaries + faeldon GeoJSON",
        },
        "scoring_formula": "EffectiveCoverage = (raw_covered_area / total_high_hazard_area) * (avg_progress / 100)",
    }
    meta_path = DATA_DIR / "meta.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    log(f"Wrote {meta_path}")

    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
    log(f"Pipeline complete in {elapsed:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
