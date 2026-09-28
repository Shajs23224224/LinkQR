package com.linkqr.domain.design

import com.linkqr.domain.model.QrDesign
import kotlin.math.max
import kotlin.math.min

object QrDesignValidator {

    fun requireReadable(design: QrDesign): QrDesign {
        require(design.marginModules in 1..8) {
            "El margen debe estar entre 1 y 8 módulos."
        }

        val foregroundLuminance = relativeLuminance(design.foregroundColor)
        val backgroundLuminance = relativeLuminance(design.backgroundColor)

        require(backgroundLuminance > foregroundLuminance) {
            "El fondo debe ser más claro que el color del QR."
        }

        val brightest = max(foregroundLuminance, backgroundLuminance)
        val darkest = min(foregroundLuminance, backgroundLuminance)
        val contrastRatio = (brightest + 0.05) / (darkest + 0.05)

        require(contrastRatio >= 3.0) {
            "El contraste entre QR y fondo es insuficiente."
        }

        return design
    }

    private fun relativeLuminance(color: Long): Double {
        fun channel(shift: Int): Double {
            val value = ((color shr shift) and 0xFFL) / 255.0
            return if (value <= 0.03928) {
                value / 12.92
            } else {
                Math.pow((value + 0.055) / 1.055, 2.4)
            }
        }

        return 0.2126 * channel(16) +
            0.7152 * channel(8) +
            0.0722 * channel(0)
    }
}
