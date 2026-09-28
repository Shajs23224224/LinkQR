package com.linkqr.scanner

import android.os.Handler
import android.os.Looper
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.zxing.BinaryBitmap
import com.google.zxing.NotFoundException
import com.google.zxing.qrcode.QRCodeReader
import com.google.zxing.common.HybridBinarizer
import com.google.zxing.PlanarYUVLuminanceSource
import com.linkqr.domain.qr.QrPayloadPolicy
import java.nio.ByteBuffer

class QrImageAnalyzer(
    private val onResult: (String) -> Unit
) : ImageAnalysis.Analyzer {

    private val reader = QRCodeReader()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var lastResult: String? = null
    private var lastDetectedAt = 0L

    override fun analyze(image: ImageProxy) {
        try {
            val yPlane = image.planes.firstOrNull() ?: return
            val width = image.width
            val height = image.height
            val yData = extractLuma(
                buffer = yPlane.buffer,
                width = width,
                height = height,
                rowStride = yPlane.rowStride,
                pixelStride = yPlane.pixelStride
            )

            val rotated = rotateLuma(
                data = yData,
                width = width,
                height = height,
                rotationDegrees = image.imageInfo.rotationDegrees
            )

            val source = PlanarYUVLuminanceSource(
                rotated.data,
                rotated.width,
                rotated.height,
                0,
                0,
                rotated.width,
                rotated.height,
                false
            )

            val bitmap = BinaryBitmap(HybridBinarizer(source))

            val result = try {
                reader.decode(bitmap)
            } catch (_: NotFoundException) {
                null
            }

            val text = result?.text?.trim().orEmpty()
            if (text.isNotBlank() && QrPayloadPolicy.isValid(text)) {
                val now = System.currentTimeMillis()
                if (text != lastResult || now - lastDetectedAt > 1500L) {
                    lastResult = text
                    lastDetectedAt = now
                    mainHandler.post {
                        onResult(text)
                    }
                }
            }
        } catch (_: Exception) {
            // A malformed or unsupported frame must not stop the camera analyzer.
        } finally {
            reader.reset()
            image.close()
        }
    }

    private fun extractLuma(
        buffer: ByteBuffer,
        width: Int,
        height: Int,
        rowStride: Int,
        pixelStride: Int
    ): ByteArray {
        val source = buffer.duplicate()
        val bytes = ByteArray(source.remaining())
        source.get(bytes)

        if (pixelStride == 1 && rowStride == width) {
            return bytes.copyOf(width * height)
        }

        val output = ByteArray(width * height)
        for (y in 0 until height) {
            var sourceIndex = y * rowStride
            var targetIndex = y * width
            repeat(width) {
                output[targetIndex++] = bytes[sourceIndex]
                sourceIndex += pixelStride
            }
        }
        return output
    }

    private fun rotateLuma(
        data: ByteArray,
        width: Int,
        height: Int,
        rotationDegrees: Int
    ): RotatedLuma {
        return when (rotationDegrees) {
            90 -> {
                val output = ByteArray(data.size)
                for (y in 0 until height) {
                    for (x in 0 until width) {
                        val targetX = height - 1 - y
                        val targetY = x
                        output[targetY * height + targetX] = data[y * width + x]
                    }
                }
                RotatedLuma(output, height, width)
            }

            180 -> {
                val output = ByteArray(data.size)
                for (y in 0 until height) {
                    for (x in 0 until width) {
                        val targetX = width - 1 - x
                        val targetY = height - 1 - y
                        output[targetY * width + targetX] = data[y * width + x]
                    }
                }
                RotatedLuma(output, width, height)
            }

            270 -> {
                val output = ByteArray(data.size)
                for (y in 0 until height) {
                    for (x in 0 until width) {
                        val targetX = y
                        val targetY = width - 1 - x
                        output[targetY * height + targetX] = data[y * width + x]
                    }
                }
                RotatedLuma(output, height, width)
            }

            else -> RotatedLuma(data, width, height)
        }
    }

    private data class RotatedLuma(
        val data: ByteArray,
        val width: Int,
        val height: Int
    )
}
