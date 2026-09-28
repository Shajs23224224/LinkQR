package com.linkqr.features.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.linkqr.auth.AuthUser
import com.linkqr.sync.SaaSSyncState

@Composable
fun AccountScreen(
    user: AuthUser,
    onLogout: () -> Unit,
    onSync: () -> Unit,
    syncState: SaaSSyncState,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Mi cuenta", style = MaterialTheme.typography.headlineMedium)

        user.name?.let {
            Text(it, style = MaterialTheme.typography.titleLarge)
        }

        Text(user.email, style = MaterialTheme.typography.bodyLarge)
        Text("Sesión autenticada", style = MaterialTheme.typography.bodyMedium)

        Button(
            onClick = onSync,
            enabled = syncState !is SaaSSyncState.Syncing,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (syncState is SaaSSyncState.Syncing) {
                CircularProgressIndicator()
            } else {
                Text("Sincronizar QR")
            }
        }

        when (val state = syncState) {
            is SaaSSyncState.Success -> {
                Text(
                    text = "Sincronizado con “" + state.workspaceName + "”. " +
                        state.uploaded + " cambios enviados, " +
                        state.downloaded + " recibidos, " +
                        state.deletionsSynced + " eliminaciones propagadas.",
                    style = MaterialTheme.typography.bodySmall
                )
                if (state.conflictsResolved > 0) {
                    Text(
                        text = state.conflictsResolved.toString() +
                            " conflicto(s) resuelto(s) automáticamente.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
            is SaaSSyncState.Error -> {
                Text(
                    text = state.message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            else -> Unit
        }

        Text(
            text = "Tus QR locales siguen disponibles sin conexión. " +
                "Las eliminaciones sincronizadas se conservan como tombstones " +
                "para evitar que un QR borrado reaparezca.",
            style = MaterialTheme.typography.bodySmall
        )

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
