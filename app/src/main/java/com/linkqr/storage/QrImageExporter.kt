package com.linkqr.storage

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.File

class QrImageExporter(
    private val context: Context
) {
    fun saveToGallery(bitmap: Bitmap, displayName: String): Uri {
        val resolver = context.contentResolver
        val fileName = "$displayName.png"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(
                    MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES + "/LinkQR"
                )
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }

            val uri = resolver.insert(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                values
            ) ?: error("No se pudo crear el archivo en la galería.")

            try {
                resolver.openOutputStream(uri)?.use { output ->
                    check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                        "No se pudo escribir el código QR."
                    }
                } ?: error("No se pudo abrir el archivo de destino.")

                resolver.update(
                    uri,
                    ContentValues().apply {
                        put(MediaStore.Images.Media.IS_PENDING, 0)
                    },
                    null,
                    null
                )
                return uri
            } catch (error: Exception) {
                resolver.delete(uri, null, null)
                throw error
            }
        }

        @Suppress("DEPRECATION")
        val uriString = MediaStore.Images.Media.insertImage(
            resolver,
            bitmap,
            displayName,
            "Código QR generado por LinkQR"
        ) ?: error("No se pudo guardar el código QR en la galería.")

        return Uri.parse(uriString)
    }

    fun createShareIntent(bitmap: Bitmap, displayName: String): Intent {
        val shareDir = File(context.cacheDir, "shared_qr").apply { mkdirs() }
        val shareFile = File(shareDir, "$displayName.png")

        shareFile.outputStream().use { output ->
            check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
                "No se pudo preparar el código QR para compartir."
            }
        }

        val uri = FileProvider.getUriForFile(
            context,
            context.packageName + ".fileprovider",
            shareFile
        )

        return Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }
}
