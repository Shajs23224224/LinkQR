package com.linkqr.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

object LinkQrDatabaseMigrations {

    val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN foregroundColor INTEGER NOT NULL DEFAULT -16777216"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN backgroundColor INTEGER NOT NULL DEFAULT -1"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN marginModules INTEGER NOT NULL DEFAULT 4"
            )
        }
    }

    val MIGRATION_2_3 = object : Migration(2, 3) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN remoteRecordId TEXT"
            )
            db.execSQL(
                "CREATE UNIQUE INDEX IF NOT EXISTS index_qr_records_remoteRecordId " +
                    "ON qr_records(remoteRecordId)"
            )
        }
    }

    val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN remoteVersion INTEGER NOT NULL DEFAULT 0"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN deletedAt INTEGER"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN syncDirty INTEGER NOT NULL DEFAULT 1"
            )
            db.execSQL(
                "UPDATE qr_records SET updatedAt = createdAt WHERE updatedAt = 0"
            )
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS index_qr_records_syncDirty ON qr_records(syncDirty)"
            )
        }
    }
}
