export const INCIDENT_MODULE = {
  AUTH: "auth",
  INCIDENTS: "incidents",
  DISPATCH: "dispatch",
  EVAC_CENTERS: "evac-centers",
  REALTIME: "realtime"
} as const;

export type IncidentModule = (typeof INCIDENT_MODULE)[keyof typeof INCIDENT_MODULE];

export const INCIDENT_ROLE = {
  REPORTER: "reporter",
  COORDINATOR: "coordinator",
  RESPONDER: "responder"
} as const;

export type IncidentRole = (typeof INCIDENT_ROLE)[keyof typeof INCIDENT_ROLE];

export const ACCESS_ROLE = {
  PUBLIC: "public",
  ...INCIDENT_ROLE
} as const;

export type AccessRole = (typeof ACCESS_ROLE)[keyof typeof ACCESS_ROLE];

export const HTTP_METHOD = {
  GET: "GET",
  POST: "POST",
  PATCH: "PATCH"
} as const;

export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];

export const INCIDENT_STATUS = {
  PING: "PING",
  VERIFIED: "VERIFIED",
  PRIORITIZED: "PRIORITIZED",
  ASSIGNED: "ASSIGNED",
  RESOLVED: "RESOLVED",
  STOOD_DOWN: "STOOD_DOWN",
  DUPLICATE: "DUPLICATE",
  REJECTED: "REJECTED"
} as const;

export type IncidentStatus = (typeof INCIDENT_STATUS)[keyof typeof INCIDENT_STATUS];

export type IncidentTransitionSource =
  | typeof INCIDENT_STATUS.PING
  | typeof INCIDENT_STATUS.VERIFIED
  | typeof INCIDENT_STATUS.PRIORITIZED
  | typeof INCIDENT_STATUS.ASSIGNED;

export type EndpointContract = {
  id: string;
  module: IncidentModule;
  method: HttpMethod;
  path: string;
  roles: readonly AccessRole[];
  statusCodes: readonly number[];
  description: string;
  sse?: boolean;
  queryParams?: {
    required: readonly string[];
  };
  requestBody?: {
    requiredFields: readonly string[];
  };
  optimisticConcurrency?: {
    required: boolean;
    versionField: "version";
    conflictStatusCode: 409;
  };
};

export const INCIDENT_ENDPOINTS = [
  {
    id: "auth.login",
    module: INCIDENT_MODULE.AUTH,
    method: HTTP_METHOD.POST,
    path: "/api/auth/login",
    roles: [ACCESS_ROLE.PUBLIC],
    statusCodes: [200, 400, 401],
    description: "Authenticate user credentials and return a signed JWT.",
    requestBody: {
      requiredFields: ["username", "password"]
    }
  },
  {
    id: "incidents.list",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.GET,
    path: "/api/incidents",
    roles: [ACCESS_ROLE.COORDINATOR, ACCESS_ROLE.RESPONDER, ACCESS_ROLE.REPORTER],
    statusCodes: [200, 401, 403],
    description: "List incidents visible to the requesting role."
  },
  {
    id: "incidents.create",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.POST,
    path: "/api/incidents",
    roles: [ACCESS_ROLE.REPORTER],
    statusCodes: [201, 400, 401, 403],
    description: "Create a new incident in PING state.",
    requestBody: {
      requiredFields: ["title", "description", "location"]
    }
  },
  {
    id: "incidents.verify",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.PATCH,
    path: "/api/incidents/:id/verify",
    roles: [ACCESS_ROLE.COORDINATOR],
    statusCodes: [200, 400, 401, 403, 404, 409, 422],
    description: "Verify a PING incident and transition it to VERIFIED.",
    requestBody: {
      requiredFields: ["version"]
    },
    optimisticConcurrency: {
      required: true,
      versionField: "version",
      conflictStatusCode: 409
    }
  },
  {
    id: "incidents.prioritize",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.PATCH,
    path: "/api/incidents/:id/prioritize",
    roles: [ACCESS_ROLE.COORDINATOR],
    statusCodes: [200, 400, 401, 403, 404, 409, 422],
    description: "Prioritize a VERIFIED incident.",
    requestBody: {
      requiredFields: ["version", "priority"]
    },
    optimisticConcurrency: {
      required: true,
      versionField: "version",
      conflictStatusCode: 409
    }
  },
  {
    id: "dispatch.assign",
    module: INCIDENT_MODULE.DISPATCH,
    method: HTTP_METHOD.PATCH,
    path: "/api/incidents/:id/assign",
    roles: [ACCESS_ROLE.COORDINATOR],
    statusCodes: [200, 400, 401, 403, 404, 409, 422],
    description: "Assign responders to a PRIORITIZED incident.",
    requestBody: {
      requiredFields: ["version", "responderId"]
    },
    optimisticConcurrency: {
      required: true,
      versionField: "version",
      conflictStatusCode: 409
    }
  },
  {
    id: "incidents.resolve",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.PATCH,
    path: "/api/incidents/:id/resolve",
    roles: [ACCESS_ROLE.RESPONDER],
    statusCodes: [200, 400, 401, 403, 404, 409, 422],
    description: "Resolve or stand down an ASSIGNED incident.",
    requestBody: {
      requiredFields: ["version", "resolution"]
    },
    optimisticConcurrency: {
      required: true,
      versionField: "version",
      conflictStatusCode: 409
    }
  },
  {
    id: "incidents.duplicate",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.PATCH,
    path: "/api/incidents/:id/duplicate",
    roles: [ACCESS_ROLE.COORDINATOR],
    statusCodes: [200, 400, 401, 403, 404, 409, 422],
    description: "Mark a PING incident as DUPLICATE.",
    requestBody: {
      requiredFields: ["version", "canonicalIncidentId"]
    },
    optimisticConcurrency: {
      required: true,
      versionField: "version",
      conflictStatusCode: 409
    }
  },
  {
    id: "incidents.reject",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.PATCH,
    path: "/api/incidents/:id/reject",
    roles: [ACCESS_ROLE.COORDINATOR],
    statusCodes: [200, 400, 401, 403, 404, 409, 422],
    description: "Reject a PING incident as invalid or out-of-scope.",
    requestBody: {
      requiredFields: ["version", "reason"]
    },
    optimisticConcurrency: {
      required: true,
      versionField: "version",
      conflictStatusCode: 409
    }
  },
  {
    id: "incidents.get",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.GET,
    path: "/api/incidents/:id",
    roles: [ACCESS_ROLE.COORDINATOR, ACCESS_ROLE.RESPONDER, ACCESS_ROLE.REPORTER],
    statusCodes: [200, 401, 403, 404],
    description: "Fetch incident details by ID."
  },
  {
    id: "incidents.events",
    module: INCIDENT_MODULE.INCIDENTS,
    method: HTTP_METHOD.GET,
    path: "/api/incidents/:id/events",
    roles: [ACCESS_ROLE.COORDINATOR, ACCESS_ROLE.RESPONDER],
    statusCodes: [200, 401, 403, 404],
    description: "Get incident event/audit timeline."
  },
  {
    id: "evac-centers.nearby",
    module: INCIDENT_MODULE.EVAC_CENTERS,
    method: HTTP_METHOD.GET,
    path: "/api/evac-centers/nearby",
    roles: [ACCESS_ROLE.PUBLIC],
    statusCodes: [200, 400],
    description: "Find nearby evacuation centers by latitude/longitude.",
    queryParams: {
      required: ["lat", "lng"]
    }
  },
  {
    id: "realtime.events",
    module: INCIDENT_MODULE.REALTIME,
    method: HTTP_METHOD.GET,
    path: "/api/events",
    roles: [ACCESS_ROLE.COORDINATOR, ACCESS_ROLE.RESPONDER],
    statusCodes: [200, 401, 403],
    description: "Subscribe to real-time command events over SSE.",
    sse: true
  }
] as const satisfies readonly EndpointContract[];

export const INCIDENT_ENDPOINTS_BY_MODULE = {
  [INCIDENT_MODULE.AUTH]: INCIDENT_ENDPOINTS.filter((endpoint) => endpoint.module === INCIDENT_MODULE.AUTH),
  [INCIDENT_MODULE.INCIDENTS]: INCIDENT_ENDPOINTS.filter((endpoint) => endpoint.module === INCIDENT_MODULE.INCIDENTS),
  [INCIDENT_MODULE.DISPATCH]: INCIDENT_ENDPOINTS.filter((endpoint) => endpoint.module === INCIDENT_MODULE.DISPATCH),
  [INCIDENT_MODULE.EVAC_CENTERS]: INCIDENT_ENDPOINTS.filter((endpoint) => endpoint.module === INCIDENT_MODULE.EVAC_CENTERS),
  [INCIDENT_MODULE.REALTIME]: INCIDENT_ENDPOINTS.filter((endpoint) => endpoint.module === INCIDENT_MODULE.REALTIME)
} as const;

export const INCIDENT_LIFECYCLE_TRANSITIONS: Readonly<Record<IncidentTransitionSource, readonly IncidentStatus[]>> = {
  [INCIDENT_STATUS.PING]: [INCIDENT_STATUS.VERIFIED, INCIDENT_STATUS.DUPLICATE, INCIDENT_STATUS.REJECTED],
  [INCIDENT_STATUS.VERIFIED]: [INCIDENT_STATUS.PRIORITIZED],
  [INCIDENT_STATUS.PRIORITIZED]: [INCIDENT_STATUS.ASSIGNED],
  [INCIDENT_STATUS.ASSIGNED]: [INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.STOOD_DOWN]
} as const;

export const INCIDENT_PATCH_ENDPOINT_IDS = INCIDENT_ENDPOINTS.filter(
  (endpoint) => endpoint.method === HTTP_METHOD.PATCH
).map((endpoint) => endpoint.id) as readonly string[];
