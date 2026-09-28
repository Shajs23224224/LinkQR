package com.linkqr.qr

import android.graphics.Bitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import com.linkqr.domain.design.QrDesignValidator
import com.linkqr.domain.model.QrDesign

class ZXingQrCodeGenerator {

    fun generate(
        content: String,
        sizePx: Int = 768,
        design: QrDesign = QrDesign()
    ): Bitmap {
        require(content.isNotBlank()) { "QR content cannot be blank" }
        require(sizePx > 0) { "QR size must be greater than zero" }
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

        return Bitmap.createBitmap(
            sizePx,
            sizePx,
            Bitmap.Config.ARGB_8888
        ).also { bitmap ->
            val foreground = design.foregroundColor.toInt()
            val background = design.backgroundColor.toInt()

            for (x in 0 until sizePx) {
                for (y in 0 until sizePx) {
                    bitmap.setPixel(
                        x,
                        y,
                        if (matrix[x, y]) foreground else background
                    )
                }
            }
        }
    }
}
