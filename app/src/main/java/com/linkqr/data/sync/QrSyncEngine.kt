package com.linkqr.data.sync

import com.linkqr.data.repository.QrHistoryRepository

class QrSyncEngine(
    private val repository: QrHistoryRepository,
    private val client: SaaSSyncClient
) {
    suspend fun sync(): SyncResult {
        var pushed = 0
        var conflicts = 0

        repository.pendingSyncRecords().forEach { local ->
            val result = client.push(repository.toCloudRecord(local))
            val applied = repository.applyRemote(result.record)
            if (result.conflict) conflicts++
            if (applied) pushed++
        }

        var pulled = 0
        client.pull().forEach { remote ->
            if (repository.applyRemote(remote)) pulled++
        }

        return SyncResult(pushed, pulled, conflicts)
    }
}

data class SyncResult(
    val pushed: Int,
    val pulled: Int,
    val conflicts: Int
)
