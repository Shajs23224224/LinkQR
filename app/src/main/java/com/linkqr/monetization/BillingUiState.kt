package com.linkqr.monetization

data class BillingUiState(
    val isPro: Boolean = false,
    val isLoading: Boolean = false,
    val productAvailable: Boolean = false,
    val priceLabel: String? = null,
    val purchasePending: Boolean = false,
    val message: String? = null
)
