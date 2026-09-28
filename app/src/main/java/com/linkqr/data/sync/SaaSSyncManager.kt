package com.linkqr.data.sync

import android.content.Context
import com.linkqr.BuildConfig
import com.linkqr.auth.AuthTokenStore
import com.linkqr.data.repository.QrHistoryRepository

class SaaSSyncManager(
    context: Context,
    private val repository: QrHistoryRepository
) {
    private val tokenStore = AuthTokenStore(context)
    private val workspaceApi = SaaSWorkspaceApi()

    suspend fun sync(): SyncResult? {
        val token = tokenStore.get() ?: return null
        val workspace = workspaceApi.firstOrCreate(token)
        val client = SaaSSyncClient(
            baseUrl = BuildConfig.SAAS_BASE_URL,
            bearerToken = token,
            workspaceId = workspace.id
        )
        return QrSyncEngine(
            repository = repository,
            client = client,
            workspaceId = workspace.id
        ).sync()
    }
}
