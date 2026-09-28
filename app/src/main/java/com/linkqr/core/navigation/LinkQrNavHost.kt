package com.linkqr.core.navigation

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.linkqr.data.repository.QrHistoryRepository
import com.linkqr.domain.model.QrType
import com.linkqr.features.generator.QrGeneratorScreen
import com.linkqr.features.history.QrHistoryScreen
import com.linkqr.features.home.HomeScreen
import com.linkqr.qr.ZXingQrCodeGenerator

@Composable
fun LinkQrNavHost(
    navController: NavHostController,
    qrCodeGenerator: ZXingQrCodeGenerator = ZXingQrCodeGenerator(),
    qrHistoryRepository: QrHistoryRepository,
    showAds: Boolean = false,
    showPrivacyOptions: Boolean = false,
    onPrivacyOptions: () -> Unit = {}
) {
    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        composable(Routes.HOME) {
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
                showAds = showAds,
                showPrivacyOptions = showPrivacyOptions,
                onPrivacyOptions = onPrivacyOptions
            )
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

        composable(Routes.PREVIEW) {
            Text("Preview")
        }
        composable(Routes.PRO) {
            Text("Pro")
        }
        composable(Routes.SETTINGS) {
            Text("Settings")
        }
    }
}
