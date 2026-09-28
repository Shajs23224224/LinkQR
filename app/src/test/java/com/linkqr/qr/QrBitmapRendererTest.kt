package com.linkqr.qr

import com.google.zxing.common.BitMatrix
import org.junit.Assert.assertEquals
import org.junit.Test

class QrBitmapRendererTest {

    @Test
    fun supportedSizeKeepsDefaultWithinPerformanceLimit() {
        QrBitmapRenderer.requireSupportedSize(768)
    }

    @Test
    fun bitMatrixRendersExpectedDimensions() {
        val matrix = BitMatrix(8, 8)
        matrix.set(2, 3)

        val bitmap = QrBitmapRenderer.render(
            matrix = matrix,
            foreground = 0xFF000000.toInt(),
            background = 0xFFFFFFFF.toInt()
        )

        assertEquals(8, bitmap.width)
        assertEquals(8, bitmap.height)
        assertEquals(0xFF000000.toInt(), bitmap.getPixel(2, 3))
        assertEquals(0xFFFFFFFF.toInt(), bitmap.getPixel(0, 0))
        bitmap.recycle()
    }
}
