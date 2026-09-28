package com.linkqr.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface QrRecordDao {

    @Query("SELECT * FROM qr_records WHERE deletedAt IS NULL ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<QrRecordEntity>>

    @Query("SELECT * FROM qr_records WHERE deletedAt IS NULL AND isFavorite = 1 ORDER BY createdAt DESC")
    fun observeFavorites(): Flow<List<QrRecordEntity>>

    @Query("SELECT * FROM qr_records WHERE syncStatus = 'PENDING' ORDER BY updatedAt ASC")
    suspend fun getPendingSync(): List<QrRecordEntity>

    @Query("SELECT * FROM qr_records WHERE syncId = :syncId LIMIT 1")
    suspend fun findBySyncId(syncId: String): QrRecordEntity?

    @Query("UPDATE qr_records SET syncId = :syncId WHERE id = :id")
    suspend fun updateSyncId(id: Long, syncId: String)

    @Query("UPDATE qr_records SET deviceId = :deviceId WHERE id = :id")
    suspend fun updateDeviceId(id: Long, deviceId: String)

    @Query(
        "UPDATE qr_records SET syncStatus = :status WHERE syncId = :syncId"
    )
    suspend fun updateSyncStatus(syncId: String, status: String)

    @Insert
    suspend fun insert(record: QrRecordEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(record: QrRecordEntity): Long

    @Query("""
        UPDATE qr_records
        SET isFavorite = :favorite,
            updatedAt = :updatedAt,
            version = version + 1,
            deviceId = :deviceId,
            syncStatus = 'PENDING'
        WHERE id = :id AND deletedAt IS NULL
    """)
    suspend fun updateFavorite(id: Long, favorite: Boolean, updatedAt: Long, deviceId: String)

    @Query("""
        UPDATE qr_records
        SET deletedAt = :deletedAt,
            updatedAt = :updatedAt,
            version = version + 1,
            deviceId = :deviceId,
            syncStatus = 'PENDING'
        WHERE id = :id AND deletedAt IS NULL
    """)
    suspend fun markDeleted(id: Long, deletedAt: Long, updatedAt: Long, deviceId: String)

    @Query("""
        UPDATE qr_records
        SET deletedAt = :deletedAt,
            updatedAt = :updatedAt,
            version = version + 1,
            deviceId = :deviceId,
            syncStatus = 'PENDING'
        WHERE deletedAt IS NULL
    """)
    suspend fun markAllDeleted(deletedAt: Long, updatedAt: Long, deviceId: String)
}
