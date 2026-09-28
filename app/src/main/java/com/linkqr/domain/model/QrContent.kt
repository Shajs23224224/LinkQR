package com.linkqr.domain.model

sealed interface QrContent {
    data class Url(val value: String) : QrContent
    data class WhatsApp(val number: String, val message: String? = null) : QrContent
    data class Text(val value: String) : QrContent
    data class Wifi(
        val ssid: String,
        val password: String,
        val security: String
    ) : QrContent
    data class Phone(val number: String) : QrContent
    data class Email(
        val address: String,
        val subject: String? = null,
        val body: String? = null
    ) : QrContent
    data class Location(val latitude: Double, val longitude: Double) : QrContent
}
