package com.linkqr.sync

import com.linkqr.auth.AuthTokenStore
import com.linkqr.data.local.QrRecordDao
import com.linkqr.data.local.QrRecordEntity
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SaaSSyncState {
    data object Idle : SaaSSyncState
    data object Syncing : SaaSSyncState
    data class Success(
        val uploaded: Int,
        val downloaded: Int,
        val workspaceName: String
    ) : SaaSSyncState
    data class Error(val message: String) : SaaSSyncState
}

class SaaSSyncManager(
    private val api: SaaSApi,
    private val tokenStore: AuthTokenStore,
    private val dao: QrRecordDao
) {
    private val scope = CoroutineScope(
        SupervisorJob() + Dispatchers.IO
    )

    private val _state = MutableStateFlow<SaaSSyncState>(SaaSSyncState.Idle)
    val state: StateFlow<SaaSSyncState> = _state.asStateFlow()

    fun sync() {
        if (_state.value is SaaSSyncState.Syncing) return

        scope.launch {
            _state.value = SaaSSyncState.Syncing

            val token = tokenStore.get()
            if (token == null) {
                _state.value = SaaSSyncState.Error(
                    "Inicia sesión para sincronizar tus códigos QR."
                )
                return@launch
            }

            runCatching {
                performSync(token)
            }.onSuccess { result ->
                _state.value = SaaSSyncState.Success(
                    uploaded = result.uploaded,
                    downloaded = result.downloaded,
                    workspaceName = result.workspaceName
                )
            }.onFailure { error ->
                _state.value = SaaSSyncState.Error(
                    when (error) {
                        is SaaSApiException ->
                            when (error.statusCode) {
                                401 -> "La sesión ya no es válida. Inicia sesión nuevamente."
                                409 -> "Se alcanzó el límite de QR del espacio de trabajo."
                                else -> "No se pudo sincronizar con LinkQR."
                            }
                        else -> "No se pudo sincronizar. Comprueba tu conexión."
                    }
                )
            }
        }
    }

    fun close() {
        scope.cancel()
    }

    private suspend fun performSync(token: String): SyncResult {
        val workspace = api.listWorkspaces(token).firstOrNull()
            ?: api.createWorkspace(token, "Mi LinkQR")

        val localRecords = dao.getAll()
        var uploaded = 0

        for (record in localRecords) {
            val remoteId = record.remoteRecordId ?: "android-${UUID.randomUUID()}"

            if (record.remoteRecordId == null) {
                dao.updateRemoteRecordId(record.id, remoteId)
            }

            api.upsertQrRecord(
                token = token,
                workspaceId = workspace.id,
                record = record.toRemote(remoteId)
            )
            uploaded++
        }

        val remoteRecords = api.listQrRecords(
            token = token,
            workspaceId = workspace.id
        )

        var downloaded = 0

        for (remote in remoteRecords) {
            val existing = dao.findByRemoteRecordId(remote.recordId)

            if (existing == null) {
                dao.insert(remote.toEntity())
                downloaded++
            } else {
                dao.updateFromRemote(
                    id = existing.id,
                    type = remote.type,
                    payload = remote.payload,
                    createdAt = remote.createdAt,
                    isFavorite = remote.isFavorite,
                    foregroundColor = remote.foregroundColor.toArgbLong(),
                    backgroundColor = remote.backgroundColor.toArgbLong(),
                    marginModules = remote.marginModules
                )
            }
        }

        return SyncResult(
            uploaded = uploaded,
            downloaded = downloaded,
            workspaceName = workspace.name
        )
    }

    private fun QrRecordEntity.toRemote(remoteId: String): SaaSQrRecord =
        SaaSQrRecord(
            recordId = remoteId,
            type = type,
            payload = payload,
            createdAt = createdAt,
            isFavorite = isFavorite,
            foregroundColor = foregroundColor.toHex(),
            backgroundColor = backgroundColor.toHex(),
            marginModules = marginModules
        )

    private fun SaaSQrRecord.toEntity(): QrRecordEntity =
        QrRecordEntity(
            type = type,
            payload = payload,
            createdAt = createdAt,
            isFavorite = isFavorite,
            foregroundColor = foregroundColor.toArgbLong(),
            backgroundColor = backgroundColor.toArgbLong(),
            marginModules = marginModules,
            remoteRecordId = recordId
        )

    private data class SyncResult(
        val uploaded: Int,
        val downloaded: Int,
        val workspaceName: String
    )
}

private fun Long.toHex(): String =
    "#%06X".format(this.toInt() and 0xFFFFFF)

private fun String.toArgbLong(): Long =
    runCatching {
        val rgb = removePrefix("#").toLong(16)
        0xFF000000L or rgb
    }.getOrDefault(0xFF000000L)
