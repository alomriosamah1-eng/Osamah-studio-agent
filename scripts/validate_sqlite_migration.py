from pathlib import Path
import sqlite3

migrations_dir = Path(__file__).parents[1] / "db" / "migrations"
migrations = sorted(migrations_dir.glob("[0-9][0-9][0-9]_*.sql"))
expected_migrations = ["001_initial.sql", "002_observability.sql", "003_agent_audit.sql", "004_approval_tickets.sql", "005_memory_persistence.sql"]
if [migration.name for migration in migrations] != expected_migrations:
    raise SystemExit(f"Unexpected migrations: {[migration.name for migration in migrations]!r}")

conn = sqlite3.connect(":memory:")
conn.execute("PRAGMA foreign_keys = ON")
for migration in migrations:
    conn.executescript(migration.read_text(encoding="utf-8"))

required_tables = {
    "schema_meta",
    "workspaces",
    "sessions",
    "approvals",
    "jobs",
    "artifacts",
    "domain_events",
    "device_profiles",
    "preview_sessions",
    "observability_logs",
    "agent_audit_records",
    "approval_tickets",
    "memory_entries",
    "memory_candidates",
}
actual_tables = {
    row[0]
    for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
}
missing = required_tables - actual_tables
if missing:
    raise SystemExit(f"Missing tables: {sorted(missing)}")

schema_version = conn.execute(
    "SELECT value FROM schema_meta WHERE key='schema_version'"
).fetchone()
if schema_version != ("005",):
    raise SystemExit(f"Unexpected schema version: {schema_version!r}")

indexes = {
    row[0]
    for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")
}
required_indexes = {
    "idx_sessions_workspace",
    "idx_approvals_session",
    "idx_events_aggregate",
    "idx_preview_device",
    "idx_observability_time",
    "idx_observability_correlation",
    "idx_agent_audit_time",
    "idx_agent_audit_correlation",
    "idx_agent_audit_session",
    "idx_agent_audit_approval",
    "idx_approval_tickets_pending",
    "idx_approval_tickets_session",
    "idx_memory_entries_state_time",
    "idx_memory_entries_visibility_state",
    "idx_memory_candidates_state_time",
    "idx_memory_candidates_scope_state",
}
missing_indexes = required_indexes - indexes
if missing_indexes:
    raise SystemExit(f"Missing indexes: {sorted(missing_indexes)}")

foreign_keys = conn.execute("PRAGMA foreign_key_check").fetchall()
if foreign_keys:
    raise SystemExit(f"Foreign key violations: {foreign_keys!r}")

print("SQLITE_MIGRATION_VALID=true")
print(f"MIGRATION_COUNT={len(migrations)}")
print(f"SCHEMA_VERSION={schema_version[0]}")
print(f"TABLE_COUNT={len(actual_tables)}")
print(f"INDEX_COUNT={len(indexes)}")
