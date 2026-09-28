package com.linkqr.monetization

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProFeaturesTest {

    @Test
    fun freePlanDoesNotUnlockPremiumFeatures() {
        assertFalse(
            ProFeatures.isEnabled(
                ProFeatures.Feature.ADVANCED_DESIGN,
                Plan.FREE
            )
        )
        assertFalse(
            ProFeatures.isEnabled(
                ProFeatures.Feature.PRIORITY_EXPORT,
                Plan.FREE
            )
        )
        assertFalse(
            ProFeatures.isEnabled(
                ProFeatures.Feature.CLOUD_SYNC,
                Plan.FREE
            )
        )
    }

    @Test
    fun proPlanUnlocksPremiumFeatures() {
        assertTrue(
            ProFeatures.isEnabled(
                ProFeatures.Feature.ADVANCED_DESIGN,
                Plan.PRO
            )
        )
        assertTrue(
            ProFeatures.isEnabled(
                ProFeatures.Feature.PRIORITY_EXPORT,
                Plan.PRO
            )
        )
        assertTrue(
            ProFeatures.isEnabled(
                ProFeatures.Feature.CLOUD_SYNC,
                Plan.PRO
            )
        )
    }
}
