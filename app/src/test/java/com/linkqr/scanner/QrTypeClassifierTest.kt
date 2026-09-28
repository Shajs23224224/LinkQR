package com.linkqr.scanner

import com.linkqr.domain.model.QrType
import org.junit.Assert.assertEquals
import org.junit.Test

class QrTypeClassifierTest {

    @Test
    fun classifiesUrl() {
        assertEquals(QrType.URL, QrTypeClassifier.classify("https://example.com"))
    }

    @Test
    fun classifiesHttpUrl() {
        assertEquals(QrType.URL, QrTypeClassifier.classify("http://example.com"))
    }

    @Test
    fun classifiesWhatsApp() {
        assertEquals(QrType.WHATSAPP, QrTypeClassifier.classify("https://wa.me/573001234567"))
    }

    @Test
    fun classifiesWifi() {
        assertEquals(QrType.WIFI, QrTypeClassifier.classify("WIFI:T:WPA;S:Casa;P:1234;;"))
    }

    @Test
    fun classifiesPhone() {
        assertEquals(QrType.PHONE, QrTypeClassifier.classify("tel:+573001234567"))
    }

    @Test
    fun classifiesEmail() {
        assertEquals(QrType.EMAIL, QrTypeClassifier.classify("mailto:test@example.com"))
    }

    @Test
    fun classifiesLocation() {
        assertEquals(QrType.LOCATION, QrTypeClassifier.classify("geo:3.4516,-76.532"))
    }

    @Test
    fun classifiesPlainText() {
        assertEquals(QrType.TEXT, QrTypeClassifier.classify("Hola desde LinkQR"))
    }

    @Test
    fun trimsLeadingAndTrailingWhitespaceBeforeClassification() {
        assertEquals(QrType.URL, QrTypeClassifier.classify("  https://example.com  "))
    }
}
