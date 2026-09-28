package com.linkqr.domain.qr

import com.linkqr.domain.model.QrContent
import org.junit.Assert.assertEquals
import org.junit.Test

class QrPayloadBuilderTest {

    @Test
    fun buildsWhatsAppPayload() {
        assertEquals(
            "https://wa.me/573001234567?text=Hola+desde+LinkQR",
            QrPayloadBuilder.build(QrContent.WhatsApp("+57 300 123 4567", "Hola desde LinkQR"))
        )
    }

    @Test
    fun buildsWifiPayload() {
        assertEquals(
            "WIFI:T:WPA;S:Casa\\,Wifi;P:clave\\;123;;",
            QrPayloadBuilder.build(QrContent.Wifi("Casa,Wifi", "clave;123", "WPA"))
        )
    }

    @Test
    fun buildsEmailPayload() {
        assertEquals(
            "mailto:persona@ejemplo.com?subject=Hola&body=Mensaje+de+prueba",
            QrPayloadBuilder.build(QrContent.Email("persona@ejemplo.com", "Hola", "Mensaje de prueba"))
        )
    }

    @Test
    fun buildsLocationPayload() {
        assertEquals(
            "geo:3.4516,-76.532",
            QrPayloadBuilder.build(QrContent.Location(3.4516, -76.532))
        )
    }

    @Test
    fun buildsPhonePayload() {
        assertEquals(
            "tel:+573001234567",
            QrPayloadBuilder.build(QrContent.Phone("+57 300 123 4567"))
        )
    }
}
