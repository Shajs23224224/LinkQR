package com.linkqr.features.generator

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.linkqr.domain.validation.UrlValidator
import com.linkqr.qr.ZXingQrCodeGenerator
import com.linkqr.storage.QrImageExporter

@Composable
fun UrlQrGeneratorScreen(
    qrCodeGenerator: ZXingQrCodeGenerator,
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val exporter = remember(context) { QrImageExporter(context) }

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

    fun saveQr() {
        val bitmap = qrBitmap ?: return
        val name = "LinkQR_" + System.currentTimeMillis()

        try {
            exporter.saveToGallery(bitmap, name)
            Toast.makeText(context, "QR guardado en Imágenes/LinkQR", Toast.LENGTH_SHORT).show()
        } catch (exception: Exception) {
            Toast.makeText(
                context,
                exception.message ?: "No se pudo guardar el QR.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    fun shareQr() {
        val bitmap = qrBitmap ?: return
        val name = "LinkQR_" + System.currentTimeMillis()

        try {
            context.startActivity(
                Intent.createChooser(
                    exporter.createShareIntent(bitmap, name),
                    "Compartir código QR"
                )
            )
        } catch (exception: Exception) {
            Toast.makeText(
                context,
                exception.message ?: "No se pudo compartir el QR.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    val storagePermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { granted ->
            if (granted) {
                saveQr()
            } else {
                Toast.makeText(
                    context,
                    "Se necesita permiso para guardar imágenes en este dispositivo.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    )

    fun requestSave() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveQr()
            return
        }

        val permission = Manifest.permission.WRITE_EXTERNAL_STORAGE
        val granted = ContextCompat.checkSelfPermission(
            context,
            permission
        ) == PackageManager.PERMISSION_GRANTED

        if (granted) {
            saveQr()
        } else {
            storagePermissionLauncher.launch(permission)
        }
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
                    .align(Alignment.CenterHorizontally)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = ::requestSave,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Guardar")
                }

                OutlinedButton(
                    onClick = ::shareQr,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Compartir")
                }
            }
        }

        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Volver")
        }
    }
}
