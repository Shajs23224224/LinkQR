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
                _state.value = AuthState.Authenticated(user)
            }.onFailure { error ->
                // Do not destroy a valid local session just because the device
                // is temporarily offline. Only an explicit authentication
                // failure from the backend invalidates the stored token.
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
        submit {
            api.login(email.trim(), password)
        }
    }

    fun register(email: String, password: String, name: String?) {
        submit {
            api.register(email.trim(), password, name)
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

    private fun submit(request: suspend () -> AuthSession) {
        _state.value = AuthState.Loading

        scope.launch {
            runCatching {
                request()
            }.onSuccess { session ->
                tokenStore.save(session.token)
                _state.value = AuthState.Authenticated(session.user)
            }.onFailure { error ->
                _state.value = AuthState.Error(
                    when (error) {
                        is AuthApiException -> when (error.errorCode) {
                            "EMAIL_ALREADY_REGISTERED" ->
                                "Ese correo ya está registrado."
                            "INVALID_CREDENTIALS" ->
                                "Correo o contraseña incorrectos."
                            "REQUEST_FAILED" ->
                                "No se pudo completar la solicitud."
                            else ->
                                "No se pudo completar la autenticación."
                        }
                        else ->
                            "No se pudo conectar con el servidor."
                    }
                )
            }
        }
    }
}
