package com.linkqr.core.performance

object PerformancePolicy {
    const val MIN_QR_BITMAP_SIZE_PX = 128
    const val QR_BITMAP_SIZE_PX = 768
    const val MAX_QR_BITMAP_SIZE_PX = 1536
    const val MAX_QR_BITMAP_PIXELS = MAX_QR_BITMAP_SIZE_PX * MAX_QR_BITMAP_SIZE_PX
    const val SCANNER_DETECTION_DEBOUNCE_MS = 1500L
}
