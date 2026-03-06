# Incident Command API Contract

This document mirrors `server/src/contracts/incident-command.ts` and defines the architecture-level API contract for the Incident Command Layer.

## Modules

- `auth`
- `incidents`
- `dispatch`
- `evac-centers`
- `realtime`

## Roles

- `reporter`
- `coordinator`
- `responder`
- `public` (unauthenticated endpoint access only)

## Optimistic Concurrency Rule

All `PATCH` endpoints require `{ "version": number }` in the request body.

- If the provided `version` does not match the stored resource version, the API returns `409 Conflict`.

## Endpoint Map

| Module | Method | Path | Allowed roles | Notes | Status codes |
|---|---|---|---|---|---|
| auth | POST | `/api/auth/login` | `public` | Returns signed JWT | `200, 400, 401` |
| incidents | GET | `/api/incidents` | `coordinator, responder, reporter` | List incidents | `200, 401, 403` |
| incidents | POST | `/api/incidents` | `reporter` | Creates incident with initial `PING` status | `201, 400, 401, 403` |
| incidents | PATCH | `/api/incidents/:id/verify` | `coordinator` | `PING -> VERIFIED`; requires `version` | `200, 400, 401, 403, 404, 409, 422` |
| incidents | PATCH | `/api/incidents/:id/prioritize` | `coordinator` | `VERIFIED -> PRIORITIZED`; requires `version` | `200, 400, 401, 403, 404, 409, 422` |
| dispatch | PATCH | `/api/incidents/:id/assign` | `coordinator` | `PRIORITIZED -> ASSIGNED`; requires `version` | `200, 400, 401, 403, 404, 409, 422` |
| incidents | PATCH | `/api/incidents/:id/resolve` | `responder` | `ASSIGNED -> RESOLVED` or `ASSIGNED -> STOOD_DOWN`; requires `version` | `200, 400, 401, 403, 404, 409, 422` |
| incidents | PATCH | `/api/incidents/:id/duplicate` | `coordinator` | `PING -> DUPLICATE`; requires `version` | `200, 400, 401, 403, 404, 409, 422` |
| incidents | PATCH | `/api/incidents/:id/reject` | `coordinator` | `PING -> REJECTED`; requires `version` | `200, 400, 401, 403, 404, 409, 422` |
| incidents | GET | `/api/incidents/:id` | `coordinator, responder, reporter` | Get incident details | `200, 401, 403, 404` |
| incidents | GET | `/api/incidents/:id/events` | `coordinator, responder` | Incident event timeline | `200, 401, 403, 404` |
| evac-centers | GET | `/api/evac-centers/nearby?lat=&lng=` | `public` | Query params `lat` and `lng` are required | `200, 400` |
| realtime | GET | `/api/events` | `coordinator, responder` | SSE stream endpoint | `200, 401, 403` |

## Lifecycle Transition Map

Allowed lifecycle edges:

- `PING -> VERIFIED | DUPLICATE | REJECTED`
- `VERIFIED -> PRIORITIZED`
- `PRIORITIZED -> ASSIGNED`
- `ASSIGNED -> RESOLVED | STOOD_DOWN`

Terminal statuses (no further transitions in this contract):

- `RESOLVED`
- `STOOD_DOWN`
- `DUPLICATE`
- `REJECTED`
