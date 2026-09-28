package com.linkqr.features.generator

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.linkqr.domain.validation.UrlValidator
import com.linkqr.qr.ZXingQrCodeGenerator

@Composable
fun UrlQrGeneratorScreen(
    qrCodeGenerator: ZXingQrCodeGenerator,
    onBack: () -> Unit
) {
    var input by remember { mutableStateOf("") }
    var normalizedUrl by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var qrBitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }

    fun generate() {
        val url = UrlValidator.normalize(input)
        if (url == null) {
            normalizedUrl = null
            qrBitmap = null
            error = "Introduce una URL válida, por ejemplo: ejemplo.com"
            return
        }

        normalizedUrl = url
        error = null
        qrBitmap = qrCodeGenerator.generate(url)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Crear QR de URL",
            style = MaterialTheme.typography.headlineSmall
        )

        OutlinedTextField(
            value = input,
            onValueChange = {
                input = it
                error = null
            },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("URL") },
            placeholder = { Text("ejemplo.com") },
            singleLine = true,
            isError = error != null,
            supportingText = {
                Text(error ?: "Puedes escribir la URL con o sin https://")
            }
        )

        Button(
            onClick = ::generate,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Generar QR")
        }

        normalizedUrl?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodyMedium
            )
        }

        qrBitmap?.let { bitmap ->
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = "Código QR generado",
                modifier = Modifier
                    .size(280.dp)
                    .align(androidx.compose.ui.Alignment.CenterHorizontally)
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
