package com.linkqr.monetization

/**
 * Central source of truth for LinkQR PRO capabilities.
 * Keep UI and feature gates dependent on this object instead of scattered checks.
 */
object ProFeatures {
    const val AD_FREE = true
    const val PRIORITY_EXPORT = true
    const val ADVANCED_DESIGN = true
    const val CLOUD_SYNC = true

    fun isEnabled(feature: Feature, plan: Plan): Boolean =
        plan == Plan.PRO && feature.enabled

    enum class Feature(val enabled: Boolean) {
        PRIORITY_EXPORT(PRIORITY_EXPORT),
        ADVANCED_DESIGN(ADVANCED_DESIGN),
        CLOUD_SYNC(CLOUD_SYNC)
    }
}
