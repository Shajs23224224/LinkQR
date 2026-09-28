package com.linkqr.features.scanner

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.linkqr.data.repository.QrHistoryRepository
import com.linkqr.domain.model.QrType
import com.linkqr.scanner.QrTypeClassifier
import kotlinx.coroutines.launch

@Composable
fun ScannerScreen(
    repository: QrHistoryRepository,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    var scannedPayload by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (hasCameraPermission && scannedPayload == null) {
            CameraScannerView(
                onDetected = { payload ->
                    scannedPayload = payload
                    saved = false
                }
            )

            Surface(
                modifier = Modifier
                    .safeDrawingPadding()
                    .padding(16.dp),
                color = Color.Black.copy(alpha = 0.65f),
                contentColor = Color.White,
                shape = MaterialTheme.shapes.medium
            ) {
                Text(
                    text = "Apunta la cámara al código QR",
                    modifier = Modifier.padding(14.dp)
                )
            }
        } else if (scannedPayload != null) {
            ScannerResult(
                payload = scannedPayload.orEmpty(),
                saved = saved,
                onCopy = {
                    copyToClipboard(context, scannedPayload.orEmpty())
                },
                onOpen = {
                    openPayload(context, scannedPayload.orEmpty())
                },
                onSave = {
                    val payload = scannedPayload.orEmpty()
                    val type = QrTypeClassifier.classify(payload)
                    scope.launch {
                        repository.save(type = type, payload = payload)
                        saved = true
                        Toast.makeText(
                            context,
                            "QR guardado en el historial",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                },
                onScanAgain = {
                    scannedPayload = null
                    saved = false
                },
                onBack = onBack
            )
        } else {
            PermissionDenied(
                onRequest = {
                    permissionLauncher.launch(Manifest.permission.CAMERA)
                },
                onBack = onBack
            )
        }
    }
}

@Composable
private fun ScannerResult(
    payload: String,
    saved: Boolean,
    onCopy: () -> Unit,
    onOpen: () -> Unit,
    onSave: () -> Unit,
    onScanAgain: () -> Unit,
    onBack: () -> Unit
) {
    val type = QrTypeClassifier.classify(payload)
    val canOpen = when (type) {
        QrType.URL,
        QrType.WHATSAPP,
        QrType.PHONE,
        QrType.EMAIL,
        QrType.LOCATION -> true
        QrType.WIFI,
        QrType.TEXT -> false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = "QR detectado",
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall
        )

        Text(
            text = type.label(),
            color = Color.White,
            style = MaterialTheme.typography.labelLarge
        )

        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color.White,
            shape = MaterialTheme.shapes.medium
        ) {
            Text(
                text = payload,
                modifier = Modifier.padding(16.dp),
                color = Color.Black
            )
        }

        Button(
            onClick = onCopy,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Copiar")
        }

        if (canOpen) {
            OutlinedButton(
                onClick = onOpen,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Abrir")
            }
        }

        OutlinedButton(
            onClick = onSave,
            enabled = !saved,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (saved) "Guardado en historial" else "Guardar en historial")
        }

        OutlinedButton(
            onClick = onScanAgain,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Escanear otro")
        }

        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Volver")
        }
    }
}

@Composable
private fun PermissionDenied(
    onRequest: () -> Unit,
    onBack: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = "Permiso de cámara necesario",
            color = Color.White,
            style = MaterialTheme.typography.headlineSmall
        )

        Text(
            text = "LinkQR necesita la cámara para detectar códigos QR localmente.",
            color = Color.White,
            style = MaterialTheme.typography.bodyLarge
        )

        Button(
            onClick = onRequest,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Conceder permiso")
        }

        OutlinedButton(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Volver")
        }
    }
}

private fun copyToClipboard(context: Context, payload: String) {
    val clipboard = context.getSystemService(ClipboardManager::class.java)
    clipboard?.setPrimaryClip(
        ClipData.newPlainText("LinkQR", payload)
    )
    Toast.makeText(context, "QR copiado", Toast.LENGTH_SHORT).show()
}

private fun openPayload(context: Context, payload: String) {
    runCatching {
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(payload))
        )
    }.onFailure {
        Toast.makeText(
            context,
            "No hay una aplicación disponible para abrir este contenido.",
            Toast.LENGTH_LONG
        ).show()
    }
}

private fun QrType.label(): String = when (this) {
    QrType.URL -> "URL"
    QrType.WHATSAPP -> "WhatsApp"
    QrType.TEXT -> "Texto"
    QrType.WIFI -> "Wi-Fi"
    QrType.PHONE -> "Teléfono"
    QrType.EMAIL -> "Correo"
    QrType.LOCATION -> "Ubicación"
}
