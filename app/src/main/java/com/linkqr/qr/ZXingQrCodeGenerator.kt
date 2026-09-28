package com.linkqr.qr

import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.linkqr.core.performance.PerformancePolicy
import com.linkqr.domain.design.QrDesignValidator
import com.linkqr.domain.model.QrDesign

class ZXingQrCodeGenerator {

    fun generate(
        content: String,
        sizePx: Int = PerformancePolicy.QR_BITMAP_SIZE_PX,
        design: QrDesign = QrDesign()
    ): Bitmap {
        require(content.isNotBlank()) { "QR content cannot be blank" }
        QrBitmapRenderer.requireSupportedSize(sizePx)
        QrDesignValidator.requireReadable(design)

        val hints = mapOf(
            EncodeHintType.MARGIN to design.marginModules,
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M
        )

        val matrix = MultiFormatWriter().encode(
            content,
            BarcodeFormat.QR_CODE,
            sizePx,
            sizePx,
            hints
        )

        return QrBitmapRenderer.render(
            matrix = matrix,
            foreground = design.foregroundColor.toInt(),
            background = design.backgroundColor.toInt()
        )
    }
}
