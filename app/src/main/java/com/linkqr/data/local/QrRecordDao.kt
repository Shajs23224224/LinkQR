package com.linkqr.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface QrRecordDao {

    @Query("SELECT * FROM qr_records WHERE deletedAt IS NULL ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<QrRecordEntity>>

    @Query("SELECT * FROM qr_records WHERE deletedAt IS NULL AND isFavorite = 1 ORDER BY createdAt DESC")
    fun observeFavorites(): Flow<List<QrRecordEntity>>

    @Query("SELECT * FROM qr_records WHERE syncDirty = 1 ORDER BY updatedAt ASC")
    suspend fun getPendingSync(): List<QrRecordEntity>

    @Query("SELECT * FROM qr_records ORDER BY updatedAt ASC")
    suspend fun getAllForSync(): List<QrRecordEntity>

    @Query("SELECT * FROM qr_records WHERE remoteRecordId = :remoteRecordId LIMIT 1")
    suspend fun findByRemoteRecordId(remoteRecordId: String): QrRecordEntity?

    @Insert
    suspend fun insert(record: QrRecordEntity): Long

    @Query("""
        UPDATE qr_records
        SET isFavorite = :favorite,
            updatedAt = :updatedAt,
            syncDirty = 1
        WHERE id = :id AND deletedAt IS NULL
    """)
    suspend fun updateFavorite(
        id: Long,
        favorite: Boolean,
        updatedAt: Long
    )

    @Query("""
        UPDATE qr_records
        SET remoteRecordId = :remoteRecordId
        WHERE id = :id
    """)
    suspend fun updateRemoteRecordId(id: Long, remoteRecordId: String)

    @Query("""
        UPDATE qr_records
        SET remoteRecordId = :remoteRecordId,
            remoteVersion = :remoteVersion,
            updatedAt = :updatedAt,
            deletedAt = :deletedAt,
            syncDirty = 0
        WHERE id = :id
    """)
    suspend fun markSynced(
        id: Long,
        remoteRecordId: String,
        remoteVersion: Long,
        updatedAt: Long,
        deletedAt: Long?
    )

    @Query("""
        UPDATE qr_records
        SET type = :type,
            payload = :payload,
            createdAt = :createdAt,
            isFavorite = :isFavorite,
            foregroundColor = :foregroundColor,
            backgroundColor = :backgroundColor,
            marginModules = :marginModules,
            remoteRecordId = :remoteRecordId,
            remoteVersion = :remoteVersion,
            updatedAt = :updatedAt,
            deletedAt = :deletedAt,
            syncDirty = 0
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
        marginModules: Int,
        remoteRecordId: String,
        remoteVersion: Long,
        updatedAt: Long,
        deletedAt: Long?
    )

    @Query("""
        UPDATE qr_records
        SET deletedAt = :deletedAt,
            updatedAt = :deletedAt,
            syncDirty = 1
        WHERE id = :id AND remoteRecordId IS NOT NULL
    """)
    suspend fun markDeletedIfSynced(id: Long, deletedAt: Long)

    @Query("""
        DELETE FROM qr_records
        WHERE id = :id AND remoteRecordId IS NULL
    """)
    suspend fun deleteIfUnsynced(id: Long)

    @Query("""
        UPDATE qr_records
        SET deletedAt = :deletedAt,
            updatedAt = :deletedAt,
            syncDirty = 1
        WHERE remoteRecordId IS NOT NULL
    """)
    suspend fun markAllSyncedDeleted(deletedAt: Long)

    @Query("DELETE FROM qr_records WHERE remoteRecordId IS NULL")
    suspend fun deleteAllUnsynced()

    @Query("DELETE FROM qr_records WHERE id = :id")
    suspend fun deletePermanently(id: Long)

    @Query("DELETE FROM qr_records")
    suspend fun deleteAllPermanently()
}
