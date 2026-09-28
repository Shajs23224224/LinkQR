package com.linkqr.monetization

import android.app.Activity
import android.os.Handler
import android.os.Looper
import com.google.android.gms.ads.MobileAds
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import java.util.concurrent.atomic.AtomicBoolean

class AdMobConsentManager {

    private val initialized = AtomicBoolean(false)
    private var consentInformation: ConsentInformation? = null

    val isPrivacyOptionsRequired: Boolean
        get() = consentInformation?.privacyOptionsRequirementStatus ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED

    fun requestConsentAndInitialize(
        activity: Activity,
        onAdsReady: (Boolean) -> Unit,
        onPrivacyOptionsChanged: (Boolean) -> Unit
    ) {
        val information = UserMessagingPlatform.getConsentInformation(activity)
        consentInformation = information

        val params = ConsentRequestParameters.Builder().build()

        information.requestConsentInfoUpdate(
            activity,
            params,
            {
                onPrivacyOptionsChanged(isPrivacyOptionsRequired)
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) {
                    onPrivacyOptionsChanged(isPrivacyOptionsRequired)
                    initializeIfAllowed(activity, onAdsReady)
                }
            },
            {
                onPrivacyOptionsChanged(isPrivacyOptionsRequired)
                initializeIfAllowed(activity, onAdsReady)
            }
        )
    }

    fun showPrivacyOptions(
        activity: Activity,
        onDismissed: () -> Unit
    ) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) {
            onDismissed()
        }
    }

    fun canRequestAds(): Boolean =
        consentInformation?.canRequestAds() == true

    private fun initializeIfAllowed(
        activity: Activity,
        onAdsReady: (Boolean) -> Unit
    ) {
        if (!canRequestAds()) {
            onAdsReady(false)
            return
        }

        if (!initialized.compareAndSet(false, true)) {
            onAdsReady(true)
            return
        }

        Thread {
            MobileAds.initialize(activity.applicationContext) {
                Handler(Looper.getMainLooper()).post {
                    onAdsReady(true)
                }
            }
        }.start()
    }
}
