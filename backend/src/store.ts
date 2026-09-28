import Database from "better-sqlite3";
import type { PurchaseRepository, PurchaseRecord } from "./repositoryPorts.js";
import { openSqliteDatabase, optimizeSqliteDatabase } from "./sqlite.js";

export type { PurchaseRecord } from "./repositoryPorts.js";

export class PurchaseStore implements PurchaseRepository {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = openSqliteDatabase(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        purchase_token TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        user_id TEXT,
        verified_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_purchases_user_verified
        ON purchases(user_id, verified_at DESC);
    `);
    optimizeSqliteDatabase(this.db);
  }

  hasPurchaseToken(token: string): boolean {
    const row = this.db
      .prepare("SELECT purchase_token FROM purchases WHERE purchase_token = ?")
      .get(token) as { purchase_token?: string } | undefined;
    return row?.purchase_token === token;
  }

  save(record: PurchaseRecord): void {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO purchases
          (purchase_token, product_id, user_id, verified_at)
        VALUES (?, ?, ?, ?)
      `)
      .run(
        record.purchaseToken,
        record.productId,
        record.userId,
        record.verifiedAt
      );
  }

  healthCheck(): void {
    this.db.prepare("SELECT 1").get();
  }

  close(): void {
    this.db.close();
  }
}
