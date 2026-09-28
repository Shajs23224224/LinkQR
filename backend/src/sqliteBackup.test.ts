import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteBackupManager } from "./sqliteBackup.js";

describe("SQLite backup manager", () => {
  it("creates a consistent online backup that can be reopened", async () => {
    const directory = mkdtempSync(join(tmpdir(), "linkqr-backup-"));
    const sourcePath = join(directory, "linkqr.db");
    const backupDirectory = join(directory, "backups");

    try {
      const source = new Database(sourcePath);
      source.pragma("journal_mode = WAL");
      source.exec("CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
      source.prepare("INSERT INTO sample (value) VALUES (?)").run("ok");

      const manager = new SqliteBackupManager({
        sourcePath,
        backupDirectory
      });

      const backupPath = await manager.backupNow(new Date("2026-01-02T03:04:05.678Z"));

      expect(existsSync(backupPath)).toBe(true);
      expect(readFileSync(backupPath).subarray(0, 16).toString("utf8")).toContain("SQLite format 3");

      const backup = new Database(backupPath, { readonly: true });
      expect(
        backup.prepare("SELECT value FROM sample WHERE id = 1").get()
      ).toEqual({ value: "ok" });

      backup.close();
      source.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects backups for in-memory databases", async () => {
    const manager = new SqliteBackupManager({
      sourcePath: ":memory:",
      backupDirectory: tmpdir()
    });

    await expect(manager.backupNow()).rejects.toThrow("BACKUP_REQUIRES_FILE_DATABASE");
  });
});
