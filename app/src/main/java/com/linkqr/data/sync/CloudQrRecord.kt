package com.linkqr.data.sync

data class CloudQrRecord(
    val workspaceId: String,
    val recordId: String,
    val type: String,
    val payload: String,
    val createdAt: Long,
    val updatedAt: Long,
    val isFavorite: Boolean,
    val foregroundColor: String,
    val backgroundColor: String,
    val marginModules: Int,
    val version: Long,
    val deviceId: String,
    val deleted: Boolean,
    val deletedAt: Long?
)
