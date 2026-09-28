package com.linkqr.auth

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AuthState {
    data object Loading : AuthState
    data object SignedOut : AuthState
    data class Authenticated(val user: AuthUser) : AuthState
    data class VerificationRequired(val email: String) : AuthState
    data class Message(val message: String) : AuthState
    data class Error(val message: String) : AuthState
}

class AuthManager(
    private val api: AuthApi,
    private val tokenStore: AuthTokenStore
) {
    private val scope = CoroutineScope(
        SupervisorJob() + Dispatchers.Main.immediate
    )

    private val _state = MutableStateFlow<AuthState>(AuthState.SignedOut)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private var initialized = false

    fun initialize() {
        if (initialized) return
        initialized = true

        scope.launch {
            val token = tokenStore.get()

            if (token == null) {
                _state.value = AuthState.SignedOut
                return@launch
            }

            _state.value = AuthState.Loading

            runCatching {
                api.me(token)
            }.onSuccess { user ->
                if (user.emailVerified) {
                    _state.value = AuthState.Authenticated(user)
                } else {
                    tokenStore.clear()
                    _state.value = AuthState.VerificationRequired(user.email)
                }
            }.onFailure { error ->
                if (error is AuthApiException && error.statusCode == 401) {
                    tokenStore.clear()
                    _state.value = AuthState.SignedOut
                } else {
                    _state.value = AuthState.Error(
                        "No se pudo validar la sesión. Comprueba tu conexión e inténtalo de nuevo."
                    )
                }
            }
        }
    }

    fun login(email: String, password: String) {
        submitSession {
            api.login(email.trim(), password)
        }
    }

    fun register(email: String, password: String, name: String?) {
        _state.value = AuthState.Loading

        scope.launch {
            runCatching {
                api.register(email.trim(), password, name)
            }.onSuccess { user ->
                _state.value = AuthState.VerificationRequired(user.email)
            }.onFailure { error ->
                _state.value = AuthState.Error(
                    mapError(error)
                )
            }
        }
    }

    fun resendVerification(email: String) {
        _state.value = AuthState.Loading

        scope.launch {
            runCatching {
                api.resendVerification(email.trim())
            }.onSuccess {
                _state.value = AuthState.Message(
                    "Si la cuenta necesita verificación, se envió un nuevo correo."
                )
            }.onFailure { error ->
                _state.value = AuthState.Error(mapError(error))
            }
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        val token = tokenStore.get()
        if (token == null) {
            _state.value = AuthState.SignedOut
            return
        }

        _state.value = AuthState.Loading

        scope.launch {
            runCatching {
                api.changePassword(token, currentPassword, newPassword)
            }.onSuccess { session ->
                tokenStore.save(session.token)
                _state.value = AuthState.Authenticated(session.user)
            }.onFailure { error ->
                _state.value = AuthState.Error(mapError(error))
            }
        }
    }

    fun requestPasswordReset(email: String) {
        scope.launch {
            runCatching {
                api.requestPasswordReset(email.trim())
            }.onSuccess {
                _state.value = AuthState.Message(
                    "Si existe una cuenta con ese correo, recibirás instrucciones."
                )
            }.onFailure { error ->
                _state.value = AuthState.Error(mapError(error))
            }
        }
    }

    fun logout() {
        scope.launch {
            val token = tokenStore.get()

            runCatching {
                if (token != null) {
                    api.logout(token)
                }
            }

            tokenStore.clear()
            _state.value = AuthState.SignedOut
        }
    }

    fun close() {
        scope.cancel()
    }

    private fun submitSession(request: suspend () -> AuthSession) {
        _state.value = AuthState.Loading

        scope.launch {
            runCatching {
                request()
            }.onSuccess { session ->
                tokenStore.save(session.token)
                _state.value = AuthState.Authenticated(session.user)
            }.onFailure { error ->
                _state.value = AuthState.Error(mapError(error))
            }
        }
    }

    private fun mapError(error: Throwable): String =
        when (error) {
            is AuthApiException -> when (error.errorCode) {
                "EMAIL_ALREADY_REGISTERED" ->
                    "Ese correo ya está registrado."
                "INVALID_CREDENTIALS" ->
                    "Correo o contraseña incorrectos."
                "EMAIL_NOT_VERIFIED" ->
                    "Debes verificar tu correo antes de iniciar sesión."
                "RATE_LIMITED" ->
                    "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."
                "EMAIL_DELIVERY_FAILED" ->
                    "No se pudo enviar el correo de verificación."
                "INVALID_OR_EXPIRED_TOKEN" ->
                    "El enlace ya no es válido o expiró."
                else ->
                    "No se pudo completar la autenticación."
            }
            else ->
                "No se pudo conectar con el servidor."
        }
}
