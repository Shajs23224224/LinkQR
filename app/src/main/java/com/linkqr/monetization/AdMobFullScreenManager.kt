package com.linkqr.monetization

import android.app.Activity
import android.content.Context
import android.os.SystemClock
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardItem
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class AdMobFullScreenManager(
    context: Context
) {
    private val appContext = context.applicationContext

    private var interstitialAd: InterstitialAd? = null
    private var interstitialLoadedAt = 0L

    private var rewardedAd: RewardedAd? = null
    private var rewardedLoadedAt = 0L

    private var adsAllowed = false
    private var navigationCount = 0

    private val _interstitialReady = MutableStateFlow(false)
    val interstitialReady: StateFlow<Boolean> = _interstitialReady

    private val _rewardedReady = MutableStateFlow(false)
    val rewardedReady: StateFlow<Boolean> = _rewardedReady

    fun setAdsAllowed(allowed: Boolean) {
        adsAllowed = allowed
        if (!allowed) {
            interstitialAd = null
            rewardedAd = null
            _interstitialReady.value = false
            _rewardedReady.value = false
            return
        }

        preloadAll()
    }

    fun preloadAll() {
        if (!adsAllowed) return
        loadInterstitial()
        loadRewarded()
    }

    fun maybeShowInterstitial(
        activity: Activity,
        onFinished: () -> Unit
    ) {
        if (!adsAllowed) {
            onFinished()
            return
        }

        navigationCount += 1
        if (navigationCount < INTERSTITIAL_EVERY_N_NAVIGATIONS) {
            onFinished()
            return
        }
        navigationCount = 0

        val ad = freshInterstitial()
        if (ad == null) {
            loadInterstitial()
            onFinished()
            return
        }

        interstitialAd = null
        _interstitialReady.value = false

        var finished = false
        fun finishOnce() {
            if (finished) return
            finished = true
            loadInterstitial()
            onFinished()
        }

        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                finishOnce()
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                finishOnce()
            }
        }

        ad.show(activity)
    }

    fun showRewarded(
        activity: Activity,
        onRewarded: (RewardItem) -> Unit,
        onFinished: () -> Unit
    ) {
        if (!adsAllowed) {
            onFinished()
            return
        }

        val ad = freshRewarded()
        if (ad == null) {
            loadRewarded()
            onFinished()
            return
        }

        rewardedAd = null
        _rewardedReady.value = false

        var finished = false
        fun finishOnce() {
            if (finished) return
            finished = true
            loadRewarded()
            onFinished()
        }

        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                finishOnce()
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                finishOnce()
            }
        }

        ad.show(activity) { rewardItem ->
            onRewarded(rewardItem)
        }
    }

    private fun loadInterstitial() {
        if (!adsAllowed) return

        InterstitialAd.load(
            appContext,
            MonetizationConfig.interstitialAdUnitId,
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                    interstitialLoadedAt = SystemClock.elapsedRealtime()
                    _interstitialReady.value = true
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    interstitialAd = null
                    _interstitialReady.value = false
                }
            }
        )
    }

    private fun loadRewarded() {
        if (!adsAllowed) return

        RewardedAd.load(
            appContext,
            MonetizationConfig.rewardedAdUnitId,
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    rewardedAd = ad
                    rewardedLoadedAt = SystemClock.elapsedRealtime()
                    _rewardedReady.value = true
                }

                override fun onAdFailedToLoad(error: LoadAdError) {
                    rewardedAd = null
                    _rewardedReady.value = false
                }
            }
        )
    }

    private fun freshInterstitial(): InterstitialAd? {
        val ad = interstitialAd ?: return null
        return if (SystemClock.elapsedRealtime() - interstitialLoadedAt < AD_MAX_AGE_MS) {
            ad
        } else {
            interstitialAd = null
            _interstitialReady.value = false
            null
        }
    }

    private fun freshRewarded(): RewardedAd? {
        val ad = rewardedAd ?: return null
        return if (SystemClock.elapsedRealtime() - rewardedLoadedAt < AD_MAX_AGE_MS) {
            ad
        } else {
            rewardedAd = null
            _rewardedReady.value = false
            null
        }
    }

    companion object {
        private const val INTERSTITIAL_EVERY_N_NAVIGATIONS = 3
        private const val AD_MAX_AGE_MS = 55 * 60 * 1000L
    }
}
