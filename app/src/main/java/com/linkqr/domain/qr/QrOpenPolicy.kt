package com.linkqr.domain.qr

import com.linkqr.domain.model.QrType
import java.net.URI

object QrOpenPolicy {

    fun canOpen(type: QrType, payload: String): Boolean {
        val value = payload.trim()
        if (value.isBlank() || !QrPayloadPolicy.isValid(value)) return false

        return when (type) {
            QrType.URL -> hasHttpSchemeAndHost(value)

            QrType.WHATSAPP -> {
                val uri = runCatching { URI(value) }.getOrNull() ?: return false
                (uri.scheme.equals("http", true) || uri.scheme.equals("https", true)) &&
                    uri.host.equals("wa.me", true)
            }

            QrType.PHONE -> value.startsWith("tel:", ignoreCase = true)

            QrType.EMAIL -> value.startsWith("mailto:", ignoreCase = true)

            QrType.LOCATION -> value.startsWith("geo:", ignoreCase = true)

            QrType.TEXT,
            QrType.WIFI -> false
        }
    }

    private fun hasHttpSchemeAndHost(value: String): Boolean {
        val uri = runCatching { URI(value) }.getOrNull() ?: return false
        val scheme = uri.scheme?.lowercase()
        return (scheme == "http" || scheme == "https") && !uri.host.isNullOrBlank()
    }
}
