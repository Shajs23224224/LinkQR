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

    @Query("SELECT * FROM qr_records WHERE syncStatus = 'PENDING' ORDER BY updatedAt ASC")
    suspend fun getPendingSync(): List<QrRecordEntity>

    @Query("UPDATE qr_records SET syncStatus = :status WHERE syncId = :syncId")
    suspend fun updateSyncStatus(syncId: String, status: String)

    @Insert
    suspend fun insert(record: QrRecordEntity): Long

    @Query("""
        UPDATE qr_records
        SET isFavorite = :favorite,
            updatedAt = :updatedAt,
            syncStatus = 'PENDING'
        WHERE id = :id
    """)
    suspend fun updateFavorite(id: Long, favorite: Boolean, updatedAt: Long)

    @Query("DELETE FROM qr_records WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM qr_records")
    suspend fun deleteAll()
}
