package com.linkqr.monetization

import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EntitlementManagerTest {

    private val entitlementManager = FreeEntitlementManager()

    @Test
    fun freePlanIsSelected() {
        assertEquals(Plan.FREE, entitlementManager.plan.value)
    }

    @Test
    fun freePlanShowsAds() {
        assertTrue(entitlementManager.shouldShowAds())
    }

    @Test
    fun proPlanWouldHideAds() {
        val proManager = object : EntitlementManager {
            override val plan = MutableStateFlow(Plan.PRO)
        }

        assertFalse(proManager.shouldShowAds())
    }
}
