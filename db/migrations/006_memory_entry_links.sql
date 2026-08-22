-- Apply inside one transaction. Do not edit after publication.
PRAGMA foreign_keys = ON;
ALTER TABLE memory_entries
  ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(links_json));
INSERT INTO schema_meta(key, value, updated_at)
VALUES ('schema_version', '006', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
