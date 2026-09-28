package com.linkqr.monetization

import com.linkqr.BuildConfig

object MonetizationConfig {
    const val TEST_BANNER_AD_UNIT_ID = "ca-app-pub-3940256099942544/9214589741"
    const val TEST_INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712"
    const val TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917"

    val bannerAdUnitId: String
        get() = BuildConfig.ADMOB_BANNER_AD_UNIT_ID

    val interstitialAdUnitId: String
        get() = BuildConfig.ADMOB_INTERSTITIAL_AD_UNIT_ID

    val rewardedAdUnitId: String
        get() = BuildConfig.ADMOB_REWARDED_AD_UNIT_ID
}
