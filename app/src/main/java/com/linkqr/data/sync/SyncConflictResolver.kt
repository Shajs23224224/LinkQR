package com.linkqr.data.sync

data class SyncVersion(
    val version: Long,
    val updatedAt: Long,
    val deviceId: String
)

object SyncConflictResolver {

    /**
     * Deterministic ordering shared with the SaaS backend:
     * revision first, then device identity, then timestamp only for
     * otherwise identical versions from the same device.
     */
    fun compare(left: SyncVersion, right: SyncVersion): Int {
        compareValues(left.version, right.version).takeIf { it != 0 }?.let { return it }
        left.deviceId.compareTo(right.deviceId).takeIf { it != 0 }?.let { return it }
        return compareValues(left.updatedAt, right.updatedAt)
    }

    fun preferLocal(local: SyncVersion, remote: SyncVersion): Boolean =
        compare(local, remote) >= 0
}
