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
    val createdAt: Long,
    val emailVerified: Boolean
)

data class AuthSession(
    val token: String,
    val expiresAt: Long,
    val sessionId: String,
    val user: AuthUser
)

data class AuthSessionInfo(
    val sessionId: String,
    val createdAt: Long,
    val expiresAt: Long,
    val current: Boolean
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
    ): AuthUser {
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

        return parseUser(JSONObject(response).getJSONObject("user"))
    }

    suspend fun login(email: String, password: String): AuthSession =
        parseSession(
            request(
                method = "POST",
                path = "/v1/auth/login",
                body = JSONObject()
                    .put("email", email)
                    .put("password", password)
                    .toString()
            )
        )

    suspend fun verifyEmail(token: String): AuthUser {
        val response = request(
            method = "POST",
            path = "/v1/auth/verify-email",
            body = JSONObject().put("token", token).toString()
        )
        return parseUser(JSONObject(response).getJSONObject("user"))
    }

    suspend fun resendVerification(email: String) {
        request(
            method = "POST",
            path = "/v1/auth/resend-verification",
            body = JSONObject().put("email", email).toString()
        )
    }

    suspend fun requestPasswordReset(email: String) {
        request(
            method = "POST",
            path = "/v1/auth/password-reset/request",
            body = JSONObject().put("email", email).toString()
        )
    }

    suspend fun confirmPasswordReset(token: String, newPassword: String) {
        request(
            method = "POST",
            path = "/v1/auth/password-reset/confirm",
            body = JSONObject()
                .put("token", token)
                .put("password", newPassword)
                .toString()
        )
    }

    suspend fun changePassword(
        token: String,
        currentPassword: String,
        newPassword: String
    ): AuthSession =
        parseSession(
            request(
                method = "POST",
                path = "/v1/auth/password/change",
                token = token,
                body = JSONObject()
                    .put("currentPassword", currentPassword)
                    .put("newPassword", newPassword)
                    .toString()
            )
        )

    suspend fun listSessions(token: String): List<AuthSessionInfo> {
        val json = JSONObject(
            request(
                method = "GET",
                path = "/v1/auth/sessions",
                token = token
            )
        )
        val array = json.getJSONArray("sessions")
        return List(array.length()) { index ->
            val item = array.getJSONObject(index)
            AuthSessionInfo(
                sessionId = item.getString("sessionId"),
                createdAt = item.getLong("createdAt"),
                expiresAt = item.getLong("expiresAt"),
                current = item.getBoolean("current")
            )
        }
    }

    suspend fun revokeSession(token: String, sessionId: String) {
        request(
            method = "DELETE",
            path = "/v1/auth/sessions/" + sessionId,
            token = token
        )
    }

    suspend fun revokeOtherSessions(token: String) {
        request(
            method = "POST",
            path = "/v1/auth/sessions/revoke-others",
            token = token
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
            sessionId = session.getString("sessionId"),
            user = parseUser(json.getJSONObject("user"))
        )
    }

    private fun parseUser(json: JSONObject): AuthUser =
        AuthUser(
            id = json.getString("id"),
            email = json.getString("email"),
            name = json.optString("name").takeIf { it.isNotBlank() && it != "null" },
            createdAt = json.getLong("createdAt"),
            emailVerified = json.optBoolean("emailVerified", false)
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
