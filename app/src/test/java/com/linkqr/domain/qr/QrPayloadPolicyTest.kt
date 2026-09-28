package com.linkqr.domain.qr

import com.linkqr.domain.model.QrContent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class QrPayloadPolicyTest {

    @Test
    fun acceptsNormalPayload() {
        assertTrue(QrPayloadPolicy.isValid("https://example.com"))
    }

    @Test
    fun rejectsOversizedPayload() {
        val payload = "a".repeat(QrPayloadPolicy.MAX_PAYLOAD_BYTES + 1)
        assertFalse(QrPayloadPolicy.isValid(payload))
    }

    @Test
    fun rejectsNullCharacter() {
        assertFalse(QrPayloadPolicy.isValid("hello\u0000world"))
    }

    @Test
    fun textBuilderRejectsOversizedText() {
        assertThrows(IllegalArgumentException::class.java) {
            QrPayloadBuilder.build(
                QrContent.Text("a".repeat(QrPayloadPolicy.MAX_PAYLOAD_BYTES + 1))
            )
        }
    }
}
