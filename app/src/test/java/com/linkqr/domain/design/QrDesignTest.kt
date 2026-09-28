package com.linkqr.domain.design

import com.linkqr.domain.model.QrDesign
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class QrDesignTest {

    @Test
    fun parsesSixDigitHexColorAsOpaqueArgb() {
        assertEquals(0xFF336699L, ArgbColorParser.parse("#336699"))
    }

    @Test
    fun formatsArgbAsSixDigitHex() {
        assertEquals("#336699", ArgbColorParser.format(0xFF336699L))
    }

    @Test
    fun acceptsReadableDefaultDesign() {
        QrDesignValidator.requireReadable(QrDesign())
    }

    @Test
    fun rejectsLowContrastDesign() {
        assertThrows(IllegalArgumentException::class.java) {
            QrDesignValidator.requireReadable(
                QrDesign(
                    foregroundColor = 0xFF777777L,
                    backgroundColor = 0xFFAAAAAAL
                )
            )
        }
    }

    @Test
    fun rejectsInvalidMargin() {
        assertThrows(IllegalArgumentException::class.java) {
            QrDesignValidator.requireReadable(
                QrDesign(marginModules = 0)
            )
        }
    }
}
