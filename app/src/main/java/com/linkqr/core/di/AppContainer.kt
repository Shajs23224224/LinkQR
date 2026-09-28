package com.linkqr.core.di

import android.content.Context
import androidx.room.Room
import com.linkqr.data.local.LinkQrDatabase
import com.linkqr.data.local.LinkQrDatabaseMigrations
import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.repository.QrHistoryRepository

class AppContainer(context: Context) {

    private val database: LinkQrDatabase = Room.databaseBuilder(
        context,
        LinkQrDatabase::class.java,
        "linkqr.db"
    )
        .addMigrations(
            LinkQrDatabaseMigrations.MIGRATION_1_2,
            LinkQrDatabaseMigrations.MIGRATION_2_3
        )
        .build()

    val qrRecordDao: QrRecordDao = database.qrRecordDao()

    val qrHistoryRepository: QrHistoryRepository =
        QrHistoryRepository(qrRecordDao)
}
