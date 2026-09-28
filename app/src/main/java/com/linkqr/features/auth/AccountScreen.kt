package com.linkqr.features.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.linkqr.auth.AuthUser

@Composable
fun AccountScreen(
    user: AuthUser,
    onLogout: () -> Unit,
    onChangePassword: (String, String) -> Unit,
    onPasswordResetRequest: (String) -> Unit,
    onBack: () -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Mi cuenta",
            style = MaterialTheme.typography.headlineMedium
        )

        user.name?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleLarge
            )
        }

        Text(
            text = user.email,
            style = MaterialTheme.typography.bodyLarge
        )

        Text(
            text = if (user.emailVerified) {
                "Correo verificado"
            } else {
                "Correo pendiente de verificación"
            },
            style = MaterialTheme.typography.bodyMedium
        )

        Text(
            text = "Cambiar contraseña",
            style = MaterialTheme.typography.titleMedium
        )

        OutlinedTextField(
            value = currentPassword,
            onValueChange = { currentPassword = it; message = null },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Contraseña actual") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation()
        )

        OutlinedTextField(
            value = newPassword,
            onValueChange = { newPassword = it; message = null },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Nueva contraseña") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation()
        )

        OutlinedTextField(
            value = confirmation,
            onValueChange = { confirmation = it; message = null },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Confirmar nueva contraseña") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation()
        )

        Button(
            onClick = {
                message = when {
                    currentPassword.isBlank() ->
                        "Escribe tu contraseña actual."
                    newPassword.length < 8 ->
                        "La nueva contraseña debe tener al menos 8 caracteres."
                    newPassword != confirmation ->
                        "Las contraseñas no coinciden."
                    newPassword == currentPassword ->
                        "La nueva contraseña debe ser diferente."
                    else -> {
                        onChangePassword(currentPassword, newPassword)
                        currentPassword = ""
                        newPassword = ""
                        confirmation = ""
                        "Actualizando contraseña..."
                    }
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Cambiar contraseña")
        }

        OutlinedButton(
            onClick = {
                onPasswordResetRequest(user.email)
                message = "Si tu cuenta puede recuperar la contraseña, recibirás instrucciones por correo."
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Enviar correo de recuperación")
        }

        message?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Cerrar sesión")
        }

        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Volver")
        }
    }
}
