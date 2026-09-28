package com.linkqr.data.repository

import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.local.QrRecordEntity
import com.linkqr.domain.model.QrType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
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

        val records = repository.observeAll().collectCurrent()
        assertEquals(1, records.size)
        assertEquals(QrType.URL, records.single().type)
        assertEquals("https://example.com", records.single().payload)
        assertEquals(123L, records.single().createdAt)
        assertTrue(!records.single().isFavorite)
    }

    @Test
    fun favoriteAndDeleteUpdateRepositoryState() = runBlocking {
        val dao = FakeQrRecordDao()
        val repository = QrHistoryRepository(dao)

        val id = repository.save(QrType.TEXT, "Hola", 123L)
        repository.setFavorite(id, true)

        assertEquals(1, repository.observeFavorites().collectCurrent().size)

        repository.delete(id)

        assertTrue(repository.observeAll().collectCurrent().isEmpty())
    }

    private fun Flow<List<com.linkqr.domain.model.QrRecord>>.collectCurrent():
        List<com.linkqr.domain.model.QrRecord> {
        var latest: List<com.linkqr.domain.model.QrRecord> = emptyList()
        val job = kotlinx.coroutines.launch {
            collect { value ->
                latest = value
                kotlinx.coroutines.currentCoroutineContext().cancel()
            }
        }
        job.join()
        return latest
    }

    private class FakeQrRecordDao : QrRecordDao {
        private val state = MutableStateFlow<List<QrRecordEntity>>(emptyList())
        private var nextId = 1L

        override fun observeAll(): Flow<List<QrRecordEntity>> = state

        override fun observeFavorites(): Flow<List<QrRecordEntity>> =
            kotlinx.coroutines.flow.flowOf(
                state.value.filter { it.isFavorite }
            )

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
