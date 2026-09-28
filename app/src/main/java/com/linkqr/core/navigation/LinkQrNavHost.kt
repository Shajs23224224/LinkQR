package com.linkqr.core.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.linkqr.features.generator.UrlQrGeneratorScreen
import com.linkqr.features.home.HomeScreen
import com.linkqr.qr.ZXingQrCodeGenerator

@Composable
fun LinkQrNavHost(
    navController: NavHostController,
    qrCodeGenerator: ZXingQrCodeGenerator = ZXingQrCodeGenerator()
) {
    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        composable(Routes.HOME) {
            HomeScreen(
                onGenerateUrl = {
                    navController.navigate("generator/URL")
                }
            )
        }

        composable(Routes.GENERATOR) { backStackEntry ->
            when (backStackEntry.arguments?.getString("type")) {
                "URL" -> {
                    UrlQrGeneratorScreen(
                        qrCodeGenerator = qrCodeGenerator,
                        onBack = { navController.popBackStack() }
                    )
                }
                else -> Unit
            }
        }

        composable(Routes.PREVIEW) {
            androidx.compose.material3.Text("Preview")
        }
        composable(Routes.HISTORY) {
            androidx.compose.material3.Text("History")
        }
        composable(Routes.FAVORITES) {
            androidx.compose.material3.Text("Favorites")
        }
        composable(Routes.SCANNER) {
            androidx.compose.material3.Text("Scanner")
        }
        composable(Routes.PRO) {
            androidx.compose.material3.Text("Pro")
        }
        composable(Routes.SETTINGS) {
            androidx.compose.material3.Text("Settings")
        }
    }
}
