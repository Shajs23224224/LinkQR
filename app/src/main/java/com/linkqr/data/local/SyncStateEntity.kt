package com.linkqr.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey
    val workspaceId: String,
    val cursor: Long = 0L
)
