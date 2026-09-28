package com.linkqr.data.repository

import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.local.QrRecordEntity
import com.linkqr.domain.model.QrDesign
import com.linkqr.domain.model.QrRecord
import com.linkqr.domain.model.QrType
import java.util.UUID
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

class QrHistoryRepository(
    private val dao: QrRecordDao
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
                syncStatus = "PENDING"
            )
        )
    }

    suspend fun setFavorite(id: Long, favorite: Boolean) {
        dao.updateFavorite(id, favorite, System.currentTimeMillis())
    }

    suspend fun delete(id: Long) {
        // Hard deletion remains local until the later tombstone phase.
        dao.deleteById(id)
    }

    suspend fun deleteAll() {
        // Cloud deletion propagation requires tombstones and is intentionally deferred.
        dao.deleteAll()
    }

    suspend fun pendingSyncRecords(): List<QrRecordEntity> {
        val pending = dao.getPendingSync()
        return pending.map { record ->
            if (record.syncId != null) {
                record
            } else {
                val syncId = UUID.randomUUID().toString()
                dao.updateSyncId(record.id, syncId)
                record.copy(syncId = syncId)
            }
        }
    }

    suspend fun markSynced(syncId: String) {
        dao.updateSyncStatus(syncId, "SYNCED")
    }

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
