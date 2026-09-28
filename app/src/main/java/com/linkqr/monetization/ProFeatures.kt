package com.linkqr.monetization

/**
 * Central source of truth for LinkQR PRO capabilities.
 */
object ProFeatures {
    const val AD_FREE = true
    const val HD_EXPORT = true

    fun isEnabled(feature: Feature, plan: Plan): Boolean =
        plan == Plan.PRO && feature.enabled

    enum class Feature(val enabled: Boolean) {
        HD_EXPORT(HD_EXPORT)
    }
}
