package com.linkqr.data.sync

import com.linkqr.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class SaaSWorkspace(
    val id: String,
    val name: String
)

class SaaSWorkspaceApi(
    private val baseUrl: String = BuildConfig.SAAS_BASE_URL
) {
    suspend fun firstOrCreate(token: String): SaaSWorkspace = withContext(Dispatchers.IO) {
        val existing = request(
            method = "GET",
            path = "/v1/saas/workspaces",
            token = token
        )
        val workspaces = JSONObject(existing).getJSONArray("workspaces")

        if (workspaces.length() > 0) {
            val first = workspaces.getJSONObject(0)
            return@withContext SaaSWorkspace(
                id = first.getString("id"),
                name = first.getString("name")
            )
        }

        val created = request(
            method = "POST",
            path = "/v1/saas/workspaces",
            token = token,
            body = JSONObject()
                .put("name", "LinkQR")
                .put("plan", "FREE")
                .toString()
        )
        val workspace = JSONObject(created).getJSONObject("workspace")
        SaaSWorkspace(
            id = workspace.getString("id"),
            name = workspace.getString("name")
        )
    }

    private fun request(
        method: String,
        path: String,
        token: String,
        body: String? = null
    ): String {
        val endpoint = baseUrl.trimEnd('/') + path
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
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
                throw IOException("Workspace request failed: $status")
            }
            return response
        } finally {
            connection.disconnect()
        }
    }
}
