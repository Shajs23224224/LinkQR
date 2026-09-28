package com.linkqr.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "qr_records",
    indices = [Index(value = ["createdAt"])]
)
data class QrRecordEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val type: String,
    val payload: String,
    val createdAt: Long,
    val isFavorite: Boolean = false
)
