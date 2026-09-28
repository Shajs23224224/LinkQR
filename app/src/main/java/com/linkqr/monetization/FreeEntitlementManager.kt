package com.linkqr.monetization

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class FreeEntitlementManager : EntitlementManager {
    private val _plan = MutableStateFlow(Plan.FREE)
    override val plan: StateFlow<Plan> = _plan
}
