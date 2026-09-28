package com.linkqr.core.navigation

import android.app.Activity
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.linkqr.auth.AuthState
import com.linkqr.data.repository.QrHistoryRepository
import com.linkqr.domain.model.QrType
import com.linkqr.features.auth.AccountScreen
import com.linkqr.features.auth.AuthScreen
import com.linkqr.features.generator.QrGeneratorScreen
import com.linkqr.features.history.QrHistoryScreen
import com.linkqr.features.home.HomeScreen
import com.linkqr.features.pro.ProScreen
import com.linkqr.monetization.AdMobFullScreenManager
import com.linkqr.monetization.BillingUiState
import com.linkqr.qr.ZXingQrCodeGenerator

@Composable
fun LinkQrNavHost(
    navController: NavHostController,
    qrCodeGenerator: ZXingQrCodeGenerator = ZXingQrCodeGenerator(),
    qrHistoryRepository: QrHistoryRepository,
    showAds: Boolean = false,
    isPro: Boolean = false,
    adMobFullScreenManager: AdMobFullScreenManager? = null,
    showRewardedAdOption: Boolean = false,
    onWatchRewardedAd: () -> Unit = {},
    showPrivacyOptions: Boolean = false,
    onPrivacyOptions: () -> Unit = {},
    proState: BillingUiState = BillingUiState(),
    onPro: () -> Unit = {},
    onRestorePro: () -> Unit = {},
    authState: AuthState = AuthState.SignedOut,
    onLogin: (String, String) -> Unit = { _, _ -> },
    onRegister: (String, String, String?) -> Unit = { _, _, _ -> },
    onResendVerification: (String) -> Unit = {},
    onPasswordResetRequest: (String) -> Unit = {},
    onChangePassword: (String, String) -> Unit = { _, _ -> },
    onLogout: () -> Unit = {}
) {
    val activity = LocalContext.current as? Activity

    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        composable(Routes.HOME) {
            val authenticatedUser = (authState as? AuthState.Authenticated)?.user

            HomeScreen(
                onGenerate = { type ->
                    if (showAds && activity != null && adMobFullScreenManager != null) {
                        adMobFullScreenManager.maybeShowInterstitial(activity) {
                            navController.navigate("generator/" + type.name)
                        }
                    } else {
                        navController.navigate("generator/" + type.name)
                    }
                },
                onHistory = {
                    navController.navigate(Routes.HISTORY)
                },
                onFavorites = {
                    navController.navigate(Routes.FAVORITES)
                },
                onScanner = {
                    navController.navigate(Routes.SCANNER)
                },
                onPro = {
                    navController.navigate(Routes.PRO)
                },
                onAccount = {
                    navController.navigate(Routes.ACCOUNT)
                },
                accountEmail = authenticatedUser?.email,
                isPro = isPro,
                showAds = showAds,
                showRewardedAdOption = showRewardedAdOption,
                onWatchRewardedAd = onWatchRewardedAd,
                showPrivacyOptions = showPrivacyOptions,
                onPrivacyOptions = onPrivacyOptions
            )
        }

        composable(Routes.ACCOUNT) {
            when (val state = authState) {
                is AuthState.Authenticated -> {
                    AccountScreen(
                        user = state.user,
                        onLogout = onLogout,
                        onChangePassword = onChangePassword,
                        onPasswordResetRequest = onPasswordResetRequest,
                        onBack = { navController.popBackStack() }
                    )
                }
                else -> {
                    AuthScreen(
                        state = state,
                        onLogin = onLogin,
                        onRegister = onRegister,
                        onResendVerification = onResendVerification,
                        onPasswordResetRequest = onPasswordResetRequest,
                        onBack = { navController.popBackStack() }
                    )
                }
            }
        }

        composable(Routes.GENERATOR) { backStackEntry ->
            val type = backStackEntry.arguments
                ?.getString("type")
                ?.let { value ->
                    runCatching { QrType.valueOf(value) }.getOrNull()
                }

            if (type == null) {
                Text("Tipo de QR no válido")
            } else {
                QrGeneratorScreen(
                    type = type,
                    qrCodeGenerator = qrCodeGenerator,
                    qrHistoryRepository = qrHistoryRepository,
                    onBack = { navController.popBackStack() }
                )
            }
        }

        composable(Routes.HISTORY) {
            QrHistoryScreen(
                repository = qrHistoryRepository,
                favoritesOnly = false,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.FAVORITES) {
            QrHistoryScreen(
                repository = qrHistoryRepository,
                favoritesOnly = true,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.SCANNER) {
            com.linkqr.features.scanner.ScannerScreen(
                repository = qrHistoryRepository,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.PRO) {
            ProScreen(
                state = proState,
                onBuy = onPro,
                onRestore = onRestorePro,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.PREVIEW) {
            Text("Preview")
        }

        composable(Routes.SETTINGS) {
            Text("Settings")
        }
    }
}
