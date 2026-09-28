package com.linkqr.features.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.linkqr.domain.model.QrType

@Composable
fun HomeScreen(
    onGenerate: (QrType) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(androidx.compose.foundation.rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "LinkQR",
            style = MaterialTheme.typography.headlineMedium
        )
        Text(
            text = "Genera códigos QR rápidamente y sin conexión.",
            style = MaterialTheme.typography.bodyLarge
        )

        QrType.entries.forEach { type ->
            Button(
                onClick = { onGenerate(type) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(type.label())
            }
        }

        Text(
            text = "Phase 3 · 7 tipos de QR",
            style = MaterialTheme.typography.labelMedium
        )
    }
}

private fun QrType.label(): String = when (this) {
    QrType.URL -> "Crear QR de URL"
    QrType.WHATSAPP -> "Crear QR de WhatsApp"
    QrType.TEXT -> "Crear QR de texto"
    QrType.WIFI -> "Crear QR de Wi-Fi"
    QrType.PHONE -> "Crear QR de teléfono"
    QrType.EMAIL -> "Crear QR de correo"
    QrType.LOCATION -> "Crear QR de ubicación"
}
