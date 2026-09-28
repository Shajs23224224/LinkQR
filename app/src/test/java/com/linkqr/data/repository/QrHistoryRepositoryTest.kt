package com.linkqr.data.repository

import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.local.QrRecordEntity
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
        val repository = QrHistoryRepository(dao)

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
        assertTrue(!records.single().isFavorite)
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
    fun favoriteAndDeleteUpdateRepositoryState() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao)

        val id = repository.save(QrType.TEXT, "Hola", 123L)
        repository.setFavorite(id, true)

        assertEquals(1, repository.observeFavorites().first().size)

        repository.delete(id)

        assertTrue(repository.observeAll().first().isEmpty())
    }

    @Test
    fun deleteAllClearsHistoryAndFavorites() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao)

        val firstId = repository.save(QrType.URL, "https://example.com", 1L)
        val secondId = repository.save(QrType.TEXT, "Hola", 2L)
        repository.setFavorite(firstId, true)
        repository.setFavorite(secondId, true)

        repository.deleteAll()

        assertTrue(repository.observeAll().first().isEmpty())
        assertTrue(repository.observeFavorites().first().isEmpty())
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

        override fun observeAll(): Flow<List<QrRecordEntity>> = state

        override fun observeFavorites(): Flow<List<QrRecordEntity>> =
            state.map { records -> records.filter { it.isFavorite } }

        override suspend fun insert(record: QrRecordEntity): Long {
            val stored = record.copy(id = nextId++)
            state.value = state.value + stored
            return stored.id
        }

        override suspend fun updateFavorite(id: Long, favorite: Boolean) {
            state.value = state.value.map {
                if (it.id == id) it.copy(isFavorite = favorite) else it
            }
        }

        override suspend fun deleteById(id: Long) {
            state.value = state.value.filterNot { it.id == id }
        }

        override suspend fun deleteAll() {
            state.value = emptyList()
        }
    }
}
