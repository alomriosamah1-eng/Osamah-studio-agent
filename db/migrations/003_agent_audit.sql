-- Osamah Studio Agent — migration 003
-- Apply inside one transaction. Do not edit after publication.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS agent_audit_records (
  id TEXT PRIMARY KEY NOT NULL,
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('filesystem.read','filesystem.write','terminal.exec','git.commit','github.push','mcp.tool','browser.submit','media.publish','provider.invoke')),
  risk TEXT NOT NULL CHECK (risk IN ('low','medium','high','critical')),
  decision TEXT NOT NULL CHECK (decision IN ('allowed','approval_required','approved','denied')),
  approval_id TEXT,
  scope TEXT NOT NULL,
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_time ON agent_audit_records(occurred_at, id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_correlation ON agent_audit_records(correlation_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_agent_audit_session ON agent_audit_records(session_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_agent_audit_approval ON agent_audit_records(approval_id, occurred_at);

INSERT INTO schema_meta(key, value, updated_at)
VALUES ('schema_version', '003', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
