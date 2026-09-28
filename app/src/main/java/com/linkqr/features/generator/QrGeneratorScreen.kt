package com.linkqr.features.generator

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.linkqr.data.repository.QrHistoryRepository
import com.linkqr.domain.design.ArgbColorParser
import com.linkqr.domain.design.QrDesignValidator
import com.linkqr.domain.model.QrContent
import com.linkqr.domain.model.QrDesign
import com.linkqr.domain.model.QrType
import com.linkqr.domain.qr.QrPayloadBuilder
import com.linkqr.domain.validation.UrlValidator
import com.linkqr.qr.ZXingQrCodeGenerator
import com.linkqr.storage.QrImageExporter
import kotlinx.coroutines.launch

@Composable
fun QrGeneratorScreen(
    type: QrType,
    qrCodeGenerator: ZXingQrCodeGenerator,
    qrHistoryRepository: QrHistoryRepository,
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val exporter = remember(context) { QrImageExporter(context) }
    val scope = rememberCoroutineScope()

    var first by remember(type) { mutableStateOf("") }
    var second by remember(type) { mutableStateOf("") }
    var third by remember(type) { mutableStateOf("") }
    var foregroundHex by remember(type) { mutableStateOf("#000000") }
    var backgroundHex by remember(type) { mutableStateOf("#FFFFFF") }
    var marginText by remember(type) { mutableStateOf("4") }
    var error by remember(type) { mutableStateOf<String?>(null) }
    var payload by remember(type) { mutableStateOf<String?>(null) }
    var qrBitmap by remember(type) { mutableStateOf<android.graphics.Bitmap?>(null) }
    var currentRecordId by remember(type) { mutableStateOf<Long?>(null) }
    var isFavorite by remember(type) { mutableStateOf(false) }
    var currentDesign by remember(type) { mutableStateOf(QrDesign()) }

    fun generate() {
        try {
            val content = when (type) {
                QrType.URL -> {
                    val url = UrlValidator.normalize(first)
                        ?: throw IllegalArgumentException("Introduce una URL válida.")
                    QrContent.Url(url)
                }
                QrType.WHATSAPP -> QrContent.WhatsApp(first, second.ifBlank { null })
                QrType.TEXT -> QrContent.Text(first)
                QrType.WIFI -> QrContent.Wifi(
                    ssid = first,
                    password = second,
                    security = third.ifBlank { "WPA" }
                )
                QrType.PHONE -> QrContent.Phone(first)
                QrType.EMAIL -> QrContent.Email(
                    address = first,
                    subject = second.ifBlank { null },
                    body = third.ifBlank { null }
                )
                QrType.LOCATION -> QrContent.Location(
                    latitude = first.toDouble(),
                    longitude = second.toDouble()
                )
            }

            val design = QrDesign(
                foregroundColor = ArgbColorParser.parse(foregroundHex)
                    ?: throw IllegalArgumentException("Color del QR inválido. Usa #RRGGBB."),
                backgroundColor = ArgbColorParser.parse(backgroundHex)
                    ?: throw IllegalArgumentException("Color de fondo inválido. Usa #RRGGBB."),
                marginModules = marginText.toIntOrNull()
                    ?: throw IllegalArgumentException("El margen debe ser un número.")
            )

            QrDesignValidator.requireReadable(design)

            val result = QrPayloadBuilder.build(content)
            payload = result
            currentDesign = design
            qrBitmap = qrCodeGenerator.generate(
                content = result,
                design = design
            )
            error = null
            isFavorite = false

            scope.launch {
                currentRecordId = qrHistoryRepository.save(
                    type = type,
                    payload = result,
                    design = design
                )
            }
        } catch (_: NumberFormatException) {
            payload = null
            qrBitmap = null
            error = "Introduce coordenadas numéricas válidas."
        } catch (exception: IllegalArgumentException) {
            payload = null
            qrBitmap = null
            error = exception.message ?: "Revisa los datos introducidos."
        }
    }

    fun saveQr() {
        val bitmap = qrBitmap ?: return
        try {
            exporter.saveToGallery(bitmap, "LinkQR_" + System.currentTimeMillis())
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
        try {
            context.startActivity(
                Intent.createChooser(
                    exporter.createShareIntent(
                        bitmap,
                        "LinkQR_" + System.currentTimeMillis()
                    ),
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
            if (granted) saveQr()
            else Toast.makeText(
                context,
                "Se necesita permiso para guardar imágenes en este dispositivo.",
                Toast.LENGTH_LONG
            ).show()
        }
    )

    fun requestSave() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveQr()
            return
        }

        val permission = Manifest.permission.WRITE_EXTERNAL_STORAGE
        if (ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED) {
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
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(
            text = type.title(),
            style = MaterialTheme.typography.headlineSmall
        )

        when (type) {
            QrType.URL -> Field(first, { first = it; error = null }, "URL", "ejemplo.com")
            QrType.WHATSAPP -> {
                Field(
                    first,
                    { first = it; error = null },
                    "Número con código de país",
                    "573001234567",
                    KeyboardType.Phone
                )
                Field(second, { second = it; error = null }, "Mensaje (opcional)", "Hola...")
            }
            QrType.TEXT -> Field(
                first,
                { first = it; error = null },
                "Texto",
                "Escribe el contenido"
            )
            QrType.WIFI -> {
                Field(first, { first = it; error = null }, "Nombre de red (SSID)", "Mi Wi-Fi")
                Field(second, { second = it; error = null }, "Contraseña", "Contraseña")
                Field(third, { third = it; error = null }, "Seguridad", "WPA, WEP o NOPASS")
            }
            QrType.PHONE -> Field(
                first,
                { first = it; error = null },
                "Número telefónico",
                "+57 300 123 4567",
                KeyboardType.Phone
            )
            QrType.EMAIL -> {
                Field(first, { first = it; error = null }, "Correo", "persona@ejemplo.com", KeyboardType.Email)
                Field(second, { second = it; error = null }, "Asunto (opcional)", "Asunto")
                Field(third, { third = it; error = null }, "Mensaje (opcional)", "Mensaje")
            }
            QrType.LOCATION -> {
                Field(first, { first = it; error = null }, "Latitud", "3.4516", KeyboardType.Decimal)
                Field(second, { second = it; error = null }, "Longitud", "-76.5320", KeyboardType.Decimal)
            }
        }

        Text(
            text = "Personalización",
            style = MaterialTheme.typography.titleMedium
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            ColorPreview(currentDesign.foregroundColor)
            Field(
                value = foregroundHex,
                onValueChange = {
                    foregroundHex = it
                    error = null
                },
                label = "QR",
                placeholder = "#000000"
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            ColorPreview(currentDesign.backgroundColor)
            Field(
                value = backgroundHex,
                onValueChange = {
                    backgroundHex = it
                    error = null
                },
                label = "Fondo",
                placeholder = "#FFFFFF"
            )
        }

        Field(
            value = marginText,
            onValueChange = {
                marginText = it.filter(Char::isDigit)
                error = null
            },
            label = "Margen (1–8 módulos)",
            placeholder = "4",
            keyboardType = KeyboardType.Number
        )

        Text(
            text = "Usa colores con suficiente contraste para conservar la lectura del QR.",
            style = MaterialTheme.typography.bodySmall
        )

        error?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium
            )
        }

        Button(
            onClick = ::generate,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Generar QR")
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
                Button(onClick = ::requestSave, modifier = Modifier.weight(1f)) {
                    Text("Guardar")
                }
                OutlinedButton(onClick = ::shareQr, modifier = Modifier.weight(1f)) {
                    Text("Compartir")
                }
            }

            OutlinedButton(
                onClick = {
                    val id = currentRecordId ?: return@OutlinedButton
                    val nextFavorite = !isFavorite
                    isFavorite = nextFavorite
                    scope.launch {
                        qrHistoryRepository.setFavorite(id, nextFavorite)
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (isFavorite) "★ Favorito" else "☆ Añadir a favoritos")
            }

            Text(
                text = "Diseño: " +
                    ArgbColorParser.format(currentDesign.foregroundColor) +
                    " / " +
                    ArgbColorParser.format(currentDesign.backgroundColor) +
                    " · margen " +
                    currentDesign.marginModules,
                style = MaterialTheme.typography.bodySmall
            )

            payload?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall
                )
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

@Composable
private fun ColorPreview(color: Long) {
    Box(
        modifier = Modifier
            .size(52.dp)
            .background(Color(color))
    )
}

@Composable
private fun Field(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        label = { Text(label) },
        placeholder = { Text(placeholder) },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        singleLine = true
    )
}

private fun QrType.title(): String = when (this) {
    QrType.URL -> "Crear QR de URL"
    QrType.WHATSAPP -> "Crear QR de WhatsApp"
    QrType.TEXT -> "Crear QR de texto"
    QrType.WIFI -> "Crear QR de Wi-Fi"
    QrType.PHONE -> "Crear QR de teléfono"
    QrType.EMAIL -> "Crear QR de correo"
    QrType.LOCATION -> "Crear QR de ubicación"
}
