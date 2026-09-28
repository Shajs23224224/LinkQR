package com.linkqr

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.navigation.compose.rememberNavController
import com.linkqr.auth.AuthApi
import com.linkqr.auth.AuthManager
import com.linkqr.auth.AuthState
import com.linkqr.auth.AuthTokenStore
import com.linkqr.core.di.AppContainer
import com.linkqr.core.navigation.LinkQrNavHost
import com.linkqr.data.sync.LinkQrSyncScheduler
import com.linkqr.monetization.AdMobConsentManager
import com.linkqr.monetization.AdMobFullScreenManager
import com.linkqr.monetization.BillingEntitlementManager
import com.linkqr.monetization.Plan
import com.linkqr.monetization.PlayBillingManager
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {

    private val appContainer by lazy {
        AppContainer(applicationContext)
    }

    private val entitlementManager = BillingEntitlementManager()
    private val adsReady = mutableStateOf(false)
    private val privacyOptionsRequired = mutableStateOf(false)
    private val adsFreeUntilMillis = mutableStateOf(0L)
    private val adMobConsentManager = AdMobConsentManager()

    private val adMobFullScreenManager by lazy {
        AdMobFullScreenManager(applicationContext)
    }

    private val authManager by lazy {
        AuthManager(
            api = AuthApi(),
            tokenStore = AuthTokenStore(applicationContext)
        )
    }

    private val billingManager by lazy {
        PlayBillingManager(applicationContext) { isPro ->
            entitlementManager.setProEnabled(isPro)
        }
    }

    private fun setAdsAllowed(allowed: Boolean) {
        adsReady.value = allowed
        adMobFullScreenManager.setAdsAllowed(allowed)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val navController = rememberNavController()
            val entitlementPlan by entitlementManager.plan.collectAsState()
            val billingState by billingManager.state.collectAsState()
            val authState by authManager.state.collectAsState()
            val rewardedAdReady by adMobFullScreenManager.rewardedReady.collectAsState()

            val adFree = adsFreeUntilMillis.value > System.currentTimeMillis()

            LaunchedEffect(adsFreeUntilMillis.value) {
                val remaining = adsFreeUntilMillis.value - System.currentTimeMillis()
                if (remaining > 0L) {
                    delay(remaining)
                    adsFreeUntilMillis.value = 0L
                }
            }

            LaunchedEffect(authState) {
                if (authState is AuthState.Authenticated) {
                    LinkQrSyncScheduler.enqueueNow(applicationContext)
                }
            }

            MaterialTheme {
                Surface {
                    LinkQrNavHost(
                        navController = navController,
                        qrHistoryRepository = appContainer.qrHistoryRepository,
                        showAds =
                            adsReady.value &&
                                entitlementManager.shouldShowAds() &&
                                !adFree,
                        adMobFullScreenManager = adMobFullScreenManager,
                        showRewardedAdOption =
                            adsReady.value &&
                                entitlementPlan == Plan.FREE &&
                                !adFree &&
                                rewardedAdReady,
                        onWatchRewardedAd = {
                            adMobFullScreenManager.showRewarded(
                                activity = this,
                                onRewarded = {
                                    adsFreeUntilMillis.value =
                                        System.currentTimeMillis() + AD_FREE_REWARD_DURATION_MS
                                    Toast.makeText(
                                        this,
                                        "30 minutos sin anuncios activados.",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                },
                                onFinished = {}
                            )
                        },
                        showPrivacyOptions =
                            privacyOptionsRequired.value && entitlementPlan == Plan.FREE,
                        onPrivacyOptions = {
                            adMobConsentManager.showPrivacyOptions(this) {
                                privacyOptionsRequired.value =
                                    adMobConsentManager.isPrivacyOptionsRequired
                                setAdsAllowed(adMobConsentManager.canRequestAds())
                            }
                        },
                        proState = billingState,
                        onPro = {
                            billingManager.launchProPurchase(this)
                        },
                        onRestorePro = {
                            billingManager.refreshPurchases()
                        },
                        authState = authState,
                        onLogin = authManager::login,
                        onRegister = authManager::register,
                        onResendVerification = authManager::resendVerification,
                        onPasswordResetRequest = authManager::requestPasswordReset,
                        onChangePassword = authManager::changePassword,
                        onLogout = authManager::logout
                    )
                }
            }
        }

        LinkQrSyncScheduler.schedule(applicationContext)
        authManager.initialize()

        adMobConsentManager.requestConsentAndInitialize(
            activity = this,
            onAdsReady = ::setAdsAllowed,
            onPrivacyOptionsChanged = { required ->
                privacyOptionsRequired.value = required
            }
        )

        billingManager.start()
    }

    override fun onResume() {
        super.onResume()
        billingManager.refreshPurchases()
        if (adsReady.value) {
            adMobFullScreenManager.preloadAll()
        }
    }

    override fun onDestroy() {
        billingManager.endConnection()
        authManager.close()
        appContainer.close()
        super.onDestroy()
    }

    companion object {
        private const val AD_FREE_REWARD_DURATION_MS = 30 * 60 * 1000L
    }
}
