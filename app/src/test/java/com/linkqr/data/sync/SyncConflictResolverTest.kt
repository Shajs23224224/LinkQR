package com.linkqr.data.sync

import org.junit.Assert.assertTrue
import org.junit.Test

class SyncConflictResolverTest {

    @Test
    fun higherRevisionWins() {
        val newer = SyncVersion(version = 3, updatedAt = 1, deviceId = "a")
        val older = SyncVersion(version = 2, updatedAt = 999_999, deviceId = "z")

        assertTrue(SyncConflictResolver.compare(newer, older) > 0)
    }

    @Test
    fun deviceIdentityBreaksConcurrentEqualRevisionDeterministically() {
        val deviceA = SyncVersion(version = 4, updatedAt = 999, deviceId = "device-a")
        val deviceB = SyncVersion(version = 4, updatedAt = 1, deviceId = "device-b")

        assertTrue(SyncConflictResolver.compare(deviceB, deviceA) > 0)
    }

    @Test
    fun timestampOnlyBreaksSameDeviceSameRevision() {
        val old = SyncVersion(version = 5, updatedAt = 100, deviceId = "device-a")
        val newer = SyncVersion(version = 5, updatedAt = 200, deviceId = "device-a")

        assertTrue(SyncConflictResolver.compare(newer, old) > 0)
    }
}
