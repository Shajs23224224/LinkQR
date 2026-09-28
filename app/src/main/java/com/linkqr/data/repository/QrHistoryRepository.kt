package com.linkqr.data.repository

import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.local.QrRecordEntity
import com.linkqr.domain.model.QrRecord
import com.linkqr.domain.model.QrType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class QrHistoryRepository(
    private val dao: QrRecordDao
) {

    fun observeAll(): Flow<List<QrRecord>> =
        dao.observeAll().map { records -> records.map(::toDomain) }

    fun observeFavorites(): Flow<List<QrRecord>> =
        dao.observeFavorites().map { records -> records.map(::toDomain) }

    suspend fun save(
        type: QrType,
        payload: String,
        createdAt: Long = System.currentTimeMillis()
    ): Long {
        return dao.insert(
            QrRecordEntity(
                type = type.name,
                payload = payload,
                createdAt = createdAt,
                isFavorite = false
            )
        )
    }

    suspend fun setFavorite(id: Long, favorite: Boolean) {
        dao.updateFavorite(id, favorite)
    }

    suspend fun delete(id: Long) {
        dao.deleteById(id)
    }

    suspend fun deleteAll() {
        dao.deleteAll()
    }

    private fun toDomain(entity: QrRecordEntity): QrRecord =
        QrRecord(
            id = entity.id,
            type = runCatching { QrType.valueOf(entity.type) }
                .getOrDefault(QrType.TEXT),
            payload = entity.payload,
            createdAt = entity.createdAt,
            isFavorite = entity.isFavorite
        )
}
