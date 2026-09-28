package com.linkqr.monetization

import kotlinx.coroutines.flow.StateFlow

interface EntitlementManager {
    val plan: StateFlow<Plan>

    fun shouldShowAds(): Boolean = plan.value == Plan.FREE
}
