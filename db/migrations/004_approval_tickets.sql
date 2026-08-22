-- Apply inside one transaction. Do not edit after publication.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS approval_tickets (
  approval_id TEXT PRIMARY KEY NOT NULL,
  correlation_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('filesystem.read','filesystem.write','terminal.exec','git.commit','github.push','mcp.tool','browser.submit','media.publish','provider.invoke')),
  risk TEXT NOT NULL CHECK (risk IN ('low','medium','high','critical')),
  scope TEXT NOT NULL,
  idempotency_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('requested','approved','denied')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_approval_tickets_pending ON approval_tickets(status, created_at, approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_tickets_session ON approval_tickets(session_id, created_at);

INSERT INTO schema_meta(key, value, updated_at)
VALUES ('schema_version', '004', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;

