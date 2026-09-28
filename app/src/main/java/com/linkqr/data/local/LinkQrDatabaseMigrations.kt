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
}
