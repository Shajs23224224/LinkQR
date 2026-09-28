package com.linkqr.domain.model

data class QrDesign(
    val foregroundColor: Long = 0xFF000000,
    val backgroundColor: Long = 0xFFFFFFFF,
    val marginModules: Int = 4
)
