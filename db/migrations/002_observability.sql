-- Osamah Studio Agent — migration 002
-- Apply inside one transaction. Do not edit after publication.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS device_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web','physical')),
  os_version TEXT NOT NULL,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  dpi INTEGER NOT NULL CHECK (dpi > 0),
  safe_area_json TEXT NOT NULL DEFAULT '{}',
  status_bar_height INTEGER NOT NULL DEFAULT 0 CHECK (status_bar_height >= 0),
  navigation_bar_height INTEGER NOT NULL DEFAULT 0 CHECK (navigation_bar_height >= 0),
  orientation TEXT NOT NULL CHECK (orientation IN ('portrait','landscape')),
  theme TEXT NOT NULL CHECK (theme IN ('light','dark')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preview_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  device_profile_id TEXT NOT NULL REFERENCES device_profiles(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL CHECK (mode IN ('lightweight_web','metro','android_emulator','ios_simulator','physical_device')),
  status TEXT NOT NULL CHECK (status IN ('created','starting','ready','refreshing','reloading','stopping','stopped','failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS observability_logs (
  id TEXT PRIMARY KEY NOT NULL,
  occurred_at TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
  event_type TEXT NOT NULL,
  correlation_id TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  result_code TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_preview_device ON preview_sessions(device_profile_id);
CREATE INDEX IF NOT EXISTS idx_observability_time ON observability_logs(occurred_at);
CREATE INDEX IF NOT EXISTS idx_observability_correlation ON observability_logs(correlation_id, occurred_at);

INSERT INTO schema_meta(key, value, updated_at)
VALUES ('schema_version', '002', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;
