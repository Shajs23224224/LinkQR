package com.linkqr.data.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class SaaSSyncClient(
    baseUrl: String,
    private val bearerToken: String,
    private val workspaceId: String
) {
    private val baseUrl = baseUrl.trimEnd('/')

    suspend fun push(record: CloudQrRecord): SyncPushResult = withContext(Dispatchers.IO) {
        val connection = openConnection(
            "$baseUrl/v1/saas/workspaces/$workspaceId/qr",
            "POST"
        )
        execute(connection, record.toJson().toString()) { status, body ->
            val json = JSONObject(body)
            when {
                status in 200..299 ->
                    SyncPushResult(
                        record = json.getJSONObject("record").toCloudRecord(),
                        conflict = false
                    )
                status == 409 && json.optString("error") == "SYNC_CONFLICT" ->
                    SyncPushResult(
                        record = json.getJSONObject("winner").toCloudRecord(),
                        conflict = true
                    )
                else -> throw IOException(
                    "Cloud sync failed ($status): " + json.optString("error", "UNKNOWN_ERROR")
                )
            }
        }
    }

    suspend fun pull(): List<CloudQrRecord> = withContext(Dispatchers.IO) {
        val connection = openConnection(
            "$baseUrl/v1/saas/workspaces/$workspaceId/qr?includeDeleted=true",
            "GET"
        )
        execute(connection, null) { status, body ->
            if (status !in 200..299) {
                val json = JSONObject(body)
                throw IOException(
                    "Cloud pull failed ($status): " + json.optString("error", "UNKNOWN_ERROR")
                )
            }
            val records = JSONObject(body).getJSONArray("records")
            buildList(records.length()) {
                for (index in 0 until records.length()) {
                    add(records.getJSONObject(index).toCloudRecord())
                }
            }
        }
    }

    private fun openConnection(url: String, method: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $bearerToken")
            if (method == "POST") {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }

    private fun <T> execute(
        connection: HttpURLConnection,
        body: String?,
        parser: (status: Int, body: String) -> T
    ): T {
        try {
            if (body != null) {
                connection.outputStream.use { output ->
                    output.write(body.toByteArray(Charsets.UTF_8))
                }
            }

            val status = connection.responseCode
            val stream = if (status in 200..399) {
                connection.inputStream
            } else {
                connection.errorStream ?: connection.inputStream
            }
            val responseBody = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            return parser(status, responseBody)
        } finally {
            connection.disconnect()
        }
    }

    private fun CloudQrRecord.toJson(): JSONObject =
        JSONObject().apply {
            put("recordId", recordId)
            put("type", type)
            put("payload", payload)
            put("createdAt", createdAt)
            put("updatedAt", updatedAt)
            put("isFavorite", isFavorite)
            put("foregroundColor", foregroundColor)
            put("backgroundColor", backgroundColor)
            put("marginModules", marginModules)
            put("version", version)
            put("deviceId", deviceId)
            put("deleted", deleted)
            if (deletedAt == null) put("deletedAt", JSONObject.NULL) else put("deletedAt", deletedAt)
        }

    private fun JSONObject.toCloudRecord(): CloudQrRecord =
        CloudQrRecord(
            workspaceId = optString("workspaceId", workspaceId),
            recordId = getString("recordId"),
            type = getString("type"),
            payload = getString("payload"),
            createdAt = getLong("createdAt"),
            updatedAt = getLong("updatedAt"),
            isFavorite = getBoolean("isFavorite"),
            foregroundColor = getString("foregroundColor"),
            backgroundColor = getString("backgroundColor"),
            marginModules = getInt("marginModules"),
            version = getLong("version"),
            deviceId = getString("deviceId"),
            deleted = getBoolean("deleted"),
            deletedAt = if (isNull("deletedAt")) null else getLong("deletedAt")
        )
}


data class SyncPushResult(
    val record: CloudQrRecord,
    val conflict: Boolean
)
