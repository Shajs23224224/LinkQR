package com.linkqr.core.navigation

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.linkqr.monetization.BillingUiState
import com.linkqr.qr.ZXingQrCodeGenerator

@Composable
fun LinkQrNavHost(
    navController: NavHostController,
    qrCodeGenerator: ZXingQrCodeGenerator = ZXingQrCodeGenerator(),
    qrHistoryRepository: QrHistoryRepository,
    showAds: Boolean = false,
    showPrivacyOptions: Boolean = false,
    onPrivacyOptions: () -> Unit = {},
    proState: BillingUiState = BillingUiState(),
    onPro: () -> Unit = {},
    onRestorePro: () -> Unit = {},
    authState: AuthState = AuthState.SignedOut,
    onLogin: (String, String) -> Unit = { _, _ -> },
    onRegister: (String, String, String?) -> Unit = { _, _, _ -> },
    onResendVerification: (String) -> Unit = {},
    onLogout: () -> Unit = {}
) {
    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        composable(Routes.HOME) {
            val authenticatedUser = (authState as? AuthState.Authenticated)?.user

            HomeScreen(
                onGenerate = { type ->
                    navController.navigate("generator/" + type.name)
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
                showAds = showAds,
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
                        onBack = { navController.popBackStack() }
                    )
                }
                else -> {
                    AuthScreen(
                        state = state,
                        onLogin = onLogin,
                        onRegister = onRegister,
                        onResendVerification = onResendVerification,
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
