package com.linkqr.core.di

import android.content.Context
import androidx.room.Room
import com.linkqr.data.local.LinkQrDatabase
import com.linkqr.auth.AuthApiRepository
import com.linkqr.auth.AuthSessionStore
import com.linkqr.data.local.LinkQrDatabaseMigrations
import com.linkqr.data.repository.QrHistoryRepository

class AppContainer(context: Context) {

    private val database: LinkQrDatabase = Room.databaseBuilder(
        context,
        LinkQrDatabase::class.java,
        "linkqr.db"
    )
        .addMigrations(LinkQrDatabaseMigrations.MIGRATION_1_2)
        .build()

    val qrHistoryRepository: QrHistoryRepository =
        QrHistoryRepository(database.qrRecordDao())

    val authSessionStore: AuthSessionStore = AuthSessionStore(context)

    val authRepository: AuthApiRepository =
        AuthApiRepository(authSessionStore)
}
