package com.linkqr.domain.model

data class QrRecord(
    val id: Long,
    val type: QrType,
    val payload: String,
    val createdAt: Long,
    val isFavorite: Boolean,
    val design: QrDesign = QrDesign()
)
