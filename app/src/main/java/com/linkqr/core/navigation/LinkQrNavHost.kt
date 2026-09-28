package com.linkqr.core.navigation

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.linkqr.domain.model.QrType
import com.linkqr.features.generator.QrGeneratorScreen
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
                onGenerate = { type ->
                    navController.navigate("generator/" + type.name)
                }
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
                    onBack = { navController.popBackStack() }
                )
            }
        }

        composable(Routes.PREVIEW) {
            Text("Preview")
        }
        composable(Routes.HISTORY) {
            Text("History")
        }
        composable(Routes.FAVORITES) {
            Text("Favorites")
        }
        composable(Routes.SCANNER) {
            Text("Scanner")
        }
        composable(Routes.PRO) {
            Text("Pro")
        }
        composable(Routes.SETTINGS) {
            Text("Settings")
        }
    }
}
