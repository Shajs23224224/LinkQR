package com.linkqr.monetization

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProFeaturesTest {

    @Test
    fun freePlanDoesNotUnlockHdExport() {
        assertFalse(
            ProFeatures.isEnabled(
                ProFeatures.Feature.HD_EXPORT,
                Plan.FREE
            )
        )
    }

    @Test
    fun proPlanUnlocksHdExport() {
        assertTrue(
            ProFeatures.isEnabled(
                ProFeatures.Feature.HD_EXPORT,
                Plan.PRO
            )
        )
    }
}
