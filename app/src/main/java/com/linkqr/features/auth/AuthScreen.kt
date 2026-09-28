package com.linkqr.features.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.linkqr.auth.AuthState

@Composable
fun AuthScreen(
    state: AuthState,
    onLogin: (String, String) -> Unit,
    onRegister: (String, String, String?) -> Unit,
    onResendVerification: (String) -> Unit,
    onBack: () -> Unit
) {
    var registerMode by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state) {
        when (val current = state) {
            is AuthState.VerificationRequired -> {
                registerMode = false
                email = current.email
                password = ""
                confirmation = ""
                localError = null
            }
            is AuthState.Message -> localError = null
            else -> Unit
        }
    }

    val isLoading = state is AuthState.Loading
    val error = localError ?: (state as? AuthState.Error)?.message
    val message = (state as? AuthState.Message)?.message
    val verificationRequired = state is AuthState.VerificationRequired

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Cuenta de LinkQR",
            style = MaterialTheme.typography.headlineMedium
        )

        Text(
            text = when {
                verificationRequired ->
                    "Revisa tu correo y verifica la cuenta antes de iniciar sesión."
                registerMode ->
                    "Crear una cuenta para sincronizar tus datos cuando estés conectado."
                else ->
                    "Inicia sesión sin bloquear el uso offline de LinkQR."
            },
            style = MaterialTheme.typography.bodyLarge
        )

        if (registerMode) {
            OutlinedTextField(
                value = name,
                onValueChange = {
                    name = it
                    localError = null
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Nombre") },
                singleLine = true
            )
        }

        OutlinedTextField(
            value = email,
            onValueChange = {
                email = it
                localError = null
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Correo electrónico") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )

        if (!verificationRequired) {
            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    localError = null
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Contraseña") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )
        }

        if (registerMode) {
            OutlinedTextField(
                value = confirmation,
                onValueChange = {
                    confirmation = it
                    localError = null
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Confirmar contraseña") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
            )
        }

        error?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.error
            )
        }

        message?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.primary
            )
        }

        if (isLoading) {
            CircularProgressIndicator()
        } else if (verificationRequired) {
            Button(
                onClick = {
                    onResendVerification(email)
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Reenviar correo de verificación")
            }

            OutlinedButton(
                onClick = {
                    localError = null
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Ya verifiqué mi correo")
            }

            OutlinedButton(
                onClick = {
                    registerMode = false
                    localError = null
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Volver a iniciar sesión")
            }
        } else {
            Button(
                onClick = {
                    localError = when {
                        email.isBlank() ->
                            "Escribe tu correo."
                        password.length < 8 ->
                            "La contraseña debe tener al menos 8 caracteres."
                        registerMode && password != confirmation ->
                            "Las contraseñas no coinciden."
                        registerMode -> {
                            onRegister(
                                email,
                                password,
                                name.takeIf { it.isNotBlank() }
                            )
                            null
                        }
                        else -> {
                            onLogin(email, password)
                            null
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (registerMode) "Crear cuenta" else "Entrar")
            }

            OutlinedButton(
                onClick = {
                    registerMode = !registerMode
                    localError = null
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    if (registerMode) "Ya tengo una cuenta"
                    else "Crear una cuenta"
                )
            }
        }

        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Volver")
        }

        Text(
            text = "La sesión se almacena localmente usando Android Keystore. " +
                "La contraseña nunca se guarda en el dispositivo.",
            style = MaterialTheme.typography.bodySmall
        )
    }
}
