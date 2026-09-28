package com.linkqr.domain.validation

import java.net.URI

object UrlValidator {
    fun normalize(input: String): String? {
        val value = input.trim()
        if (value.isBlank()) return null

        val candidate = if (
            value.startsWith("http://", ignoreCase = true) ||
            value.startsWith("https://", ignoreCase = true)
        ) {
            value
        } else {
            "https://$value"
        }

        return try {
            val uri = URI(candidate)
            val scheme = uri.scheme?.lowercase()
            if (scheme != "http" && scheme != "https") return null
            if (uri.host.isNullOrBlank()) return null
            candidate
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
