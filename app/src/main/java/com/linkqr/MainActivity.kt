package com.linkqr

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.navigation.compose.rememberNavController
import com.linkqr.core.di.AppContainer
import com.linkqr.core.navigation.LinkQrNavHost
import com.linkqr.monetization.AdMobConsentManager
import com.linkqr.monetization.EntitlementManager
import com.linkqr.monetization.FreeEntitlementManager

class MainActivity : ComponentActivity() {

    private val appContainer by lazy {
        AppContainer(applicationContext)
    }

    private val entitlementManager: EntitlementManager = FreeEntitlementManager()
    private val adsReady = mutableStateOf(false)
    private val privacyOptionsRequired = mutableStateOf(false)
    private val adMobConsentManager = AdMobConsentManager()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val navController = rememberNavController()

            MaterialTheme {
                Surface {
                    LinkQrNavHost(
                        navController = navController,
                        qrHistoryRepository = appContainer.qrHistoryRepository,
                        showAds = adsReady.value && entitlementManager.shouldShowAds(),
                        showPrivacyOptions = privacyOptionsRequired.value && entitlementManager.shouldShowAds(),
                        onPrivacyOptions = {
                            adMobConsentManager.showPrivacyOptions(this) {
                                privacyOptionsRequired.value =
                                    adMobConsentManager.isPrivacyOptionsRequired
                                adsReady.value =
                                    adMobConsentManager.canRequestAds()
                            }
                        }
                    )
                }
            }
        }

        adMobConsentManager.requestConsentAndInitialize(
            activity = this,
            onAdsReady = { ready ->
                adsReady.value = ready
            },
            onPrivacyOptionsChanged = { required ->
                privacyOptionsRequired.value = required
            }
        )
    }
}
