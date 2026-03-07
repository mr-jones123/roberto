import {
  INCIDENT_LIFECYCLE_TRANSITIONS,
  INCIDENT_STATUS,
  type IncidentStatus,
} from "../contracts/incident-command.js";
import type { InviteStatus } from "../db/incident-store.js";

export const TRANSITION_GUARD: Record<IncidentStatus, IncidentStatus[]> = {
  [INCIDENT_STATUS.PING]: [...INCIDENT_LIFECYCLE_TRANSITIONS[INCIDENT_STATUS.PING]],
  [INCIDENT_STATUS.VERIFIED]: [...INCIDENT_LIFECYCLE_TRANSITIONS[INCIDENT_STATUS.VERIFIED]],
  [INCIDENT_STATUS.PRIORITIZED]: [...INCIDENT_LIFECYCLE_TRANSITIONS[INCIDENT_STATUS.PRIORITIZED]],
  [INCIDENT_STATUS.ASSIGNED]: [...INCIDENT_LIFECYCLE_TRANSITIONS[INCIDENT_STATUS.ASSIGNED]],
  [INCIDENT_STATUS.RESOLVED]: [],
  [INCIDENT_STATUS.STOOD_DOWN]: [],
  [INCIDENT_STATUS.DUPLICATE]: [],
  [INCIDENT_STATUS.REJECTED]: [],
};

export const INVITE_TRANSITION_GUARD: Record<InviteStatus, InviteStatus[]> = {
  pending: ["accepted", "rejected", "cancelled", "expired"],
  accepted: [],
  rejected: [],
  cancelled: [],
  expired: [],
};
