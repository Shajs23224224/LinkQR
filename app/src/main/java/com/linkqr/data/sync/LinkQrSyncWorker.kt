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
        val diagnostics = SyncDiagnosticStore(applicationContext)

        diagnostics.record(
            SyncDiagnosticEvent(
                timestampMs = System.currentTimeMillis(),
                state = "RUNNING",
                attempt = runAttemptCount
            )
        )

        try {
            val manager = SaaSSyncManager(
                context = applicationContext,
                repository = container.qrHistoryRepository
            )

            val result = manager.sync()
                ?: run {
                    diagnostics.record(
                        SyncDiagnosticEvent(
                            timestampMs = System.currentTimeMillis(),
                            state = SyncExecutionState.IDLE.name,
                            attempt = runAttemptCount
                        )
                    )
                    return@withLock Result.success(
                        stateData(SyncExecutionState.IDLE)
                    )
                }

            diagnostics.record(
                SyncDiagnosticEvent(
                    timestampMs = System.currentTimeMillis(),
                    state = SyncExecutionState.SUCCESS.name,
                    attempt = runAttemptCount,
                    pushed = result.pushed,
                    pulled = result.pulled,
                    conflicts = result.conflicts,
                    cursor = result.cursor
                )
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
                    diagnostics.record(
                        SyncDiagnosticEvent(
                            timestampMs = System.currentTimeMillis(),
                            state = SyncExecutionState.AUTH_REQUIRED.name,
                            attempt = runAttemptCount,
                            errorCode = safeErrorCode(error.errorCode)
                        )
                    )
                    Result.failure(
                        stateData(
                            SyncExecutionState.AUTH_REQUIRED,
                            safeErrorCode(error.errorCode)
                        )
                    )
                }

                isRetryable(error.statusCode) && runAttemptCount < MAX_RETRY_ATTEMPTS -> {
                    diagnostics.record(
                        SyncDiagnosticEvent(
                            timestampMs = System.currentTimeMillis(),
                            state = "RETRY_SCHEDULED",
                            attempt = runAttemptCount,
                            errorCode = "HTTP_" + error.statusCode
                        )
                    )
                    Result.retry()
                }

                else -> {
                    diagnostics.record(
                        SyncDiagnosticEvent(
                            timestampMs = System.currentTimeMillis(),
                            state = SyncExecutionState.FAILED.name,
                            attempt = runAttemptCount,
                            errorCode = "HTTP_" + error.statusCode
                        )
                    )
                    Result.failure(
                        stateData(
                            SyncExecutionState.FAILED,
                            "HTTP_" + error.statusCode
                        )
                    )
                }
            }
        } catch (error: IOException) {
            if (runAttemptCount < MAX_RETRY_ATTEMPTS) {
                diagnostics.record(
                    SyncDiagnosticEvent(
                        timestampMs = System.currentTimeMillis(),
                        state = "RETRY_SCHEDULED",
                        attempt = runAttemptCount,
                        errorCode = "NETWORK_ERROR"
                    )
                )
                Result.retry()
            } else {
                diagnostics.record(
                    SyncDiagnosticEvent(
                        timestampMs = System.currentTimeMillis(),
                        state = SyncExecutionState.FAILED.name,
                        attempt = runAttemptCount,
                        errorCode = "NETWORK_ERROR"
                    )
                )
                Result.failure(
                    stateData(
                        SyncExecutionState.FAILED,
                        "NETWORK_ERROR"
                    )
                )
            }
        } catch (error: Exception) {
            diagnostics.record(
                SyncDiagnosticEvent(
                    timestampMs = System.currentTimeMillis(),
                    state = SyncExecutionState.FAILED.name,
                    attempt = runAttemptCount,
                    errorCode = "SYNC_ERROR"
                )
            )
            Result.failure(
                stateData(
                    SyncExecutionState.FAILED,
                    "SYNC_ERROR"
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

    private fun safeErrorCode(value: String): String =
        value.filter { it.isLetterOrDigit() || it == '_' || it == '-' || it == ':' }
            .take(64)
            .ifBlank { "REMOTE_ERROR" }

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
