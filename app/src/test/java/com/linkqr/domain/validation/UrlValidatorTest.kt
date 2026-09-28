package com.linkqr.domain.validation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UrlValidatorTest {

    @Test
    fun addsHttpsSchemeWhenMissing() {
        assertEquals("https://example.com", UrlValidator.normalize("example.com"))
    }

    @Test
    fun preservesExistingHttpsScheme() {
        assertEquals(
            "https://example.com/path",
            UrlValidator.normalize("https://example.com/path")
        )
    }

    @Test
    fun preservesHttpScheme() {
        assertEquals(
            "http://example.com",
            UrlValidator.normalize("http://example.com")
        )
    }

    @Test
    fun rejectsBlankInput() {
        assertNull(UrlValidator.normalize("   "))
    }

    @Test
    fun rejectsUnsupportedScheme() {
        assertNull(UrlValidator.normalize("ftp://example.com"))
    }

    @Test
    fun rejectsMissingHost() {
        assertNull(UrlValidator.normalize("https:///path"))
    }
}
