package com.linkqr.monetization

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class BillingEntitlementManager : EntitlementManager {

    private val _plan = MutableStateFlow(Plan.FREE)
    override val plan: StateFlow<Plan> = _plan

    fun setProEnabled(enabled: Boolean) {
        _plan.value = if (enabled) Plan.PRO else Plan.FREE
    }
}
