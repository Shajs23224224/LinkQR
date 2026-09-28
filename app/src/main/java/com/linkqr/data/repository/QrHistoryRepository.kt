package com.linkqr.data.repository

import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.local.QrRecordEntity
import com.linkqr.data.sync.CloudQrRecord
import com.linkqr.data.sync.SyncConflictResolver
import com.linkqr.data.sync.SyncVersion
import com.linkqr.domain.model.QrDesign
import com.linkqr.domain.model.QrRecord
import com.linkqr.domain.model.QrType
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

class QrHistoryRepository(
    private val dao: QrRecordDao,
    private val deviceId: String = "legacy-device"
) {

    fun observeAll(): Flow<List<QrRecord>> =
        dao.observeAll()
            .map { records -> records.map(::toDomain) }
            .distinctUntilChanged()

    fun observeFavorites(): Flow<List<QrRecord>> =
        dao.observeFavorites()
            .map { records -> records.map(::toDomain) }
            .distinctUntilChanged()

    suspend fun save(
        type: QrType,
        payload: String,
        createdAt: Long = System.currentTimeMillis(),
        design: QrDesign = QrDesign()
    ): Long {
        return dao.insert(
            QrRecordEntity(
                type = type.name,
                payload = payload,
                createdAt = createdAt,
                updatedAt = createdAt,
                isFavorite = false,
                foregroundColor = design.foregroundColor,
                backgroundColor = design.backgroundColor,
                marginModules = design.marginModules,
                syncId = UUID.randomUUID().toString(),
                syncStatus = "PENDING",
                version = 1,
                deviceId = deviceId,
                deletedAt = null
            )
        )
    }

    suspend fun setFavorite(id: Long, favorite: Boolean) {
        dao.updateFavorite(id, favorite, System.currentTimeMillis())
    }

    suspend fun delete(id: Long) {
        val now = System.currentTimeMillis()
        dao.markDeleted(id, deletedAt = now, updatedAt = now)
    }

    suspend fun deleteAll() {
        val now = System.currentTimeMillis()
        dao.markAllDeleted(deletedAt = now, updatedAt = now)
    }

    suspend fun pendingSyncRecords(): List<QrRecordEntity> {
        val pending = dao.getPendingSync()
        return pending.map { record ->
            var normalized = record

            if (normalized.syncId == null) {
                val syncId = UUID.randomUUID().toString()
                dao.updateSyncId(normalized.id, syncId)
                normalized = normalized.copy(syncId = syncId)
            }

            if (normalized.deviceId.isBlank()) {
                dao.updateDeviceId(normalized.id, deviceId)
                normalized = normalized.copy(deviceId = deviceId)
            }

            normalized
        }
    }

    suspend fun markSynced(syncId: String) {
        dao.updateSyncStatus(syncId, "SYNCED")
    }

    suspend fun applyRemote(remote: CloudQrRecord): Boolean {
        val syncId = remote.recordId
        val local = dao.findBySyncId(syncId)

        if (local == null) {
            dao.upsert(remote.toEntity(id = 0L, syncStatus = "SYNCED"))
            return true
        }

        val comparison = SyncConflictResolver.compare(
            SyncVersion(local.version, local.updatedAt, local.deviceId),
            SyncVersion(remote.version, remote.updatedAt, remote.deviceId)
        )

        if (comparison > 0) {
            return false
        }

        dao.upsert(
            remote.toEntity(
                id = local.id,
                syncStatus = "SYNCED"
            )
        )
        return comparison < 0 || local.syncStatus != "SYNCED"
    }

    fun toCloudRecord(entity: QrRecordEntity): CloudQrRecord =
        CloudQrRecord(
            workspaceId = "",
            recordId = requireNotNull(entity.syncId),
            type = entity.type,
            payload = entity.payload,
            createdAt = entity.createdAt,
            updatedAt = entity.updatedAt,
            isFavorite = entity.isFavorite,
            foregroundColor = colorToHex(entity.foregroundColor),
            backgroundColor = colorToHex(entity.backgroundColor),
            marginModules = entity.marginModules,
            version = entity.version,
            deviceId = entity.deviceId,
            deleted = entity.deletedAt != null,
            deletedAt = entity.deletedAt
        )

    private fun CloudQrRecord.toEntity(id: Long, syncStatus: String): QrRecordEntity =
        QrRecordEntity(
            id = id,
            type = type,
            payload = payload,
            createdAt = createdAt,
            updatedAt = updatedAt,
            isFavorite = isFavorite,
            foregroundColor = parseColor(foregroundColor),
            backgroundColor = parseColor(backgroundColor),
            marginModules = marginModules,
            syncId = recordId,
            syncStatus = syncStatus,
            version = version,
            deviceId = deviceId,
            deletedAt = deletedAt.takeIf { deleted } ?: null
        )

    private fun colorToHex(color: Long): String =
        "#%06X".format(Locale.US, color and 0xFFFFFF)

    private fun parseColor(value: String): Long =
        (0xFF000000L or value.removePrefix("#").toLong(16)) 

    private fun toDomain(entity: QrRecordEntity): QrRecord =
        QrRecord(
            id = entity.id,
            type = runCatching { QrType.valueOf(entity.type) }
                .getOrDefault(QrType.TEXT),
            payload = entity.payload,
            createdAt = entity.createdAt,
            isFavorite = entity.isFavorite,
            design = QrDesign(
                foregroundColor = entity.foregroundColor,
                backgroundColor = entity.backgroundColor,
                marginModules = entity.marginModules
            )
        )
}
