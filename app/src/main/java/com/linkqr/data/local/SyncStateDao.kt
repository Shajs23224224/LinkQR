package com.linkqr.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface SyncStateDao {

    @Query("SELECT cursor FROM sync_state WHERE workspaceId = :workspaceId LIMIT 1")
    suspend fun getCursor(workspaceId: String): Long?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setCursor(state: SyncStateEntity)

    @Query("DELETE FROM sync_state WHERE workspaceId = :workspaceId")
    suspend fun clear(workspaceId: String)
}
