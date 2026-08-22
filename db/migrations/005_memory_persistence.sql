-- Apply inside one transaction. Do not edit after publication.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS memory_entries (
  entry_id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('note','decision','task','research','learning','idea','summary')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('review_required','confirmed','archived')),
  visibility TEXT NOT NULL CHECK (visibility IN ('private','workspace','project')),
  provider_access TEXT NOT NULL CHECK (provider_access IN ('never','explicit_only')),
  retention TEXT NOT NULL CHECK (retention IN ('session','project','until_deleted')),
  tags_json TEXT NOT NULL CHECK (json_valid(tags_json)),
  provenance_json TEXT NOT NULL CHECK (json_valid(provenance_json)),
  warnings_json TEXT NOT NULL CHECK (json_valid(warnings_json)),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  review_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_entries_state_time ON memory_entries(state, created_at, entry_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_visibility_state ON memory_entries(visibility, state, created_at);

CREATE TABLE IF NOT EXISTS memory_candidates (
  candidate_id TEXT PRIMARY KEY NOT NULL,
  version INTEGER NOT NULL CHECK (version = 1),
  kind TEXT NOT NULL CHECK (kind IN ('summary','fact','decision','procedure','episode')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_entry_ids_json TEXT NOT NULL CHECK (json_valid(source_entry_ids_json)),
  sources_json TEXT NOT NULL CHECK (json_valid(sources_json)),
  scope TEXT NOT NULL,
  importance INTEGER NOT NULL CHECK (importance BETWEEN 1 AND 5),
  expires_at TEXT,
  sensitivity TEXT NOT NULL CHECK (sensitivity IN ('routine','personal','sensitive','secret_shaped')),
  state TEXT NOT NULL CHECK (state IN ('review_required','consolidated','archived')),
  visibility TEXT NOT NULL CHECK (visibility = 'private'),
  provider_access TEXT NOT NULL CHECK (provider_access = 'never'),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  review_reason TEXT,
  blocked_reasons_json TEXT NOT NULL CHECK (json_valid(blocked_reasons_json))
);
CREATE INDEX IF NOT EXISTS idx_memory_candidates_state_time ON memory_candidates(state, created_at, candidate_id);
CREATE INDEX IF NOT EXISTS idx_memory_candidates_scope_state ON memory_candidates(scope, state, created_at);
INSERT INTO schema_meta(key, value, updated_at)
VALUES ('schema_version', '005', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
