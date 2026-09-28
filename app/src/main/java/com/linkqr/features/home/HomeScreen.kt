package com.linkqr.features.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.linkqr.core.navigation.Routes

@Composable
fun HomeScreen(
    onGenerateUrl: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "LinkQR",
            style = MaterialTheme.typography.headlineMedium
        )
        Text(
            text = "Genera códigos QR rápidamente y sin conexión.",
            style = MaterialTheme.typography.bodyLarge
        )
        Button(onClick = onGenerateUrl) {
            Text("Crear QR de URL")
        }
        Text(
            text = "MVP · URL",
            style = MaterialTheme.typography.labelMedium
        )
    }
}
