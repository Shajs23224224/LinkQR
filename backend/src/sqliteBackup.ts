import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";

export type SqliteBackupOptions = {
  sourcePath: string;
  backupDirectory: string;
};

export class SqliteBackupManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly options: SqliteBackupOptions) {}

  async backupNow(now = new Date()): Promise<string> {
    if (this.running) {
      throw new Error("BACKUP_IN_PROGRESS");
    }

    if (this.options.sourcePath === ":memory:") {
      throw new Error("BACKUP_REQUIRES_FILE_DATABASE");
    }

    mkdirSync(this.options.backupDirectory, { recursive: true });

    const source = new Database(this.options.sourcePath, {
      readonly: true,
      fileMustExist: true
    });

    try {
      source.pragma("busy_timeout = 5000");
      const stamp = now.toISOString().replace(/[.:]/g, "-");
      const destination = join(
        this.options.backupDirectory,
        `${basename(this.options.sourcePath)}.${stamp}.bak`
      );

      this.running = true;
      try {
        await source.backup(destination);
      } finally {
        this.running = false;
      }

      return destination;
    } finally {
      source.close();
    }
  }

  start(intervalMs: number, onError: (error: unknown) => void): void {
    if (this.timer || intervalMs <= 0) return;

    this.timer = setInterval(() => {
      void this.backupNow().catch(onError);
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
