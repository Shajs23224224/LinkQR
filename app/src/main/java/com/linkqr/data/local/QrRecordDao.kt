package com.linkqr.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface QrRecordDao {

    @Query("SELECT * FROM qr_records ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<QrRecordEntity>>

    @Query("SELECT * FROM qr_records WHERE isFavorite = 1 ORDER BY createdAt DESC")
    fun observeFavorites(): Flow<List<QrRecordEntity>>

    @Query("SELECT * FROM qr_records ORDER BY createdAt DESC")
    suspend fun getAll(): List<QrRecordEntity>

    @Query("SELECT * FROM qr_records WHERE remoteRecordId = :remoteRecordId LIMIT 1")
    suspend fun findByRemoteRecordId(remoteRecordId: String): QrRecordEntity?

    @Insert
    suspend fun insert(record: QrRecordEntity): Long

    @Query("UPDATE qr_records SET isFavorite = :favorite WHERE id = :id")
    suspend fun updateFavorite(id: Long, favorite: Boolean)

    @Query("UPDATE qr_records SET remoteRecordId = :remoteRecordId WHERE id = :id")
    suspend fun updateRemoteRecordId(id: Long, remoteRecordId: String)

    @Query("""
        UPDATE qr_records
        SET type = :type,
            payload = :payload,
            createdAt = :createdAt,
            isFavorite = :isFavorite,
            foregroundColor = :foregroundColor,
            backgroundColor = :backgroundColor,
            marginModules = :marginModules
        WHERE id = :id
    """)
    suspend fun updateFromRemote(
        id: Long,
        type: String,
        payload: String,
        createdAt: Long,
        isFavorite: Boolean,
        foregroundColor: Long,
        backgroundColor: Long,
        marginModules: Int
    )

    @Query("DELETE FROM qr_records WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM qr_records")
    suspend fun deleteAll()
}
