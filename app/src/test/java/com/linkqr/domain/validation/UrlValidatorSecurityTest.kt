package com.linkqr.domain.validation

import org.junit.Assert.assertNull
import org.junit.Test

class UrlValidatorSecurityTest {

    @Test
    fun rejectsNonHttpSchemes() {
        assertNull(UrlValidator.normalize("javascript:alert(1)"))
        assertNull(UrlValidator.normalize("file:///etc/passwd"))
        assertNull(UrlValidator.normalize("intent://example.com"))
    }

    @Test
    fun trimsAndNormalizesHttpsUrl() {
        org.junit.Assert.assertEquals(
            "https://example.com",
            UrlValidator.normalize("  example.com  ")
        )
    }
}
