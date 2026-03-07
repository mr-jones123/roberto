-- Incident Command System — SQLite Schema
-- All timestamps stored as ISO-8601 TEXT (e.g. '2026-03-06T12:00:00.000Z')
-- This schema is additive — it does NOT touch the existing in-memory DataStore tables.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('reporter', 'coordinator', 'responder')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS incidents (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  latitude      REAL NOT NULL,
  longitude     REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PING'
                CHECK (status IN ('PING', 'VERIFIED', 'PRIORITIZED', 'ASSIGNED', 'RESOLVED', 'STOOD_DOWN', 'DUPLICATE', 'REJECTED')),
  priority      INTEGER,
  reporter_id   TEXT NOT NULL REFERENCES users(id),
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS incident_events (
  id            TEXT PRIMARY KEY,
  incident_id   TEXT NOT NULL REFERENCES incidents(id),
  actor_id      TEXT NOT NULL REFERENCES users(id),
  action        TEXT NOT NULL,
  old_status    TEXT,
  new_status    TEXT,
  payload       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id            TEXT PRIMARY KEY,
  incident_id   TEXT NOT NULL REFERENCES incidents(id),
  responder_id  TEXT NOT NULL REFERENCES users(id),
  locked_by     TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'released')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS evac_centers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'evacuation_center'
                CHECK (type IN ('evacuation_center', 'school', 'hospital', 'fire_station', 'police_station')),
  latitude      REAL NOT NULL,
  longitude     REAL NOT NULL,
  capacity      INTEGER,
  current_load  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Node Connection & Chat domain
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS help_nodes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS connection_invites (
  id                  TEXT PRIMARY KEY,
  sender_node_id      TEXT NOT NULL REFERENCES help_nodes(id),
  recipient_node_id   TEXT NOT NULL REFERENCES help_nodes(id),
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  version             INTEGER NOT NULL DEFAULT 1,
  expires_at          TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  invite_id   TEXT NOT NULL REFERENCES connection_invites(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL REFERENCES conversations(id),
  user_id           TEXT NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id                TEXT PRIMARY KEY,
  conversation_id   TEXT NOT NULL REFERENCES conversations(id),
  sender_id         TEXT NOT NULL REFERENCES users(id),
  client_msg_id     TEXT NOT NULL,
  body              TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(conversation_id, client_msg_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_reporter ON incidents(reporter_id);
CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_events_created ON incident_events(created_at);
CREATE INDEX IF NOT EXISTS idx_assignments_incident ON assignments(incident_id);
CREATE INDEX IF NOT EXISTS idx_assignments_responder ON assignments(responder_id);
CREATE INDEX IF NOT EXISTS idx_evac_centers_status ON evac_centers(status);
CREATE INDEX IF NOT EXISTS idx_evac_centers_type ON evac_centers(type);

CREATE INDEX IF NOT EXISTS idx_help_nodes_user ON help_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_help_nodes_location ON help_nodes(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_connection_invites_recipient_status ON connection_invites(recipient_node_id, status);
CREATE INDEX IF NOT EXISTS idx_connection_invites_sender ON connection_invites(sender_node_id);
CREATE INDEX IF NOT EXISTS idx_conversations_invite ON conversations(invite_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
