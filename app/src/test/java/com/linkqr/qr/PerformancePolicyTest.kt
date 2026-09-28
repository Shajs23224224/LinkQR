package com.linkqr.qr

import org.junit.Assert.assertThrows
import org.junit.Test

class PerformancePolicyTest {

    @Test
    fun acceptsMinimumSupportedSize() {
        QrBitmapRenderer.requireSupportedSize(128)
    }

    @Test
    fun acceptsMaximumSupportedSize() {
        QrBitmapRenderer.requireSupportedSize(1536)
    }

    @Test
    fun rejectsSizeBelowMinimum() {
        assertThrows(IllegalArgumentException::class.java) {
            QrBitmapRenderer.requireSupportedSize(127)
        }
    }

    @Test
    fun rejectsSizeAboveMaximum() {
        assertThrows(IllegalArgumentException::class.java) {
            QrBitmapRenderer.requireSupportedSize(1537)
        }
    }
}
