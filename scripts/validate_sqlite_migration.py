from pathlib import Path
import sqlite3

migration = Path(__file__).parents[1] / "db" / "migrations" / "001_initial.sql"
conn = sqlite3.connect(":memory:")
conn.execute("PRAGMA foreign_keys = ON")
conn.executescript(migration.read_text(encoding="utf-8"))

required_tables = {
    "schema_meta",
    "workspaces",
    "sessions",
    "approvals",
    "jobs",
    "artifacts",
    "domain_events",
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
if schema_version != ("001",):
    raise SystemExit(f"Unexpected schema version: {schema_version!r}")

indexes = {
    row[0]
    for row in conn.execute("SELECT name FROM sqlite_master WHERE type='index'")
}
required_indexes = {"idx_sessions_workspace", "idx_approvals_session", "idx_events_aggregate"}
if required_indexes - indexes:
    raise SystemExit(f"Missing indexes: {sorted(required_indexes - indexes)}")

print("SQLITE_MIGRATION_VALID=true")
print(f"TABLE_COUNT={len(actual_tables)}")
print(f"INDEX_COUNT={len(indexes)}")
