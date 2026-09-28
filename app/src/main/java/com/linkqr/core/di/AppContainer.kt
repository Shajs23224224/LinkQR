package com.linkqr.core.di

import android.content.Context
import androidx.room.Room
import com.linkqr.data.local.LinkQrDatabase
import com.linkqr.data.repository.QrHistoryRepository

class AppContainer(context: Context) {

    private val database: LinkQrDatabase = Room.databaseBuilder(
        context,
        LinkQrDatabase::class.java,
        "linkqr.db"
    ).build()

    val qrHistoryRepository: QrHistoryRepository =
        QrHistoryRepository(database.qrRecordDao())
}
