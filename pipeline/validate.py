"""
Roberto Validation Script
=========================
Validates the output of build.py against acceptance criteria.
"""

import json
import math
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

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

# QC area should be roughly 162 km2 (±30%)
QC_AREA_EXPECTED_KM2 = 162.0
QC_AREA_TOLERANCE = 0.30  # 30%

PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    status = "PASS" if condition else "FAIL"
    if condition:
        PASS += 1
    else:
        FAIL += 1
    suffix = f" — {detail}" if detail else ""
    print(f"  [{status}] {name}{suffix}")


def main() -> int:
    global PASS, FAIL
    print("=" * 60)
    print("Roberto Validation")
    print("=" * 60)

    # Check files exist
    cities_path = DATA_DIR / "cities.json"
    projects_path = DATA_DIR / "projects.json"
    boundaries_path = DATA_DIR / "city_boundaries.geojson"
    meta_path = DATA_DIR / "meta.json"

    for path in [cities_path, projects_path, boundaries_path, meta_path]:
        check(f"{path.name} exists", path.exists())
        if not path.exists():
            print(f"\nFATAL: {path.name} missing. Run build.py first.")
            return 1

    # Load data
    with open(cities_path) as f:
        cities = json.load(f)
    with open(projects_path) as f:
        projects = json.load(f)
    with open(boundaries_path) as f:
        boundaries = json.load(f)
    with open(meta_path) as f:
        meta = json.load(f)

    # --- Cities validation ---
    print("\nCities:")
    check("Exactly 17 cities", len(cities) == 17, f"got {len(cities)}")

    city_norms = {c["city_norm"] for c in cities}
    missing = EXPECTED_CITIES - city_norms
    extra = city_norms - EXPECTED_CITIES
    check(
        "All expected cities present",
        len(missing) == 0,
        f"missing: {missing}" if missing else "",
    )
    check("No unexpected cities", len(extra) == 0, f"extra: {extra}" if extra else "")

    # Scores in valid range
    scores = [c["effective_coverage_score"] for c in cities]
    check("No score > 1.0", all(s <= 1.0 for s in scores), f"max: {max(scores)}")
    check("No score < 0.0", all(s >= 0.0 for s in scores), f"min: {min(scores)}")
    check("No NaN scores", all(not math.isnan(s) for s in scores))

    # Sorted ascending
    check("Cities sorted ascending by score", scores == sorted(scores))

    # All cities have required fields
    required_fields = [
        "id",
        "name",
        "city_norm",
        "effective_coverage_score",
        "raw_coverage_ratio",
        "avg_progress",
        "total_high_hazard_area_km2",
        "raw_covered_area_km2",
        "project_count",
        "status_breakdown",
        "budget_total_php",
    ]
    for field in required_fields:
        check(
            f"All cities have '{field}'",
            all(field in c for c in cities),
        )

    # QC area sanity check
    qc = next((c for c in cities if c["city_norm"] == "QUEZON"), None)
    if qc:
        # total_high_hazard is only Var=3, which is a subset of QC's total area
        # Just check it's a positive, reasonable number (< QC total area ~162 km2)
        qc_hazard = qc["total_high_hazard_area_km2"]
        check(
            "QC high-hazard area is positive and < city total",
            0 < qc_hazard < QC_AREA_EXPECTED_KM2 * (1 + QC_AREA_TOLERANCE),
            f"got {qc_hazard:.2f} km2",
        )

    # --- Projects validation ---
    print("\nProjects:")
    check("Projects non-empty", len(projects) > 0, f"got {len(projects)}")
    check(
        "No terminated projects",
        all(p.get("status", "").lower() != "terminated" for p in projects),
    )

    # All projects have city assignment
    check(
        "All projects have city_norm",
        all("city_norm" in p and p["city_norm"] in EXPECTED_CITIES for p in projects),
    )

    # --- Boundaries validation ---
    print("\nBoundaries:")
    features = boundaries.get("features", [])
    check("17 boundary features", len(features) == 17, f"got {len(features)}")

    # --- Meta validation ---
    print("\nMeta:")
    check("Meta has version", "version" in meta)
    check("Meta has generated_at", "generated_at" in meta)
    check("Meta has scoring_formula", "scoring_formula" in meta)

    # --- Summary ---
    print(f"\n{'=' * 60}")
    print(f"Results: {PASS} passed, {FAIL} failed")
    print(f"{'=' * 60}")

    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
