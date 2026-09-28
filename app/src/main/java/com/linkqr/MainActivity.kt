package com.linkqr

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.navigation.compose.rememberNavController
import com.linkqr.core.di.AppContainer
import com.linkqr.core.navigation.LinkQrNavHost
import com.linkqr.monetization.AdMobConsentManager
import com.linkqr.monetization.BillingEntitlementManager
import com.linkqr.monetization.Plan
import com.linkqr.monetization.PlayBillingManager

class MainActivity : ComponentActivity() {

    private val appContainer by lazy {
        AppContainer(applicationContext)
    }

    private val entitlementManager = BillingEntitlementManager()
    private val adsReady = mutableStateOf(false)
    private val privacyOptionsRequired = mutableStateOf(false)
    private val adMobConsentManager = AdMobConsentManager()
    private val billingManager by lazy {
        PlayBillingManager(applicationContext) { isPro ->
            entitlementManager.setProEnabled(isPro)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val navController = rememberNavController()
            val entitlementPlan by entitlementManager.plan.collectAsState()
            val billingState by billingManager.state.collectAsState()

            MaterialTheme {
                Surface {
                    LinkQrNavHost(
                        navController = navController,
                        qrHistoryRepository = appContainer.qrHistoryRepository,
                        showAds = adsReady.value && entitlementManager.shouldShowAds(),
                        showPrivacyOptions =
                            privacyOptionsRequired.value && entitlementPlan == Plan.FREE,
                        onPrivacyOptions = {
                            adMobConsentManager.showPrivacyOptions(this) {
                                privacyOptionsRequired.value =
                                    adMobConsentManager.isPrivacyOptionsRequired
                                adsReady.value =
                                    adMobConsentManager.canRequestAds()
                            }
                        },
                        proState = billingState,
                        onPro = {
                            billingManager.launchProPurchase(this)
                        },
                        onRestorePro = {
                            billingManager.refreshPurchases()
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

        billingManager.start()
    }

    override fun onResume() {
        super.onResume()
        billingManager.refreshPurchases()
    }

    override fun onDestroy() {
        billingManager.endConnection()
        super.onDestroy()
    }
}
