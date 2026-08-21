-- Osamah Studio Agent — migration 001
-- Apply inside one transaction. Do not edit after publication.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('created','running','waiting_approval','paused','completed','failed','cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('low','medium','high','critical')),
  scope TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','approved','denied','expired','revoked')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  path TEXT,
  hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domain_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_approvals_session ON approvals(session_id);
CREATE INDEX IF NOT EXISTS idx_events_aggregate ON domain_events(aggregate_id, occurred_at);

INSERT INTO schema_meta(key, value, updated_at)
VALUES ('schema_version', '001', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
