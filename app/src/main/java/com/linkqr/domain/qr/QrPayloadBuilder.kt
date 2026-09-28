package com.linkqr.domain.qr

import com.linkqr.domain.model.QrContent
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object QrPayloadBuilder {

    fun build(content: QrContent): String = when (content) {
        is QrContent.Url -> content.value
        is QrContent.WhatsApp -> {
            val number = content.number.filter(Char::isDigit)
            require(number.length >= 7) { "WhatsApp number is invalid" }

            val base = "https://wa.me/" + number
            val message = content.message?.trim().orEmpty()
            if (message.isBlank()) base
            else base + "?text=" + encode(message)
        }
        is QrContent.Text -> {
            require(content.value.isNotBlank()) { "Text cannot be blank" }
            content.value
        }
        is QrContent.Wifi -> {
            require(content.ssid.isNotBlank()) { "Wi-Fi SSID cannot be blank" }

            val security = when (content.security.trim().lowercase()) {
                "", "wpa" -> "WPA"
                "wep" -> "WEP"
                "nopass" -> "nopass"
                else -> content.security.trim().uppercase()
            }
            require(security in setOf("WPA", "WEP", "nopass")) {
                "Wi-Fi security must be WPA, WEP or NOPASS"
            }

            "WIFI:T:" + wifiEscape(security) +
                ";S:" + wifiEscape(content.ssid) +
                ";P:" + wifiEscape(content.password) + ";;"
        }
        is QrContent.Phone -> {
            val number = content.number.trim()
            require(number.isNotBlank()) { "Phone number cannot be blank" }
            "tel:" + encodePhone(number)
        }
        is QrContent.Email -> {
            val address = content.address.trim()
            require(address.matches(Regex("""^[^\s@]+@[^\s@]+\.[^\s@]+$"""))) {
                "Email address is invalid"
            }

            val query = buildList {
                content.subject?.trim()?.takeIf { it.isNotBlank() }?.let {
                    add("subject=" + encode(it))
                }
                content.body?.trim()?.takeIf { it.isNotBlank() }?.let {
                    add("body=" + encode(it))
                }
            }.joinToString("&")

            if (query.isBlank()) "mailto:" + address
            else "mailto:" + address + "?" + query
        }
        is QrContent.Location -> {
            require(content.latitude in -90.0..90.0) { "Latitude is invalid" }
            require(content.longitude in -180.0..180.0) { "Longitude is invalid" }
            "geo:" + content.latitude + "," + content.longitude
        }
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    private fun encodePhone(value: String): String =
        value.trim()
            .replace(" ", "")
            .replace("-", "")
            .replace("(", "")
            .replace(")", "")

    private fun wifiEscape(value: String): String =
        value.replace("\\", "\\\\")
            .replace(";", "\\;")
            .replace(",", "\\,")
            .replace(":", "\\:")
            .replace("\"", "\\\"")
}
