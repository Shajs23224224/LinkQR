package com.linkqr.domain.qr

import com.linkqr.domain.model.QrType
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class QrIntentPolicyTest {

    @Test
    fun allowsHttpAndHttpsUrls() {
        assertTrue(QrOpenPolicy.canOpen(QrType.URL, "https://example.com"))
        assertTrue(QrOpenPolicy.canOpen(QrType.URL, "http://example.com"))
    }

    @Test
    fun rejectsCustomUrlScheme() {
        assertFalse(QrOpenPolicy.canOpen(QrType.URL, "javascript:alert(1)"))
        assertFalse(QrOpenPolicy.canOpen(QrType.URL, "file:///etc/passwd"))
        assertFalse(QrOpenPolicy.canOpen(QrType.URL, "intent://example.com"))
    }

    @Test
    fun rejectsBlankAndInvalidPayloads() {
        assertFalse(QrOpenPolicy.canOpen(QrType.URL, ""))
        assertFalse(QrOpenPolicy.canOpen(QrType.URL, "https://"))
        assertFalse(QrOpenPolicy.canOpen(QrType.URL, "https://example.com\u0000"))
    }

    @Test
    fun onlyAllowsOfficialWhatsappHost() {
        assertTrue(QrOpenPolicy.canOpen(QrType.WHATSAPP, "https://wa.me/573001234567"))
        assertFalse(QrOpenPolicy.canOpen(QrType.WHATSAPP, "https://example.com/wa.me"))
        assertFalse(QrOpenPolicy.canOpen(QrType.WHATSAPP, "https://wa.me.evil.example/573001234567"))
    }

    @Test
    fun allowsTypedSchemes() {
        assertTrue(QrOpenPolicy.canOpen(QrType.PHONE, "tel:+573001234567"))
        assertTrue(QrOpenPolicy.canOpen(QrType.EMAIL, "mailto:test@example.com"))
        assertTrue(QrOpenPolicy.canOpen(QrType.LOCATION, "geo:3.45,-76.53"))
    }

    @Test
    fun neverOpensPlainTextOrWifi() {
        assertFalse(QrOpenPolicy.canOpen(QrType.TEXT, "Hola"))
        assertFalse(QrOpenPolicy.canOpen(QrType.WIFI, "WIFI:T:WPA;S:Casa;P:1234;;"))
    }
}
