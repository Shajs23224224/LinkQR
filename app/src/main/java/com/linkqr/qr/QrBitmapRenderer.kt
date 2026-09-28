package com.linkqr.qr

import android.graphics.Bitmap
import com.google.zxing.common.BitMatrix
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
        require(
            sizePx in PerformancePolicy.MIN_QR_BITMAP_SIZE_PX..PerformancePolicy.MAX_QR_BITMAP_SIZE_PX
        ) {
            "El tamaño del QR debe estar entre " +
                PerformancePolicy.MIN_QR_BITMAP_SIZE_PX +
                " y " +
                PerformancePolicy.MAX_QR_BITMAP_SIZE_PX +
                " píxeles."
        }

        val pixelCount = sizePx.toLong() * sizePx.toLong()
        require(pixelCount <= PerformancePolicy.MAX_QR_BITMAP_PIXELS) {
            "El tamaño del QR supera el límite de memoria permitido."
        }
    }
}
