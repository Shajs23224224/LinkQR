package com.linkqr.auth

import com.linkqr.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

sealed interface AuthResult<out T> {
    data class Success<T>(val value: T) : AuthResult<T>
    data class Failure(val message: String, val code: Int? = null) : AuthResult<Nothing>
}

class AuthApiRepository(
    private val sessionStore: AuthSessionStore
) {
    private val baseUrl = BuildConfig.AUTH_API_BASE_URL.trim().trimEnd('/')

    fun localSession(): AuthSession? = sessionStore.load()

    suspend fun register(name: String, email: String, password: String): AuthResult<AuthSession> =
        withContext(Dispatchers.IO) {
            if (baseUrl.isBlank()) return@withContext AuthResult.Failure("Servidor de autenticación no configurado.")
            request(
                "POST",
                "/v1/auth/register",
                JSONObject().put("name", name).put("email", email).put("password", password)
            ).let(::parseAuthenticatedSession)
        }

    suspend fun login(email: String, password: String): AuthResult<AuthSession> =
        withContext(Dispatchers.IO) {
            if (baseUrl.isBlank()) return@withContext AuthResult.Failure("Servidor de autenticación no configurado.")
            request(
                "POST",
                "/v1/auth/login",
                JSONObject().put("email", email).put("password", password)
            ).let(::parseAuthenticatedSession)
        }

    suspend fun refreshSession(): AuthResult<AuthSession> = withContext(Dispatchers.IO) {
        val session = sessionStore.load() ?: return@withContext AuthResult.Failure("No hay una sesión local.")
        if (baseUrl.isBlank()) return@withContext AuthResult.Success(session)

        val response = request("GET", "/v1/auth/me", bearerToken = session.token)
        if (response.code in 200..299) {
            val user = response.body.optJSONObject("user")
                ?: return@withContext AuthResult.Failure("Respuesta de usuario inválida.", response.code)
            val refreshed = session.copy(
                userId = user.getString("id"),
                email = user.getString("email"),
                name = user.optString("name").takeUnless { it.isBlank() || it == "null" }
            )
            sessionStore.save(refreshed)
            AuthResult.Success(refreshed)
        } else {
            if (response.code == 401) sessionStore.clear()
            parseFailure(response)
        }
    }

    suspend fun logout(): AuthResult<Unit> = withContext(Dispatchers.IO) {
        val session = sessionStore.load()
        if (session != null && baseUrl.isNotBlank()) {
            request("POST", "/v1/auth/logout", bearerToken = session.token)
        }
        sessionStore.clear()
        AuthResult.Success(Unit)
    }

    private fun parseAuthenticatedSession(response: ApiResponse): AuthResult<AuthSession> {
        if (response.code !in 200..299) return parseFailure(response)
        val user = response.body.optJSONObject("user")
            ?: return AuthResult.Failure("Respuesta de autenticación inválida.", response.code)
        val session = response.body.optJSONObject("session")
            ?: return AuthResult.Failure("Respuesta de sesión inválida.", response.code)

        val value = AuthSession(
            token = session.getString("token"),
            userId = user.getString("id"),
            email = user.getString("email"),
            name = user.optString("name").takeUnless { it.isBlank() || it == "null" },
            expiresAt = session.getLong("expiresAt")
        )
        sessionStore.save(value)
        return AuthResult.Success(value)
    }

    private fun parseFailure(response: ApiResponse): AuthResult.Failure {
        val error = response.body.optString("error")
        val message = when (error) {
            "EMAIL_ALREADY_REGISTERED" -> "Ese correo ya está registrado."
            "INVALID_CREDENTIALS" -> "Correo o contraseña incorrectos."
            "INVALID_REQUEST" -> "Revisa los datos introducidos."
            "UNAUTHORIZED" -> "La sesión ya no es válida."
            "NETWORK_ERROR" -> "No hay conexión con el servidor."
            else -> "No se pudo completar la operación."
        }
        return AuthResult.Failure(message, response.code)
    }

    private fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        bearerToken: String? = null
    ): ApiResponse {
        val connection = (URL(baseUrl + path).openConnection() as HttpURLConnection)
        return try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.setRequestProperty("Accept", "application/json")
            if (bearerToken != null) connection.setRequestProperty("Authorization", "Bearer $bearerToken")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            ApiResponse(code, runCatching { JSONObject(text) }.getOrDefault(JSONObject()))
        } catch (_: IOException) {
            ApiResponse(null, JSONObject().put("error", "NETWORK_ERROR"))
        } finally {
            connection.disconnect()
        }
    }

    private data class ApiResponse(val code: Int?, val body: JSONObject)
}
