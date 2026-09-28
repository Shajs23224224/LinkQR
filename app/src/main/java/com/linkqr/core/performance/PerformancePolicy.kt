package com.linkqr.core.performance

object PerformancePolicy {
    const val QR_BITMAP_SIZE_PX = 768
    const val MAX_QR_BITMAP_PIXELS = QR_BITMAP_SIZE_PX * QR_BITMAP_SIZE_PX
    const val SCANNER_DETECTION_DEBOUNCE_MS = 1500L
}
