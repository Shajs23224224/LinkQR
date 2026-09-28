package com.linkqr.features.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.linkqr.data.repository.QrHistoryRepository
import com.linkqr.domain.model.QrRecord
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

@Composable
fun QrHistoryScreen(
    repository: QrHistoryRepository,
    favoritesOnly: Boolean,
    onBack: () -> Unit
) {
    val records by (
        if (favoritesOnly) repository.observeFavorites() else repository.observeAll()
    ).collectAsState(initial = emptyList())

    val scope = rememberCoroutineScope()
    val title = if (favoritesOnly) "Favoritos" else "Historial"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall
        )

        if (records.isEmpty()) {
            Text(
                text = if (favoritesOnly) {
                    "Todavía no tienes códigos QR favoritos."
                } else {
                    "Todavía no has generado códigos QR."
                },
                style = MaterialTheme.typography.bodyLarge
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(
                    items = records,
                    key = { it.id }
                ) { record ->
                    QrRecordCard(
                        record = record,
                        onToggleFavorite = {
                            scope.launch {
                                repository.setFavorite(record.id, !record.isFavorite)
                            }
                        },
                        onDelete = {
                            scope.launch {
                                repository.delete(record.id)
                            }
                        }
                    )
                }
            }
        }

        if (!favoritesOnly && records.isNotEmpty()) {
            OutlinedButton(
                onClick = {
                    scope.launch {
                        repository.deleteAll()
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Eliminar todo")
            }
        }

        Button(
            onClick = onBack,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Volver")
        }
    }
}

@Composable
private fun QrRecordCard(
    record: QrRecord,
    onToggleFavorite: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = record.type.label(),
                style = MaterialTheme.typography.titleMedium
            )

            Text(
                text = record.payload,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodyMedium
            )

            Text(
                text = DateFormat.getDateTimeInstance(
                    DateFormat.SHORT,
                    DateFormat.SHORT
                ).format(Date(record.createdAt)),
                style = MaterialTheme.typography.labelSmall
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onToggleFavorite,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(if (record.isFavorite) "★ Favorito" else "☆ Favorito")
                }

                OutlinedButton(
                    onClick = onDelete,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Eliminar")
                }
            }
        }
    }
}

private fun com.linkqr.domain.model.QrType.label(): String = when (this) {
    com.linkqr.domain.model.QrType.URL -> "URL"
    com.linkqr.domain.model.QrType.WHATSAPP -> "WhatsApp"
    com.linkqr.domain.model.QrType.TEXT -> "Texto"
    com.linkqr.domain.model.QrType.WIFI -> "Wi-Fi"
    com.linkqr.domain.model.QrType.PHONE -> "Teléfono"
    com.linkqr.domain.model.QrType.EMAIL -> "Correo"
    com.linkqr.domain.model.QrType.LOCATION -> "Ubicación"
}
