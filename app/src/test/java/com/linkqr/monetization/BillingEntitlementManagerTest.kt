package com.linkqr.monetization

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BillingEntitlementManagerTest {

    @Test
    fun startsAsFree() {
        val manager = BillingEntitlementManager()

        assertEquals(Plan.FREE, manager.plan.value)
        assertTrue(manager.shouldShowAds())
    }

    @Test
    fun proDisablesAds() {
        val manager = BillingEntitlementManager()

        manager.setProEnabled(true)

        assertEquals(Plan.PRO, manager.plan.value)
        assertFalse(manager.shouldShowAds())
    }

    @Test
    fun revokingProReturnsToFree() {
        val manager = BillingEntitlementManager()

        manager.setProEnabled(true)
        manager.setProEnabled(false)

        assertEquals(Plan.FREE, manager.plan.value)
        assertTrue(manager.shouldShowAds())
    }
}
