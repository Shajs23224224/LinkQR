package com.linkqr.data.repository

import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.local.QrRecordEntity
import com.linkqr.data.sync.CloudQrRecord
import com.linkqr.domain.model.QrDesign
import com.linkqr.domain.model.QrType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QrHistoryRepositoryTest {

    @Test
    fun saveCreatesExpectedRecord() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao, "device-a")

        val id = repository.save(
            type = QrType.URL,
            payload = "https://example.com",
            createdAt = 123L
        )

        assertEquals(1L, id)

        val records = repository.observeAll().first()
        assertEquals(1, records.size)
        assertEquals(QrType.URL, records.single().type)
        assertEquals("https://example.com", records.single().payload)
        assertEquals(123L, records.single().createdAt)
        assertTrue(records.single().id > 0)
        assertTrue(!records.single().isFavorite)

        val pending = repository.pendingSyncRecords().single()
        assertEquals("device-a", pending.deviceId)
        assertEquals(1L, pending.version)
        assertEquals("PENDING", pending.syncStatus)
    }

    @Test
    fun savesAndRestoresCustomDesign() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao)
        val design = QrDesign(
            foregroundColor = 0xFF123456L,
            backgroundColor = 0xFFFFFFFFL,
            marginModules = 6
        )

        repository.save(
            type = QrType.TEXT,
            payload = "Hola",
            createdAt = 456L,
            design = design
        )

        val record = repository.observeAll().first().single()
        assertEquals(design, record.design)
    }

    @Test
    fun deleteCreatesTombstoneAndHidesRecord() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao, "device-b")

        val id = repository.save(QrType.TEXT, "Hola", 123L)
        dao.updateDeviceId(id, "device-a")
        repository.delete(id)

        assertTrue(repository.observeAll().first().isEmpty())

        val pending = repository.pendingSyncRecords().single()
        assertTrue(pending.deletedAt != null)
        assertEquals(2L, pending.version)
        assertEquals("device-b", pending.deviceId)
        assertEquals("PENDING", pending.syncStatus)
    }

    @Test
    fun deleteAllCreatesTombstonesForAllRecords() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao)

        repository.save(QrType.URL, "https://example.com", 1L)
        repository.save(QrType.TEXT, "Hola", 2L)

        repository.deleteAll()

        assertTrue(repository.observeAll().first().isEmpty())
        assertEquals(2, repository.pendingSyncRecords().size)
        assertTrue(repository.pendingSyncRecords().all { it.deletedAt != null })
    }

    @Test
    fun remoteHigherVersionWinsAndCanCarryTombstone() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao, "device-a")
        repository.save(QrType.TEXT, "local", 100L)

        val local = repository.pendingSyncRecords().single()
        val remote = CloudQrRecord(
            workspaceId = "workspace",
            recordId = requireNotNull(local.syncId),
            type = "TEXT",
            payload = "remote",
            createdAt = 100L,
            updatedAt = 200L,
            isFavorite = false,
            foregroundColor = "#000000",
            backgroundColor = "#FFFFFF",
            marginModules = 4,
            version = 2L,
            deviceId = "device-b",
            deleted = true,
            deletedAt = 200L
        )

        assertTrue(repository.applyRemote(remote))
        assertTrue(repository.observeAll().first().isEmpty())

        val stored = repository.pendingSyncRecords().single()
        assertEquals(2L, stored.version)
        assertEquals("SYNCED", stored.syncStatus)
        assertEquals(remote.deletedAt, stored.deletedAt)
    }

    @Test
    fun unknownPersistedTypeFallsBackToText() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao)

        dao.insert(
            QrRecordEntity(
                id = 0L,
                type = "UNKNOWN_TYPE",
                payload = "legacy",
                createdAt = 123L,
                isFavorite = false
            )
        )

        assertEquals(QrType.TEXT, repository.observeAll().first().single().type)
    }

    private class FakeQrRecordDao : QrRecordDao {
        private val state = MutableStateFlow<List<QrRecordEntity>>(emptyList())
        private var nextId = 1L

        override fun observeAll(): Flow<List<QrRecordEntity>> =
            state.map { records -> records.filter { it.deletedAt == null }.sortedByDescending { it.createdAt } }

        override fun observeFavorites(): Flow<List<QrRecordEntity>> =
            state.map { records ->
                records.filter { it.deletedAt == null && it.isFavorite }.sortedByDescending { it.createdAt }
            }

        override suspend fun insert(record: QrRecordEntity): Long {
            val stored = record.copy(id = nextId++)
            state.value = state.value + stored
            return stored.id
        }

        override suspend fun upsert(record: QrRecordEntity): Long {
            val stored = if (record.id == 0L) record.copy(id = nextId++) else record
            state.value = state.value.filterNot { it.id == stored.id || (stored.syncId != null && it.syncId == stored.syncId) } + stored
            return stored.id
        }

        override suspend fun getPendingSync(): List<QrRecordEntity> =
            state.value.filter { it.syncStatus == "PENDING" }.sortedBy { it.updatedAt }

        override suspend fun findBySyncId(syncId: String): QrRecordEntity? =
            state.value.firstOrNull { it.syncId == syncId }

        override suspend fun updateSyncId(id: Long, syncId: String) {
            state.value = state.value.map { if (it.id == id) it.copy(syncId = syncId) else it }
        }

        override suspend fun updateDeviceId(id: Long, deviceId: String) {
            state.value = state.value.map { if (it.id == id) it.copy(deviceId = deviceId) else it }
        }

        override suspend fun updateSyncStatus(syncId: String, status: String) {
            state.value = state.value.map {
                if (it.syncId == syncId) it.copy(syncStatus = status) else it
            }
        }

        override suspend fun updateFavorite(id: Long, favorite: Boolean, updatedAt: Long, deviceId: String) {
            state.value = state.value.map {
                if (it.id == id && it.deletedAt == null) {
                    it.copy(
                        isFavorite = favorite,
                        updatedAt = updatedAt,
                        version = it.version + 1,
                        deviceId = deviceId,
                        syncStatus = "PENDING"
                    )
                } else {
                    it
                }
            }
        }

        override suspend fun markDeleted(id: Long, deletedAt: Long, updatedAt: Long, deviceId: String) {
            state.value = state.value.map {
                if (it.id == id && it.deletedAt == null) {
                    it.copy(
                        deletedAt = deletedAt,
                        updatedAt = updatedAt,
                        version = it.version + 1,
                        deviceId = deviceId,
                        syncStatus = "PENDING"
                    )
                } else {
                    it
                }
            }
        }

        override suspend fun markAllDeleted(deletedAt: Long, updatedAt: Long, deviceId: String) {
            state.value = state.value.map {
                if (it.deletedAt == null) {
                    it.copy(
                        deletedAt = deletedAt,
                        updatedAt = updatedAt,
                        version = it.version + 1,
                        deviceId = deviceId,
                        syncStatus = "PENDING"
                    )
                } else {
                    it
                }
            }
        }
    }
}
