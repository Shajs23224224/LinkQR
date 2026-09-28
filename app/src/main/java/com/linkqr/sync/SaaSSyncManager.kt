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
        val conflictsResolved: Int,
        val deletionsSynced: Int,
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
                    conflictsResolved = result.conflictsResolved,
                    deletionsSynced = result.deletionsSynced,
                    workspaceName = result.workspaceName
                )
            }.onFailure { error ->
                _state.value = SaaSSyncState.Error(
                    when (error) {
                        is SaaSApiException ->
                            when (error.statusCode) {
                                401 -> "La sesión ya no es válida. Inicia sesión nuevamente."
                                409 -> when (error.errorCode) {
                                    "WORKSPACE_QUOTA_EXCEEDED" ->
                                        "Se alcanzó el límite de QR del espacio de trabajo."
                                    "SYNC_CONFLICT" ->
                                        "Se detectó un conflicto de sincronización."
                                    else ->
                                        "No se pudo sincronizar con LinkQR."
                                }
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

        var uploaded = 0
        var downloaded = 0
        var conflictsResolved = 0
        var deletionsSynced = 0

        for (local in dao.getPendingSync()) {
            val recordId = local.remoteRecordId ?: "android-" + UUID.randomUUID()

            if (local.remoteRecordId == null) {
                dao.updateRemoteRecordId(local.id, recordId)
            }

            try {
                val result = if (local.deletedAt != null) {
                    api.deleteQrRecord(
                        token = token,
                        workspaceId = workspace.id,
                        record = local.toRemote(recordId),
                        baseVersion = local.remoteVersion
                    )
                } else {
                    api.upsertQrRecord(
                        token = token,
                        workspaceId = workspace.id,
                        record = local.toRemote(recordId),
                        baseVersion = local.remoteVersion
                    )
                }

                dao.markSynced(
                    id = local.id,
                    remoteRecordId = recordId,
                    remoteVersion = result.version,
                    updatedAt = result.updatedAt,
                    deletedAt = result.deletedAtOrNull()
                )
                uploaded++
                if (result.deleted) deletionsSynced++
            } catch (error: SaaSApiException) {
                val conflict = api.parseSyncConflict(error)
                if (conflict == null) throw error

                applyRemote(local, conflict)
                conflictsResolved++
                if (conflict.deleted) deletionsSynced++
            }
        }

        for (remote in api.listQrSyncRecords(token, workspace.id)) {
            val local = dao.findByRemoteRecordId(remote.recordId)

            if (local == null) {
                if (!remote.deleted) {
                    dao.insert(remote.toEntity())
                    downloaded++
                }
                continue
            }

            if (remote.version > local.remoteVersion) {
                applyRemote(local, remote)
                downloaded++
                if (remote.deleted) deletionsSynced++
            }
        }

        return SyncResult(
            uploaded = uploaded,
            downloaded = downloaded,
            conflictsResolved = conflictsResolved,
            deletionsSynced = deletionsSynced,
            workspaceName = workspace.name
        )
    }

    private suspend fun applyRemote(
        local: QrRecordEntity,
        remote: SaaSSyncRecord
    ) {
        dao.updateFromRemote(
            id = local.id,
            type = remote.type,
            payload = remote.payload,
            createdAt = remote.createdAt,
            isFavorite = remote.isFavorite,
            foregroundColor = remote.foregroundColor.toArgbLong(),
            backgroundColor = remote.backgroundColor.toArgbLong(),
            marginModules = remote.marginModules,
            remoteRecordId = remote.recordId,
            remoteVersion = remote.version,
            updatedAt = remote.updatedAt,
            deletedAt = remote.deletedAtOrNull()
        )
    }

    private fun QrRecordEntity.toRemote(recordId: String): SaaSSyncRecord =
        SaaSSyncRecord(
            recordId = recordId,
            type = type,
            payload = payload,
            createdAt = createdAt,
            isFavorite = isFavorite,
            foregroundColor = foregroundColor.toHex(),
            backgroundColor = backgroundColor.toHex(),
            marginModules = marginModules,
            version = remoteVersion,
            updatedAt = updatedAt,
            deleted = deletedAt != null
        )

    private fun SaaSSyncRecord.toEntity(): QrRecordEntity =
        QrRecordEntity(
            type = type,
            payload = payload,
            createdAt = createdAt,
            isFavorite = isFavorite,
            foregroundColor = foregroundColor.toArgbLong(),
            backgroundColor = backgroundColor.toArgbLong(),
            marginModules = marginModules,
            remoteRecordId = recordId,
            remoteVersion = version,
            updatedAt = updatedAt,
            deletedAt = deletedAtOrNull(),
            syncDirty = false
        )

    private fun SaaSSyncRecord.deletedAtOrNull(): Long? =
        if (deleted) updatedAt else null

    private data class SyncResult(
        val uploaded: Int,
        val downloaded: Int,
        val conflictsResolved: Int,
        val deletionsSynced: Int,
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
