package com.linkqr.scanner

import com.linkqr.domain.model.QrType

object QrTypeClassifier {

    fun classify(payload: String): QrType {
        val value = payload.trim()

        return when {
            value.startsWith("WIFI:", ignoreCase = true) -> QrType.WIFI
            value.startsWith("mailto:", ignoreCase = true) -> QrType.EMAIL
            value.startsWith("tel:", ignoreCase = true) -> QrType.PHONE
            value.startsWith("geo:", ignoreCase = true) -> QrType.LOCATION
            value.startsWith("https://wa.me/", ignoreCase = true) ||
                value.startsWith("http://wa.me/", ignoreCase = true) ->
                QrType.WHATSAPP
            value.startsWith("https://", ignoreCase = true) ||
                value.startsWith("http://", ignoreCase = true) ->
                QrType.URL
            else -> QrType.TEXT
        }
    }
}
