package com.linkqr.sync

import com.linkqr.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class SaaSWorkspace(
    val id: String,
    val name: String,
    val plan: String,
    val createdAt: Long
)

data class SaaSQrRecord(
    val recordId: String,
    val type: String,
    val payload: String,
    val createdAt: Long,
    val isFavorite: Boolean,
    val foregroundColor: String,
    val backgroundColor: String,
    val marginModules: Int
)

class SaaSApiException(
    val statusCode: Int,
    val errorCode: String
) : IOException("SaaS request failed: $statusCode/$errorCode")

class SaaSApi(
    private val baseUrl: String = BuildConfig.SAAS_BASE_URL
) {
    suspend fun listWorkspaces(token: String): List<SaaSWorkspace> =
        parseWorkspaces(request("GET", "/v1/saas/workspaces", token = token))

    suspend fun createWorkspace(
        token: String,
        name: String
    ): SaaSWorkspace {
        val response = request(
            method = "POST",
            path = "/v1/saas/workspaces",
            token = token,
            body = JSONObject()
                .put("name", name)
                .put("plan", "FREE")
                .toString()
        )
        return parseWorkspace(JSONObject(response).getJSONObject("workspace"))
    }

    suspend fun listQrRecords(
        token: String,
        workspaceId: String
    ): List<SaaSQrRecord> {
        val response = request(
            "GET",
            "/v1/saas/workspaces/$workspaceId/qr",
            token = token
        )
        val records = JSONObject(response).optJSONArray("records") ?: JSONArray()
        return buildList(records.length()) {
            for (index in 0 until records.length()) {
                add(parseQrRecord(records.getJSONObject(index)))
            }
        }
    }

    suspend fun upsertQrRecord(
        token: String,
        workspaceId: String,
        record: SaaSQrRecord
    ) {
        request(
            method = "POST",
            path = "/v1/saas/workspaces/$workspaceId/qr",
            token = token,
            body = JSONObject()
                .put("recordId", record.recordId)
                .put("type", record.type)
                .put("payload", record.payload)
                .put("createdAt", record.createdAt)
                .put("isFavorite", record.isFavorite)
                .put("foregroundColor", record.foregroundColor)
                .put("backgroundColor", record.backgroundColor)
                .put("marginModules", record.marginModules)
                .toString()
        )
    }

    private fun parseWorkspaces(response: String): List<SaaSWorkspace> {
        val workspaces = JSONObject(response).optJSONArray("workspaces") ?: JSONArray()
        return buildList(workspaces.length()) {
            for (index in 0 until workspaces.length()) {
                add(parseWorkspace(workspaces.getJSONObject(index)))
            }
        }
    }

    private fun parseWorkspace(json: JSONObject): SaaSWorkspace =
        SaaSWorkspace(
            id = json.getString("id"),
            name = json.getString("name"),
            plan = json.getString("plan"),
            createdAt = json.getLong("createdAt")
        )

    private fun parseQrRecord(json: JSONObject): SaaSQrRecord =
        SaaSQrRecord(
            recordId = json.getString("recordId"),
            type = json.getString("type"),
            payload = json.getString("payload"),
            createdAt = json.getLong("createdAt"),
            isFavorite = json.getBoolean("isFavorite"),
            foregroundColor = json.getString("foregroundColor"),
            backgroundColor = json.getString("backgroundColor"),
            marginModules = json.getInt("marginModules")
        )

    private suspend fun request(
        method: String,
        path: String,
        token: String,
        body: String? = null
    ): String = withContext(Dispatchers.IO) {
        val endpoint = baseUrl.trimEnd('/') + path
        val connection =
            (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 10_000
                readTimeout = 10_000
                useCaches = false
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $token")

                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
            }

        try {
            if (body != null) {
                connection.outputStream.use { output ->
                    output.write(body.toByteArray(Charsets.UTF_8))
                }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }

            val response = stream
                ?.bufferedReader(Charsets.UTF_8)
                ?.use { it.readText() }
                ?: ""

            if (status !in 200..299) {
                val errorCode = runCatching {
                    JSONObject(response).optString("error", "REQUEST_FAILED")
                }.getOrDefault("REQUEST_FAILED")

                throw SaaSApiException(status, errorCode)
            }

            response
        } finally {
            connection.disconnect()
        }
    }
}
