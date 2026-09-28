package com.linkqr.scanner

import com.linkqr.domain.model.QrType
import org.junit.Assert.assertEquals
import org.junit.Test

class QrTypeClassifierTest {

    @Test
    fun classifiesUrl() {
        assertEquals(
            QrType.URL,
            QrTypeClassifier.classify("https://example.com")
        )
    }

    @Test
    fun classifiesWhatsApp() {
        assertEquals(
            QrType.WHATSAPP,
            QrTypeClassifier.classify("https://wa.me/573001234567")
        )
    }

    @Test
    fun classifiesWifi() {
        assertEquals(
            QrType.WIFI,
            QrTypeClassifier.classify("WIFI:T:WPA;S:Casa;P:1234;;")
        )
    }

    @Test
    fun classifiesPlainText() {
        assertEquals(
            QrType.TEXT,
            QrTypeClassifier.classify("Hola desde LinkQR")
        )
    }
}
