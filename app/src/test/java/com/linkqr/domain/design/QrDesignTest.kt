package com.linkqr.domain.design

import com.linkqr.domain.model.QrDesign
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class QrDesignTest {


    @Test
    fun defaultsToBlackQrOnWhiteBackground() {
        val design = QrDesign()
        assertEquals(0xFF000000L, design.foregroundColor)
        assertEquals(0xFFFFFFFFL, design.backgroundColor)
        QrDesignValidator.requireReadable(design)
    }

    @Test
    fun parsesSixDigitHexColorAsOpaqueArgb() {
        assertEquals(0xFF336699L, ArgbColorParser.parse("#336699"))
    }

    @Test
    fun acceptsSixDigitHexColorWithoutHash() {
        assertEquals(0xFF336699L, ArgbColorParser.parse("336699"))
    }

    @Test
    fun rejectsInvalidHexColor() {
        assertNull(ArgbColorParser.parse("#12GG89"))
    }

    @Test
    fun rejectsWrongLengthColor() {
        assertNull(ArgbColorParser.parse("#12345678"))
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
    fun acceptsMaximumMargin() {
        QrDesignValidator.requireReadable(QrDesign(marginModules = 8))
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
            QrDesignValidator.requireReadable(QrDesign(marginModules = 0))
        }
    }

    @Test
    fun rejectsBackgroundDarkerThanForeground() {
        assertThrows(IllegalArgumentException::class.java) {
            QrDesignValidator.requireReadable(
                QrDesign(
                    foregroundColor = 0xFFFFFFFFL,
                    backgroundColor = 0xFF000000L
                )
            )
        }
    }
}
