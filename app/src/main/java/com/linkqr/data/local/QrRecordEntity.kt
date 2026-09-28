package com.linkqr.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "qr_records",
    indices = [
        Index(value = ["createdAt"]),
        Index(value = ["syncStatus"]),
        Index(value = ["syncId"], unique = true)
    ]
)
data class QrRecordEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val type: String,
    val payload: String,
    val createdAt: Long,
    val updatedAt: Long = createdAt,
    val isFavorite: Boolean = false,
    val foregroundColor: Long = 0xFF000000,
    val backgroundColor: Long = 0xFFFFFFFF,
    val marginModules: Int = 4,
    val syncId: String? = null,
    val syncStatus: String = "PENDING",
    val version: Long = 1,
    val deviceId: String = "",
    val deletedAt: Long? = null
)
