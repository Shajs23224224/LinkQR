package com.linkqr.monetization

import com.linkqr.BuildConfig

object MonetizationConfig {
    const val TEST_BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/9214589741"

    val bannerAdUnitId: String
        get() = if (BuildConfig.DEBUG) {
            TEST_BANNER_AD_UNIT_ID
        } else {
            BuildConfig.ADMOB_BANNER_AD_UNIT_ID
        }
}
