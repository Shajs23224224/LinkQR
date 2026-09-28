package com.linkqr.domain.validation

import java.net.URI

object UrlValidator {
    private val schemeRegex = Regex("^[A-Za-z][A-Za-z0-9+.-]*:")

    fun normalize(input: String): String? {
        val value = input.trim()
        if (value.isBlank()) return null

        val explicitScheme = schemeRegex.find(value)?.value?.dropLast(1)?.lowercase()
        if (explicitScheme != null && explicitScheme != "http" && explicitScheme != "https") {
            return null
        }

        val candidate = if (explicitScheme == "http" || explicitScheme == "https") {
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
