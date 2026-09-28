package com.linkqr.qr

import android.graphics.Bitmap
import com.google.zxing.BitMatrix
import com.linkqr.core.performance.PerformancePolicy

internal object QrBitmapRenderer {

    fun render(
        matrix: BitMatrix,
        foreground: Int,
        background: Int
    ): Bitmap {
        val width = matrix.width
        val height = matrix.height

        return Bitmap.createBitmap(
            width,
            height,
            Bitmap.Config.ARGB_8888
        ).also { bitmap ->
            val pixels = IntArray(width * height)
            var index = 0

            for (y in 0 until height) {
                for (x in 0 until width) {
                    pixels[index++] = if (matrix[x, y]) foreground else background
                }
            }

            bitmap.setPixels(
                pixels,
                0,
                width,
                0,
                0,
                width,
                height
            )
        }
    }

    fun requireSupportedSize(sizePx: Int) {
        require(sizePx in 128..1536) {
            "El tamaño del QR debe estar entre 128 y 1536 píxeles."
        }
        require(sizePx * sizePx <= 1536 * 1536) {
            "El tamaño del QR supera el límite de memoria permitido."
        }
        require(sizePx * sizePx <= PerformancePolicy.MAX_QR_BITMAP_PIXELS * 4) {
            "El tamaño del QR supera el límite de memoria permitido."
        }
    }
}
