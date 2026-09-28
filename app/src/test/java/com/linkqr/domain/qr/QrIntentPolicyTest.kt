package com.linkqr.domain.qr

import com.linkqr.domain.model.QrType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class QrIntentPolicyTest {

    @Test
    fun allowsHttpAndHttpsUrls() {
        assertNotNull(
            QrIntentPolicy.createViewIntent(
                QrType.URL,
                "https://example.com"
            )
        )
    }

    @Test
    fun rejectsCustomUrlScheme() {
        assertNull(
            QrIntentPolicy.createViewIntent(
                QrType.URL,
                "javascript:alert(1)"
            )
        )
    }

    @Test
    fun onlyAllowsOfficialWhatsappHost() {
        assertNotNull(
            QrIntentPolicy.createViewIntent(
                QrType.WHATSAPP,
                "https://wa.me/573001234567"
            )
        )

        assertNull(
            QrIntentPolicy.createViewIntent(
                QrType.WHATSAPP,
                "https://example.com/wa.me"
            )
        )
    }

    @Test
    fun allowsTypedPhoneSchemeOnly() {
        val intent = QrIntentPolicy.createViewIntent(
            QrType.PHONE,
            "tel:+573001234567"
        )

        assertNotNull(intent)
        assertEquals("tel", intent?.data?.scheme)
    }
}
