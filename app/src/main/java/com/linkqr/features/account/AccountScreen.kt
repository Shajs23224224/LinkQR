package com.linkqr.features.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.linkqr.auth.AuthApiRepository
import com.linkqr.auth.AuthResult
import com.linkqr.auth.AuthSession
import kotlinx.coroutines.launch

@Composable
fun AccountScreen(
    authRepository: AuthApiRepository,
    session: AuthSession?,
    onSessionChanged: (AuthSession?) -> Unit,
    onBack: () -> Unit
) {
    var registerMode by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Cuenta", style = MaterialTheme.typography.headlineMedium)

        if (session == null) {
            if (registerMode) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nombre") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Correo electrónico") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Contraseña (mínimo 8 caracteres)") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                enabled = !loading,
                onClick = {
                    loading = true
                    message = null
                    scope.launch {
                        val result = if (registerMode) {
                            authRepository.register(name.trim(), email.trim(), password)
                        } else {
                            authRepository.login(email.trim(), password)
                        }
                        loading = false
                        when (result) {
                            is AuthResult.Success -> {
                                password = ""
                                onSessionChanged(result.value)
                            }
                            is AuthResult.Failure -> message = result.message
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                if (loading) CircularProgressIndicator()
                else Text(if (registerMode) "Crear cuenta" else "Iniciar sesión")
            }

            Button(
                enabled = !loading,
                onClick = {
                    registerMode = !registerMode
                    message = null
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (registerMode) "Ya tengo una cuenta" else "Crear una cuenta")
            }
        } else {
            Text(
                text = session.name?.let { it + "\n" + session.email } ?: session.email,
                style = MaterialTheme.typography.bodyLarge
            )

            Button(
                enabled = !loading,
                onClick = {
                    loading = true
                    scope.launch {
                        authRepository.logout()
                        loading = false
                        onSessionChanged(null)
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Cerrar sesión")
            }
        }

        message?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
            Text("Volver")
        }
    }
}
