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
    fun buildPixelsRendersExpectedDimensionsAndColors() {
        val matrix = BitMatrix(8, 8)
        matrix.set(2, 3)

        val pixels = QrBitmapRenderer.buildPixels(
            matrix = matrix,
            foreground = 0xFF000000.toInt(),
            background = 0xFFFFFFFF.toInt()
        )

        assertEquals(64, pixels.size)
        assertEquals(0xFF000000.toInt(), pixels[3 * 8 + 2])
        assertEquals(0xFFFFFFFF.toInt(), pixels[0])
    }
}
