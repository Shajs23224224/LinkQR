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
    fun onlyAllowsOfficialWhatsappHost() {
        assertTrue(
            QrOpenPolicy.canOpen(
                QrType.WHATSAPP,
                "https://wa.me/573001234567"
            )
        )
        assertFalse(
            QrOpenPolicy.canOpen(
                QrType.WHATSAPP,
                "https://example.com/wa.me"
            )
        )
    }

    @Test
    fun allowsTypedSchemes() {
        assertTrue(QrOpenPolicy.canOpen(QrType.PHONE, "tel:+573001234567"))
        assertTrue(QrOpenPolicy.canOpen(QrType.EMAIL, "mailto:test@example.com"))
        assertTrue(QrOpenPolicy.canOpen(QrType.LOCATION, "geo:3.45,-76.53"))
    }
}
