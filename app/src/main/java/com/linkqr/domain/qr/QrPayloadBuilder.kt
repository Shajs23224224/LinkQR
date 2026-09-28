package com.linkqr.domain.qr

import com.linkqr.domain.model.QrContent
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object QrPayloadBuilder {

    fun build(content: QrContent): String {
        val payload = when (content) {
        is QrContent.Url -> content.value
        is QrContent.WhatsApp -> {
            val number = content.number.filter(Char::isDigit)
            require(number.length in 7..15) {
                "El número de WhatsApp debe contener entre 7 y 15 dígitos."
            }

            val base = "https://wa.me/" + number
            val message = content.message?.trim().orEmpty()
            require(message.length <= 1000) {
                "El mensaje de WhatsApp no puede superar 1000 caracteres."
            }
            if (message.isBlank()) base
            else base + "?text=" + encode(message)
        }
        is QrContent.Text -> {
            require(content.value.isNotBlank()) { "Text cannot be blank" }
            require(content.value.length <= 1800) {
                "El texto no puede superar 1800 caracteres."
            }
            content.value
        }
        is QrContent.Wifi -> {
            require(content.ssid.isNotBlank()) { "Wi-Fi SSID cannot be blank" }
            require(content.ssid.length <= 128) {
                "El nombre de la red Wi-Fi es demasiado largo."
            }
            require(content.password.length <= 128) {
                "La contraseña Wi-Fi es demasiado larga."
            }

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
            val number = encodePhone(content.number)
            require(number.length in 3..32) {
                "El número telefónico debe tener entre 3 y 32 caracteres."
            }
            "tel:" + number
        }
        is QrContent.Email -> {
            val address = content.address.trim()
            require(address.matches(Regex("""^[^\s@]+@[^\s@]+\.[^\s@]+$"""))) {
                "Email address is invalid"
            }

            val query = buildList {
                content.subject?.trim()?.takeIf { it.isNotBlank() }?.let {
                    require(it.length <= 120) {
                        "El asunto del correo no puede superar 120 caracteres."
                    }
                    add("subject=" + encode(it))
                }
                content.body?.trim()?.takeIf { it.isNotBlank() }?.let {
                    require(it.length <= 1200) {
                        "El cuerpo del correo no puede superar 1200 caracteres."
                    }
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

        return QrPayloadPolicy.requireValid(payload)
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
