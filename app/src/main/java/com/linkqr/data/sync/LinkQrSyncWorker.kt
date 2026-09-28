package com.linkqr.data.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import com.linkqr.auth.AuthTokenStore
import com.linkqr.core.di.AppContainer
import java.io.IOException
import java.util.concurrent.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

enum class SyncExecutionState {
    IDLE,
    RUNNING,
    SUCCESS,
    FAILED,
    AUTH_REQUIRED
}

class LinkQrSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = SyncExecutionGate.mutex.withLock {
        val container = AppContainer(applicationContext)

        try {
            val manager = SaaSSyncManager(
                context = applicationContext,
                repository = container.qrHistoryRepository
            )

            val result = manager.sync()
                ?: return@withLock Result.success(
                    stateData(SyncExecutionState.IDLE)
                )

            Result.success(
                Data.Builder()
                    .putString("state", SyncExecutionState.SUCCESS.name)
                    .putInt("pushed", result.pushed)
                    .putInt("pulled", result.pulled)
                    .putInt("conflicts", result.conflicts)
                    .putLong("cursor", result.cursor)
                    .build()
            )
        } catch (error: CancellationException) {
            throw error
        } catch (error: SaaSHttpException) {
            when {
                error.statusCode == 401 -> {
                    AuthTokenStore(applicationContext).clear()
                    Result.failure(
                        stateData(
                            SyncExecutionState.AUTH_REQUIRED,
                            error.errorCode
                        )
                    )
                }

                isRetryable(error.statusCode) && runAttemptCount < MAX_RETRY_ATTEMPTS ->
                    Result.retry()

                else ->
                    Result.failure(
                        stateData(
                            SyncExecutionState.FAILED,
                            error.errorCode
                        )
                    )
            }
        } catch (error: IOException) {
            if (runAttemptCount < MAX_RETRY_ATTEMPTS) {
                Result.retry()
            } else {
                Result.failure(
                    stateData(
                        SyncExecutionState.FAILED,
                        error.message ?: "NETWORK_ERROR"
                    )
                )
            }
        } catch (error: Exception) {
            Result.failure(
                stateData(
                    SyncExecutionState.FAILED,
                    error.message ?: "SYNC_ERROR"
                )
            )
        } finally {
            container.close()
        }
    }

    private fun stateData(
        state: SyncExecutionState,
        error: String? = null
    ): Data = Data.Builder()
        .putString("state", state.name)
        .apply {
            if (error != null) putString("error", error)
        }
        .build()

    private fun isRetryable(statusCode: Int): Boolean =
        statusCode == 408 ||
            statusCode == 429 ||
            statusCode in 500..599

    private companion object {
        const val MAX_RETRY_ATTEMPTS = 6
    }
}

private object SyncExecutionGate {
    val mutex = Mutex()
}
