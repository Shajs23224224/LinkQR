package com.linkqr.domain.design

import java.util.Locale

object ArgbColorParser {

    fun parse(value: String): Long? {
        val normalized = value.trim().removePrefix("#")
        if (normalized.length != 6) return null
        if (!normalized.matches(Regex("[0-9a-fA-F]{6}"))) return null
        return ("FF" + normalized).toLongOrNull(16)
    }

    fun format(color: Long): String =
        String.format(Locale.US, "#%06X", color and 0xFFFFFFL)
}
