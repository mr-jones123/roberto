import {
  ACCESS_ROLE,
  HTTP_METHOD,
  INCIDENT_ENDPOINTS,
  INCIDENT_LIFECYCLE_TRANSITIONS,
  INCIDENT_MODULE,
  INCIDENT_PATCH_ENDPOINT_IDS,
  INCIDENT_ROLE,
  INCIDENT_STATUS,
  type AccessRole,
  type IncidentStatus,
  type IncidentTransitionSource
} from "./incident-command.js";

const REQUIRED_ENDPOINT_PATHS = [
  "/api/auth/login",
  "/api/incidents",
  "/api/incidents/:id/verify",
  "/api/incidents/:id/prioritize",
  "/api/incidents/:id/assign",
  "/api/incidents/:id/resolve",
  "/api/incidents/:id/duplicate",
  "/api/incidents/:id/reject",
  "/api/incidents/:id",
  "/api/incidents/:id/events",
  "/api/evac-centers/nearby",
  "/api/events"
] as const;

const EXPECTED_TRANSITIONS: Readonly<Record<IncidentTransitionSource, readonly IncidentStatus[]>> = {
  [INCIDENT_STATUS.PING]: [INCIDENT_STATUS.VERIFIED, INCIDENT_STATUS.DUPLICATE, INCIDENT_STATUS.REJECTED],
  [INCIDENT_STATUS.VERIFIED]: [INCIDENT_STATUS.PRIORITIZED],
  [INCIDENT_STATUS.PRIORITIZED]: [INCIDENT_STATUS.ASSIGNED],
  [INCIDENT_STATUS.ASSIGNED]: [INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.STOOD_DOWN]
};

const definedAccessRoles = new Set<AccessRole>(Object.values(ACCESS_ROLE));

const arraysMatchAsSet = <T extends string>(a: readonly T[], b: readonly T[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  const left = new Set(a);
  const right = new Set(b);

  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const validateEndpoints = (): void => {
  assert(INCIDENT_ENDPOINTS.length > 0, "Contract must define endpoints.");

  const endpointIds = new Set<string>();
  const endpointPaths = new Set<string>();
  const moduleCoverage = new Set<string>();

  for (const endpoint of INCIDENT_ENDPOINTS) {
    assert(endpoint.id.trim().length > 0, "Endpoint must define a non-empty id.");
    assert(!endpointIds.has(endpoint.id), `Endpoint id must be unique: ${endpoint.id}`);
    endpointIds.add(endpoint.id);

    assert(endpoint.method.trim().length > 0, `Endpoint ${endpoint.id} missing method.`);
    assert(endpoint.path.trim().length > 0, `Endpoint ${endpoint.id} missing path.`);
    assert(endpoint.roles.length > 0, `Endpoint ${endpoint.id} must define roles.`);
    assert(endpoint.statusCodes.length > 0, `Endpoint ${endpoint.id} must define status codes.`);

    moduleCoverage.add(endpoint.module);

    if (endpoint.method === HTTP_METHOD.POST || endpoint.method === HTTP_METHOD.PATCH) {
      endpointPaths.add(`${endpoint.method} ${endpoint.path}`);
    } else {
      endpointPaths.add(`${endpoint.method} ${endpoint.path}`);
    }

    for (const role of endpoint.roles) {
      assert(definedAccessRoles.has(role), `Endpoint ${endpoint.id} has unknown role ${role}.`);
    }

    for (const statusCode of endpoint.statusCodes) {
      assert(Number.isInteger(statusCode), `Endpoint ${endpoint.id} has non-integer status code.`);
      assert(statusCode >= 100 && statusCode <= 599, `Endpoint ${endpoint.id} has invalid status code ${statusCode}.`);
    }

    if (endpoint.method === HTTP_METHOD.PATCH) {
      assert(endpoint.requestBody !== undefined, `PATCH endpoint ${endpoint.id} must define request body requirements.`);
      assert(
        endpoint.requestBody?.requiredFields.includes("version") ?? false,
        `PATCH endpoint ${endpoint.id} must require version in request body.`
      );
      assert(endpoint.optimisticConcurrency?.required === true, `PATCH endpoint ${endpoint.id} must enable optimistic concurrency.`);
      assert(
        endpoint.optimisticConcurrency?.versionField === "version",
        `PATCH endpoint ${endpoint.id} must use version as concurrency field.`
      );
      assert(
        endpoint.optimisticConcurrency?.conflictStatusCode === 409,
        `PATCH endpoint ${endpoint.id} must declare 409 conflict status for version mismatch.`
      );
      assert(
        endpoint.statusCodes.includes(409),
        `PATCH endpoint ${endpoint.id} must include 409 in status codes.`
      );
    }
  }

  const requiredMethodPathPairs = [
    "POST /api/auth/login",
    "GET /api/incidents",
    "POST /api/incidents",
    "PATCH /api/incidents/:id/verify",
    "PATCH /api/incidents/:id/prioritize",
    "PATCH /api/incidents/:id/assign",
    "PATCH /api/incidents/:id/resolve",
    "PATCH /api/incidents/:id/duplicate",
    "PATCH /api/incidents/:id/reject",
    "GET /api/incidents/:id",
    "GET /api/incidents/:id/events",
    "GET /api/evac-centers/nearby",
    "GET /api/events"
  ] as const;

  for (const required of requiredMethodPathPairs) {
    assert(endpointPaths.has(required), `Missing required endpoint ${required}.`);
  }

  for (const moduleName of Object.values(INCIDENT_MODULE)) {
    assert(moduleCoverage.has(moduleName), `Module ${moduleName} has no endpoints defined.`);
  }

  assert(INCIDENT_PATCH_ENDPOINT_IDS.length > 0, "No PATCH endpoints are registered for optimistic concurrency checks.");
  for (const endpointId of INCIDENT_PATCH_ENDPOINT_IDS) {
    assert(endpointIds.has(endpointId), `PATCH endpoint list references unknown endpoint id ${endpointId}.`);
  }

  for (const path of REQUIRED_ENDPOINT_PATHS) {
    const found = INCIDENT_ENDPOINTS.some((endpoint) => endpoint.path === path);
    assert(found, `Required endpoint path is missing from contract: ${path}`);
  }
};

const validateLifecycle = (): void => {
  const sourceStates = Object.keys(INCIDENT_LIFECYCLE_TRANSITIONS) as IncidentTransitionSource[];
  assert(sourceStates.length > 0, "Lifecycle map must have at least one source state.");

  for (const source of sourceStates) {
    const targets = INCIDENT_LIFECYCLE_TRANSITIONS[source];
    assert(targets.length > 0, `Lifecycle source state ${source} must have at least one target.`);
    const expectedTargets = EXPECTED_TRANSITIONS[source];
    assert(expectedTargets !== undefined, `Lifecycle source ${source} is not expected.`);
    assert(
      arraysMatchAsSet(targets, expectedTargets),
      `Lifecycle targets mismatch for ${source}. Expected [${expectedTargets.join(", ")}], got [${targets.join(", ")}].`
    );

    for (const target of targets) {
      assert(Object.values(INCIDENT_STATUS).includes(target), `Lifecycle source ${source} has unknown target ${target}.`);
    }
  }

  const expectedSources = Object.keys(EXPECTED_TRANSITIONS) as IncidentTransitionSource[];
  for (const expectedSource of expectedSources) {
    assert(sourceStates.includes(expectedSource), `Lifecycle source ${expectedSource} missing from contract.`);
  }
};

const validateRoles = (): void => {
  const incidentRoles = new Set(Object.values(INCIDENT_ROLE));
  assert(incidentRoles.size === 3, "Incident roles must be reporter, coordinator, responder.");
  assert(incidentRoles.has("reporter"), "reporter role missing.");
  assert(incidentRoles.has("coordinator"), "coordinator role missing.");
  assert(incidentRoles.has("responder"), "responder role missing.");
};

const run = (): void => {
  validateRoles();
  validateEndpoints();
  validateLifecycle();

  console.log(
    [
      "Incident command contract validation passed.",
      `- Endpoints: ${INCIDENT_ENDPOINTS.length}`,
      `- Roles: ${Object.values(INCIDENT_ROLE).join(", ")}`,
      `- Modules: ${Object.values(INCIDENT_MODULE).join(", ")}`,
      `- Lifecycle source states: ${Object.keys(INCIDENT_LIFECYCLE_TRANSITIONS).length}`
    ].join("\n")
  );
};

run();
