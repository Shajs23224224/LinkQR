package com.linkqr.domain.qr

import java.nio.charset.StandardCharsets

object QrPayloadPolicy {
    const val MAX_PAYLOAD_BYTES = 2048

    fun requireValid(payload: String): String {
        require(payload.isNotBlank()) {
            "El contenido del QR no puede estar vacío."
        }
        require(!payload.contains('\u0000')) {
            "El contenido del QR contiene un carácter no válido."
        }

        val byteCount = payload.toByteArray(StandardCharsets.UTF_8).size
        require(byteCount <= MAX_PAYLOAD_BYTES) {
            "El contenido del QR es demasiado largo. Máximo: $MAX_PAYLOAD_BYTES bytes."
        }

        return payload
    }

    fun isValid(payload: String): Boolean =
        runCatching { requireValid(payload.trim()) }.isSuccess
}
