package com.linkqr.auth

import com.linkqr.BuildConfig
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class AuthUser(
    val id: String,
    val email: String,
    val name: String?,
    val createdAt: Long
)

data class AuthSession(
    val token: String,
    val expiresAt: Long,
    val user: AuthUser
)

class AuthApiException(
    val statusCode: Int,
    val errorCode: String
) : IOException("Authentication request failed: $statusCode/$errorCode")

class AuthApi(
    private val baseUrl: String = BuildConfig.SAAS_BASE_URL
) {
    suspend fun register(
        email: String,
        password: String,
        name: String?
    ): AuthSession {
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
            .apply {
                if (!name.isNullOrBlank()) {
                    put("name", name.trim())
                }
            }
            .toString()

        val response = request(
            method = "POST",
            path = "/v1/auth/register",
            body = body
        )

        return parseSession(response)
    }

    suspend fun login(email: String, password: String): AuthSession {
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
            .toString()

        return parseSession(
            request(
                method = "POST",
                path = "/v1/auth/login",
                body = body
            )
        )
    }

    suspend fun me(token: String): AuthUser {
        val response = request(
            method = "GET",
            path = "/v1/auth/me",
            token = token
        )
        return parseUser(JSONObject(response).getJSONObject("user"))
    }

    suspend fun logout(token: String) {
        request(
            method = "POST",
            path = "/v1/auth/logout",
            token = token
        )
    }

    private fun parseSession(response: String): AuthSession {
        val json = JSONObject(response)
        val session = json.getJSONObject("session")

        return AuthSession(
            token = session.getString("token"),
            expiresAt = session.getLong("expiresAt"),
            user = parseUser(json.getJSONObject("user"))
        )
    }

    private fun parseUser(json: JSONObject): AuthUser =
        AuthUser(
            id = json.getString("id"),
            email = json.getString("email"),
            name = json.optString("name").takeIf { it.isNotBlank() && it != "null" },
            createdAt = json.getLong("createdAt")
        )

    private suspend fun request(
        method: String,
        path: String,
        body: String? = null,
        token: String? = null
    ): String = withContext(Dispatchers.IO) {
        val endpoint = baseUrl.trimEnd('/') + path
        val connection =
            (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 10_000
                readTimeout = 10_000
                useCaches = false
                setRequestProperty("Accept", "application/json")

                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }

                if (token != null) {
                    setRequestProperty("Authorization", "Bearer $token")
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

                throw AuthApiException(status, errorCode)
            }

            response
        } finally {
            connection.disconnect()
        }
    }
}
