package com.linkqr.features.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.linkqr.domain.model.QrType
import com.linkqr.monetization.LinkQrBannerAd

@Composable
fun HomeScreen(
    onGenerate: (QrType) -> Unit,
    onHistory: () -> Unit,
    onFavorites: () -> Unit,
    onScanner: () -> Unit,
    onPro: () -> Unit,
    onAccount: () -> Unit,
    onAccount: () -> Unit,
    accountEmail: String? = null,
    showAds: Boolean = false,
    showPrivacyOptions: Boolean = false,
    onPrivacyOptions: () -> Unit = {}
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "LinkQR",
            style = MaterialTheme.typography.headlineMedium
        )

        Text(
            text = "Genera, guarda y administra tus códigos QR sin conexión.",
            style = MaterialTheme.typography.bodyLarge
        )

        OutlinedButton(
            onClick = onAccount,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = accountEmail?.let { "Cuenta · $it" }
                    ?: "Iniciar sesión"
            )
        }

        QrType.entries.forEach { type ->
            Button(
                onClick = { onGenerate(type) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(type.label())
            }
        }

        OutlinedButton(
            onClick = onHistory,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Historial")
        }

        OutlinedButton(
            onClick = onFavorites,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Favoritos")
        }

        OutlinedButton(
            onClick = onScanner,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Escanear QR")
        }

        OutlinedButton(
            onClick = onPro,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("LinkQR PRO")
        }

        OutlinedButton(
            onClick = onAccount,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Cuenta")
        }

        if (showPrivacyOptions) {
            OutlinedButton(
                onClick = onPrivacyOptions,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Opciones de privacidad")
            }
        }

        if (showAds) {
            LinkQrBannerAd(
                modifier = Modifier.fillMaxWidth()
            )
        }

        Text(
            text = "Phase 14 · Autenticación de usuarios",
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
