package com.linkqr.data.sync

import com.linkqr.data.repository.QrHistoryRepository

class QrSyncEngine(
    private val repository: QrHistoryRepository,
    private val client: SaaSSyncTransport,
    private val workspaceId: String
) {
    suspend fun sync(): SyncResult {
        var pushed = 0
        var conflicts = 0

        while (true) {
            val pending = repository.pendingSyncRecords(SYNC_BATCH_SIZE)
            if (pending.isEmpty()) break

            pending.forEach { local ->
                val result = client.push(repository.toCloudRecord(local))
                val applied = repository.applyRemote(result.record)

                if (result.conflict) conflicts++
                if (applied) pushed++
            }
        }

        var pulled = 0
        var cursor = repository.getSyncCursor(workspaceId)

        while (true) {
            val page = client.pull(cursor, SYNC_BATCH_SIZE)

            if (page.cursor != cursor) {
                error("Sync cursor mismatch")
            }
            if (page.nextCursor < cursor) {
                error("Sync cursor moved backwards")
            }
            if (page.hasMore && page.nextCursor == cursor) {
                error("Cloud reported more sync data without advancing the cursor")
            }

            pulled += repository.applyRemoteBatch(
                workspaceId = workspaceId,
                remotes = page.records,
                nextCursor = page.nextCursor
            )
            cursor = page.nextCursor

            if (!page.hasMore) break
        }

        return SyncResult(
            pushed = pushed,
            pulled = pulled,
            conflicts = conflicts,
            cursor = cursor
        )
    }

    private companion object {
        const val SYNC_BATCH_SIZE = 50
    }
}

data class SyncResult(
    val pushed: Int,
    val pulled: Int,
    val conflicts: Int,
    val cursor: Long
)
