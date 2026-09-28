import Database from "better-sqlite3";

const DEFAULT_BUSY_TIMEOUT_MS = 5_000;

export function openSqliteDatabase(
  path: string,
  busyTimeoutMs = DEFAULT_BUSY_TIMEOUT_MS
): Database.Database {
  const db = new Database(path);

  if (path !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  db.pragma("foreign_keys = ON");
  db.pragma(`busy_timeout = ${Math.max(0, Math.floor(busyTimeoutMs))}`);
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");

  return db;
}

export function optimizeSqliteDatabase(db: Database.Database): void {
  db.exec("PRAGMA optimize");
}
