package com.linkqr.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [QrRecordEntity::class],
    version = 2,
    exportSchema = false
)
abstract class LinkQrDatabase : RoomDatabase() {
    abstract fun qrRecordDao(): QrRecordDao
}
