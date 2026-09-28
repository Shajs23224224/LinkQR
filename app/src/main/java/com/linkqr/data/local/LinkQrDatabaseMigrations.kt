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
                "ALTER TABLE qr_records ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN syncId TEXT"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN syncStatus TEXT NOT NULL DEFAULT 'PENDING'"
            )
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS index_qr_records_syncStatus ON qr_records(syncStatus)"
            )
            db.execSQL(
                "UPDATE qr_records SET updatedAt = createdAt WHERE updatedAt = 0"
            )
        }
    }
 
    val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN version INTEGER NOT NULL DEFAULT 1"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN deviceId TEXT NOT NULL DEFAULT ''"
            )
            db.execSQL(
                "ALTER TABLE qr_records ADD COLUMN deletedAt INTEGER"
            )
            db.execSQL(
                "CREATE UNIQUE INDEX IF NOT EXISTS index_qr_records_syncId ON qr_records(syncId)"
            )
        }
    }

}
