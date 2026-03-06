# Roberto Incident Command — Judging Evidence Package

Roberto transforms Metro Manila flood analytics into **real-time incident coordination**. Citizens report flooding, coordinators verify and prioritize using NOAH hazard data, and responders are dispatched to resolve — with nearest evacuation center guidance at every step. The system produces measurable response KPIs from an immutable audit trail, turning passive flood maps into coordinated community action.

---

## Focus Path: Climate

Roberto addresses urban climate flooding in Metro Manila through hazard-aware incident operations:

| Capability | How it addresses climate flooding |
|---|---|
| **Hazard-grounded reporting** | Incidents carry lat/lng coordinates overlaid on NOAH 25-year flood hazard maps (3 severity levels). Coordinators see reports in the context of known high-hazard zones. |
| **Priority scoring** | Coordinators assign severity scores (0–100) during triage, informed by flood depth, population density, and hazard layer data. Higher-hazard areas surface first. |
| **Evacuation guidance** | Every incident location triggers a nearest-3 evacuation center lookup (haversine distance). Responders and reporters see recommended centers before dispatch. |
| **Coverage gap awareness** | Roberto's base layer computes Effective Coverage Scores per city — exposing which high-hazard areas lack flood-control infrastructure and likely need faster incident response. |

---

## Impact

All metrics are computed server-side from the immutable `incident_events` audit table. No metric is inferred or fabricated.

| KPI | Definition | Demo Run Value | Source |
|---|---|---|---|
| **Avg Acknowledge Time** | Time from PING creation to VERIFIED | ~8.2 s | `GET /api/kpi` |
| **Avg Assignment Latency** | Time from VERIFIED to ASSIGNED | ~2.1 s | `GET /api/kpi` |
| **Resolution Rate** | % of incidents reaching RESOLVED | 60% (3/5) | `GET /api/kpi` |
| **Avg Resolution Time** | Time from PING creation to RESOLVED | ~9.9 s | `GET /api/kpi` |

**Note**: Demo values reflect scripted seed data, not real-world conditions. In production, these KPIs would be measured in minutes/hours. The system architecture and measurement infrastructure are real.

---

## Connection

Roberto brings three distinct roles into a coordinated workflow:

```
Reporter (citizen)  ──PING──▶  Coordinator (ops)  ──ASSIGN──▶  Responder (field)
       ▲                              │                              │
       └──── status updates ◀─────── SSE realtime ◀────────────────┘
```

| Role | Actions | Connection mechanism |
|---|---|---|
| **Reporter** | Submit flood pings with location + description + severity | Sees live status updates as their report progresses through the pipeline |
| **Coordinator** | Verify, mark duplicates/reject, prioritize, assign responders | Single queue view across all active incidents; dispatches based on proximity and severity |
| **Responder** | View assignments, resolve with completion notes | Receives dispatch via SSE; sees nearest evacuation centers for the incident location |

Key design choices enabling connection:
- **SSE realtime push** — all role UIs update within seconds of any state change, no polling
- **Immutable audit trail** — every action (verify, assign, resolve) records actor + timestamp, creating accountability
- **Optimistic concurrency** — version checks prevent conflicting updates when multiple coordinators act simultaneously

---

## Technical Architecture

Roberto is a **modular monolith** built on Express 5 and React 19 with TypeScript end-to-end. The server enforces a strict lifecycle state machine (PING → VERIFIED → PRIORITIZED → ASSIGNED → RESOLVED) with server-side transition guards that reject invalid jumps (HTTP 422) and stale updates (HTTP 409 via optimistic concurrency). Role-based authorization middleware gates every mutation endpoint — reporters cannot verify, responders cannot assign. Persistence uses SQLite with an append-only `incident_events` table that serves as both audit trail and KPI data source. SSE pushes incident state changes to all connected clients within the same event loop cycle.

---

## Limitations

- **Demo-scale only**: SQLite storage and single-process SSE are adequate for hackathon demonstration but would not scale to production load without migration to PostgreSQL and a pub/sub layer.
- **No real geolocation**: Reporter coordinates are manually entered, not sourced from device GPS. A production system would use the Geolocation API.
- **Fixed evacuation centers**: Evac center data is seeded, not sourced from a live government feed. Availability and capacity are static.
- **No routing/ETA**: The system shows haversine distance to evacuation centers, not actual travel time or route. No traffic or road-condition data is incorporated.
- **MVP authentication**: JWT tokens use a shared secret with pre-seeded users. No registration flow, password hashing, or session management suitable for real deployment.

---

## Evidence Artifacts

| Claim | Feature/Endpoint | Metric/Behavior | Evidence File |
|---|---|---|---|
| Full lifecycle works | `POST /api/incidents` → `PATCH .../verify` → `prioritize` → `assign` → `resolve` | PING → RESOLVED in 5 transitions | `.sisyphus/evidence/task-5-api-happy.txt` |
| Lifecycle guards enforce rules | `PATCH /api/incidents/:id/assign` on PING status | Returns HTTP 422 | `.sisyphus/evidence/task-4-lifecycle-failure.txt` |
| Role authorization works | Reporter calls verify endpoint | Returns HTTP 403 | `.sisyphus/evidence/task-3-role-happy.txt` |
| Invalid tokens rejected | Missing/malformed JWT | Returns HTTP 401 | `.sisyphus/evidence/task-3-role-failure.txt` |
| Data persists across restarts | Create → restart → refetch | Incident unchanged | `.sisyphus/evidence/task-2-persist-happy.txt` |
| Version conflict detected | Two updates from same version | One succeeds, one gets HTTP 409 | `.sisyphus/evidence/task-5-api-failure.txt` |
| Nearest evac centers returned | `GET /api/evac-centers/nearby?lat=&lng=` | Top-3 sorted by distance | `.sisyphus/evidence/task-6-evac-happy.txt` |
| Invalid coordinates rejected | Missing lat/lng params | Returns HTTP 400 | `.sisyphus/evidence/task-6-evac-failure.txt` |
| KPI metrics computed | `GET /api/kpi` | resolution_rate, avg times | `.sisyphus/evidence/task-14-demo-happy.txt` |
| SSE delivers events | SSE stream receives incident_created | Event payload matches | `.sisyphus/evidence/task-13-smoke-happy.txt` |
| 17/17 smoke checks pass | Full smoke suite | All checks green | `.sisyphus/evidence/task-13-smoke-happy.txt` |
| Deterministic demo | Seed + run twice | Consistent KPI outputs | `.sisyphus/evidence/task-14-demo-happy.txt` |
| Contract fully defined | All endpoints documented | Role + status code matrix | `.sisyphus/evidence/task-1-contract-happy.txt` |
