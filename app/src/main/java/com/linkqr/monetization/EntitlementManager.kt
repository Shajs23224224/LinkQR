package com.linkqr.monetization

interface EntitlementManager {
    val plan: Plan

    fun shouldShowAds(): Boolean = plan == Plan.FREE
}
