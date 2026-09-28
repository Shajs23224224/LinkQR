package com.linkqr.features.pro

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.linkqr.monetization.BillingUiState

@Composable
fun ProScreen(
    state: BillingUiState,
    onBuy: () -> Unit,
    onRestore: () -> Unit,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "LinkQR PRO",
            style = MaterialTheme.typography.headlineMedium
        )

        if (state.isPro) {
            Text(
                text = "PRO activo",
                style = MaterialTheme.typography.titleLarge
            )
            Text("Anuncios desactivados para esta cuenta.")
        } else {
            Text(
                text = "Compra única para desbloquear LinkQR PRO.",
                style = MaterialTheme.typography.bodyLarge
            )

            state.priceLabel?.let { price ->
                Text(
                    text = price,
                    style = MaterialTheme.typography.headlineSmall
                )
            }

            Button(
                onClick = onBuy,
                enabled = state.productAvailable && !state.isLoading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    when {
                        state.isLoading -> "Procesando…"
                        state.productAvailable -> "Comprar PRO"
                        else -> "PRO no disponible"
                    }
                )
            }

            OutlinedButton(
                onClick = onRestore,
                enabled = !state.isLoading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Restaurar compra")
            }
        }

        if (state.purchasePending && !state.isPro) {
            Text(
                text = "La compra está pendiente de confirmación de Google Play.",
                style = MaterialTheme.typography.bodyMedium
            )
        }

        state.message?.let { message ->
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium
            )
        }

        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Volver")
        }
    }
}
