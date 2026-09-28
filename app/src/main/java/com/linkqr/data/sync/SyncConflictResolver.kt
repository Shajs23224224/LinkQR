package com.linkqr.data.sync

data class SyncVersion(
    val version: Long,
    val updatedAt: Long,
    val deviceId: String
)

object SyncConflictResolver {
    fun compare(left: SyncVersion, right: SyncVersion): Int {
        compareValues(left.version, right.version).takeIf { it != 0 }?.let { return it }
        compareValues(left.updatedAt, right.updatedAt).takeIf { it != 0 }?.let { return it }
        return left.deviceId.compareTo(right.deviceId)
    }

    fun preferLocal(local: SyncVersion, remote: SyncVersion): Boolean =
        compare(local, remote) >= 0
}
