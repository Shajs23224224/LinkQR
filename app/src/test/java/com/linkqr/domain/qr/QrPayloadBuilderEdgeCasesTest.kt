package com.linkqr.domain.qr

import com.linkqr.domain.model.QrContent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class QrPayloadBuilderEdgeCasesTest {

    @Test
    fun buildsUrlPayloadWithoutModification() {
        assertEquals(
            "https://example.com/path?q=1",
            QrPayloadBuilder.build(QrContent.Url("https://example.com/path?q=1"))
        )
    }

    @Test
    fun normalizesWhitespaceAndSeparatorsInPhoneNumber() {
        assertEquals(
            "tel:+573001234567",
            QrPayloadBuilder.build(QrContent.Phone(" +57 (300) 123-4567 "))
        )
    }

    @Test
    fun rejectsTooShortWhatsappNumber() {
        assertThrows(IllegalArgumentException::class.java) {
            QrPayloadBuilder.build(QrContent.WhatsApp("123", null))
        }
    }

    @Test
    fun normalizesWifiNoPasswordSecurity() {
        assertEquals(
            "WIFI:T:nopass;S:Casa;P:;;",
            QrPayloadBuilder.build(QrContent.Wifi("Casa", "", "NoPass"))
        )
    }

    @Test
    fun rejectsInvalidEmailAddress() {
        assertThrows(IllegalArgumentException::class.java) {
            QrPayloadBuilder.build(QrContent.Email("no-es-correo", null, null))
        }
    }

    @Test
    fun rejectsInvalidLocationRange() {
        assertThrows(IllegalArgumentException::class.java) {
            QrPayloadBuilder.build(QrContent.Location(91.0, 0.0))
        }
    }
}
